import { subDays } from "date-fns";
import type { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db";
import { savePhotoFromUrl } from "@/lib/photos";
import { logStatus } from "@/lib/statusLog";
import { ACTIVE_STATUSES, type OrderStatus } from "@/lib/status";
import { shouldPromoteOnAttach } from "@/lib/dispatchReady";
import {
  fetchSliderDelivery,
  SliderError,
  SLIDER_TO_ORDER_STATUS,
  type SliderDelivery,
  type SliderStatus,
} from "@/lib/slider";

/**
 * Mirrors a Slider delivery onto our order: status, rider details and the
 * driver's proof-of-delivery photo.
 *
 * Slider's drivers will never touch our /deliver link — marking the job in
 * Slider's app is how they get paid — so this is the only way those updates
 * reach us without Operations retyping them.
 */

/**
 * How far along our flow a status is. A sync may only ever pull an order
 * *forward*: Slider describes one leg of the job, and a poll that arrives out
 * of order (or a Slider order that gets reused) must never undo a delivery
 * Operations already closed by hand, or reopen a cancelled order.
 */
const PROGRESS: Record<OrderStatus, number> = {
  NEW: 0,
  ASSIGNED_FLORIST: 0,
  READY: 0,
  ASSIGNED_DRIVER: 1,
  OUT_FOR_DELIVERY: 2,
  DELIVERED: 3,
  FAILED_DELIVERY: 3,
  CANCELLED: 3,
};

export type SliderSyncResult = {
  orderId: string;
  /** Our status after the sync, or null if it didn't move. */
  newStatus: OrderStatus | null;
  photoSaved: boolean;
  error: string | null;
};

type SyncableOrder = {
  id: string;
  trackingToken: string;
  status: string;
  sliderOrderNumber: string | null;
};

export async function syncSliderOrder(order: SyncableOrder): Promise<SliderSyncResult> {
  const result: SliderSyncResult = {
    orderId: order.id,
    newStatus: null,
    photoSaved: false,
    error: null,
  };

  if (!order.sliderOrderNumber) {
    result.error = "This order isn't linked to a Slider delivery.";
    return result;
  }

  let delivery: SliderDelivery;
  try {
    delivery = await fetchSliderDelivery(order.sliderOrderNumber);
  } catch (error) {
    // A failed sync is recorded on the order rather than thrown: the cron run
    // must carry on to the other orders, and Operations needs to see *which*
    // order is failing and why.
    result.error = error instanceof SliderError ? error.message : "Slider sync failed.";
    await db.order.update({
      where: { id: order.id },
      data: { sliderSyncedAt: new Date(), sliderSyncError: result.error },
    });
    return result;
  }

  const data: Prisma.OrderUncheckedUpdateInput = {
    sliderStatus: delivery.status,
    sliderSyncedAt: new Date(),
    sliderSyncError: null,
  };
  if (delivery.tracking_url) data.sliderTrackingUrl = delivery.tracking_url;

  // Slider nulls out the driver object as soon as the order is delivered, so
  // only ever write rider details when they're actually present — otherwise
  // the last poll would erase the name and number we'd just captured.
  if (delivery.driver?.name) {
    data.externalDriverName = `${delivery.driver.name} (Slider)`;
    data.externalDriverPhone = delivery.driver.phone_number ?? null;
    // A Slider rider is doing this delivery, so no team driver is.
    data.driverId = null;
  }

  // Pull the photo before flipping the status, so a delivered order is
  // complete the moment Operations sees it. Best effort: if the upload isn't
  // there yet the status still moves, and a later poll picks the photo up —
  // see pendingSliderSyncWhere, which keeps just-delivered orders in the
  // polling set for exactly this reason.
  if (delivery.proof_image) {
    try {
      const existing = await db.photo.findFirst({
        where: { orderId: order.id, type: "DELIVERY" },
        select: { id: true },
      });
      if (!existing) {
        const url = await savePhotoFromUrl(order.id, "DELIVERY", delivery.proof_image);
        await db.photo.create({ data: { orderId: order.id, type: "DELIVERY", url } });
        result.photoSaved = true;
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Couldn't save Slider's photo.";
      data.sliderSyncError = result.error;
    }
  }

  const currentStatus = order.status as OrderStatus;
  const target = SLIDER_TO_ORDER_STATUS[delivery.status as SliderStatus] as OrderStatus | undefined;
  let moves = Boolean(target && PROGRESS[target] > PROGRESS[currentStatus]);

  // A rider being found, or waiting at the shop, says nothing about the
  // bouquet — and riders are now booked while the florist is still working.
  // Moving the order on that news would take it off the florist's screen.
  // Anything from pickup onwards is different: the rider physically has it,
  // so our status follows whatever Slider says.
  if (moves && target === "ASSIGNED_DRIVER" && !shouldPromoteOnAttach(order)) {
    moves = false;
  }

  if (target && moves) {
    data.status = target;
    data.deliveryFailureReason =
      target === "FAILED_DELIVERY" ? sliderFailureReason(delivery.status) : null;
  }

  await db.order.update({ where: { id: order.id }, data });

  if (target && moves) {
    await logStatus(order.id, currentStatus, target, null);
    result.newStatus = target;
  }

  return result;
}

function sliderFailureReason(status: string) {
  if (status === "cancelled") return "Cancelled in Slider";
  return "Slider's rider is returning the order to the shop";
}

/**
 * Which orders the poller should look at.
 *
 * Anything still moving, plus orders delivered recently that have no photo
 * yet — the driver's proof upload regularly lands a little after the status
 * flips, and dropping those orders from the set the instant they're delivered
 * would mean permanently missing the photo.
 */
export function pendingSliderSyncWhere(): Prisma.OrderWhereInput {
  return {
    sliderOrderNumber: { not: null },
    OR: [
      { status: { in: ACTIVE_STATUSES } },
      {
        status: "DELIVERED",
        photos: { none: { type: "DELIVERY" } },
        // Bounded on creation (not updatedAt, which every sync bumps) so a
        // delivery that never gets a photo is chased for a couple of days and
        // then left alone, instead of being polled forever.
        createdAt: { gte: subDays(new Date(), 2) },
      },
    ],
  };
}

/**
 * Syncs every order that needs it.
 *
 * `maxAgeMs` skips orders checked very recently, so the screen-driven refresh
 * (several people with the ops board open, every few seconds) can't multiply
 * into a burst of calls for the same order — the cron passes nothing and
 * always checks.
 */
export async function syncAllSliderOrders(maxAgeMs?: number): Promise<SliderSyncResult[]> {
  const where = pendingSliderSyncWhere();
  if (maxAgeMs) {
    where.AND = [
      {
        OR: [
          { sliderSyncedAt: null },
          { sliderSyncedAt: { lt: new Date(Date.now() - maxAgeMs) } },
        ],
      },
    ];
  }

  const orders = await db.order.findMany({
    where,
    select: {
      id: true,
      trackingToken: true,
      status: true,
      sliderOrderNumber: true,
    },
  });

  // Sequential on purpose: this runs every few minutes against a handful of
  // same-day orders, and a burst of parallel calls buys nothing but a chance
  // of tripping Slider's rate limiting.
  const results: SliderSyncResult[] = [];
  for (const order of orders) {
    results.push(await syncSliderOrder(order));
  }
  return results;
}
