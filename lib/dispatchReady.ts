import { db } from "@/lib/db";
import { logStatus } from "@/lib/statusLog";
import type { OrderStatus } from "@/lib/status";

/**
 * Booking transport before the bouquet exists.
 *
 * Operations wants the rider lined up while the florist is still working,
 * rather than waiting for "ready" and then starting the search — but a
 * courier being *attached* and an order being *out for delivery* are two
 * different facts, and this app had them in one status field.
 *
 * So attaching a driver (or a Slider rider) no longer moves the order. The
 * status still describes where the bouquet actually is, and the order is
 * promoted to "waiting for pickup" only once it's genuinely ready to hand
 * over — which is what promoteDispatchReadyOrders does, below.
 */

/** Statuses where attaching a courier makes sense at all. */
const ATTACHABLE: OrderStatus[] = [
  "NEW",
  "ASSIGNED_FLORIST",
  "AWAITING_PHOTO",
  "READY",
  "ASSIGNED_DRIVER",
];

export function canAttachCourier(status: string) {
  return ATTACHABLE.includes(status as OrderStatus);
}

export function assertCanAttachCourier(order: { status: string }) {
  if (!canAttachCourier(order.status)) {
    throw new Error("This order is past the point where a driver can be assigned.");
  }
}

type PromotableOrder = {
  status: string;
};

/**
 * Whether attaching a courier right now should also move the order to
 * "waiting for pickup".
 *
 * Only from READY: before that the bouquet doesn't exist yet, and the
 * florist's queue is `status = ASSIGNED_FLORIST`, so moving the order would
 * take it off their screen.
 *
 * AWAITING_PHOTO is excluded on purpose. The bouquet is made, but promoting
 * it would hand the order to a driver before Operations has photographed it
 * — and once it leaves the shop that photo can't be taken at all. It also
 * skips READY, and with it the "your bouquet is ready" email.
 */
export function shouldPromoteOnAttach(order: PromotableOrder) {
  return order.status === "READY";
}

/**
 * Moves ready orders that already have a courier attached into "waiting for
 * pickup".
 *
 * Marking ready normally does this itself. This is the backstop for the other
 * routes into READY — an Operations status override, a re-dispatch after a
 * failed delivery — so a pre-booked order still reaches the driver's queue
 * without anyone remembering to nudge it.
 */
export async function promoteDispatchReadyOrders(): Promise<string[]> {
  const candidates = await db.order.findMany({
    where: {
      status: "READY",
      OR: [
        { driverId: { not: null } },
        { externalDriverName: { not: null } },
        { sliderOrderNumber: { not: null } },
      ],
    },
    select: { id: true, status: true },
  });

  const promoted: string[] = [];
  for (const order of candidates) {
    if (!shouldPromoteOnAttach(order)) continue;
    await db.order.update({ where: { id: order.id }, data: { status: "ASSIGNED_DRIVER" } });
    await logStatus(order.id, "READY", "ASSIGNED_DRIVER", null);
    promoted.push(order.id);
  }
  return promoted;
}
