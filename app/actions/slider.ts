"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { syncAllSliderOrders, syncSliderOrder } from "@/lib/sliderSync";
import { SliderError, type SliderVehicleOption } from "@/lib/slider";
import { pinPreviewLink } from "@/lib/mapsLink";
import { promoteDispatchReadyOrders } from "@/lib/dispatchReady";
import {
  dispatchOrderToSlider,
  quoteSliderForOrder,
  type DispatchOutcome,
} from "@/lib/sliderDispatch";

/**
 * Linking an order to its Slider delivery.
 *
 * This replaces the sticky note — "Order #2315 / Slider: 7716" — with one
 * field. Slider's dashboard doesn't carry our order number (orders are placed
 * there by hand, so the API's own `order_id` reference comes back null), which
 * leaves the Slider order number as the only thing joining the two records.
 * Type it once and every status update and the delivery photo follow by
 * themselves.
 */
export async function linkSliderOrderAction(orderId: string, formData: FormData) {
  await requireRole("OPERATIONS");

  // Slider shows it as "#64542958" on screen and in its order list, so accept
  // the hash, and the spaces that come with copy-paste.
  const raw = String(formData.get("sliderOrderNumber") ?? "")
    .trim()
    .replace(/^#/, "")
    .replace(/\s+/g, "");

  if (!/^\d{4,12}$/.test(raw)) {
    throw new Error("Enter Slider's order number — the 8-digit one, e.g. 64542958.");
  }

  // Two of our orders pointing at one Slider delivery would quietly mirror the
  // same rider and the same delivery photo onto both, which is worse than not
  // linking at all — the unique index stops it, and this turns that into
  // something Operations can act on.
  const clash = await db.order.findUnique({
    where: { sliderOrderNumber: raw },
    select: { orderNumber: true },
  });
  if (clash) {
    throw new Error(`Slider #${raw} is already linked to order ${clash.orderNumber}.`);
  }

  const order = await db.order.update({
    where: { id: orderId },
    data: { sliderOrderNumber: raw, sliderSyncError: null },
    select: {
      id: true,
      trackingToken: true,
      status: true,
      sliderOrderNumber: true,
    },
  });

  // Sync immediately rather than waiting for the next poll: Operations is
  // looking at the screen right now, and a wrong number should come back as
  // "Slider has no order with that number" while they still have Slider open.
  await syncSliderOrder(order);

  revalidateOrder(orderId, order.trackingToken);
}

/** Wrong number typed, or the delivery was re-placed in Slider under a new one. */
export async function unlinkSliderOrderAction(orderId: string) {
  await requireRole("OPERATIONS");

  const order = await db.order.update({
    where: { id: orderId },
    data: {
      sliderOrderNumber: null,
      sliderStatus: null,
      sliderTrackingUrl: null,
      sliderSyncedAt: null,
      sliderSyncError: null,
    },
    select: { trackingToken: true },
  });

  revalidateOrder(orderId, order.trackingToken);
}

/** "Sync now" — for when Operations doesn't want to wait for the poller. */
export async function syncSliderOrderAction(orderId: string) {
  await requireRole("OPERATIONS");

  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      id: true,
      trackingToken: true,
      status: true,
      sliderOrderNumber: true,
    },
  });

  await syncSliderOrder(order);

  revalidateOrder(orderId, order.trackingToken);
}

function revalidateOrder(orderId: string, trackingToken: string) {
  revalidatePath("/ops");
  revalidatePath(`/ops/orders/${orderId}`);
  revalidatePath("/driver");
  revalidatePath(`/deliver/${orderId}`);
  revalidatePath(`/track/${encodeURIComponent(trackingToken)}`);
}

/**
 * Screen-driven refresh, called from the ops board and order pages every few
 * seconds while someone is looking (see SliderLiveRefresh).
 *
 * The cron behind /api/cron/slider-sync is the safety net for deliveries that
 * finish when nobody's at a screen; this is what makes the board feel live
 * without depending on how often the host lets a cron run. Returns whether
 * anything actually changed, so the client only re-renders when there's
 * something new to show.
 */
export async function refreshSliderOrdersAction(): Promise<boolean> {
  await requireRole("OPERATIONS");

  // Skip orders checked in the last 15 seconds: with several people on the
  // board, un-throttled ticks would hammer Slider for the same few orders.
  const results = await syncAllSliderOrders(15_000);
  const promoted = await promoteDispatchReadyOrders();
  const changed = results.filter((result) => result.newStatus || result.photoSaved);
  if (changed.length === 0 && promoted.length === 0) return false;

  revalidatePath("/ops");
  revalidatePath("/driver");
  for (const result of changed) {
    revalidatePath(`/ops/orders/${result.orderId}`);
    revalidatePath(`/deliver/${result.orderId}`);
  }

  const orders = await db.order.findMany({
    where: { id: { in: changed.map((result) => result.orderId) } },
    select: { trackingToken: true },
  });
  for (const order of orders) {
    revalidatePath(`/track/${encodeURIComponent(order.trackingToken)}`);
  }

  return true;
}

/* ------------------------------------------------------------------ *
 * Ordering a Slider rider from here
 * ------------------------------------------------------------------ */

const DISPATCH_SELECT = {
  id: true,
  orderNumber: true,
  trackingToken: true,
  status: true,
  recipientName: true,
  recipientPhone: true,
  deliveryAddress: true,
  deliveryArea: true,
  mapsLink: true,
  sliderOrderNumber: true,
} as const;

export type SliderQuoteResult =
  | {
      ok: true;
      distanceKm: number;
      durationMinutes: number;
      pinPreview: string;
      /** True when the pin came from the map's centre rather than the place
       *  itself — close, but worth a second look before dispatching. */
      pinIsApproximate: boolean;
      address: string;
      recipientPhone: string;
      vehicles: SliderVehicleOption[];
    }
  | { ok: false; error: string };

/**
 * Prices the delivery so Operations can choose. Costs nothing and sends
 * nothing — the wallet is only touched by orderSliderDeliveryAction.
 */
export async function quoteSliderDeliveryAction(orderId: string): Promise<SliderQuoteResult> {
  await requireRole("OPERATIONS");

  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    select: DISPATCH_SELECT,
  });

  try {
    const { dropoff, fare } = await quoteSliderForOrder(order);
    return {
      ok: true,
      distanceKm: fare.distance_km,
      durationMinutes: fare.duration_minutes,
      pinPreview: pinPreviewLink(dropoff),
      pinIsApproximate: dropoff.pinSource === "viewport",
      address: dropoff.address,
      recipientPhone: dropoff.contactNumber,
      vehicles: fare.vehicles,
    };
  } catch (error) {
    if (error instanceof SliderError) return { ok: false, error: error.message };
    throw error;
  }
}

/**
 * Sends the rider. This is the call that spends from the Slider wallet, so
 * it re-checks the price against what Operations was shown and refuses
 * rather than quietly charging a different amount.
 */
export async function orderSliderDeliveryAction(
  orderId: string,
  vehicleType: "bike" | "car" | "any",
  expectedFare: number
): Promise<DispatchOutcome> {
  const session = await requireRole("OPERATIONS");

  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    select: DISPATCH_SELECT,
  });

  const outcome = await dispatchOrderToSlider(order, vehicleType, expectedFare, session.employeeId);
  if (outcome.ok) revalidateOrder(orderId, order.trackingToken);
  return outcome;
}
