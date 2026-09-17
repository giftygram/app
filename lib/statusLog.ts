import { db } from "@/lib/db";
import { trackKlaviyoEvent } from "@/lib/klaviyo";
import type { OrderStatus } from "@/lib/status";

// Metric names Klaviyo's "Order Ready" and "Order Delivered" flows trigger
// on — every status transition funnels through here (the manual "Change
// status" override and the Slider sync included), so this is the one place
// that needs to know about them.
const KLAVIYO_STATUS_METRICS: Partial<Record<OrderStatus, string>> = {
  READY: "Order Ready",
  DELIVERED: "Order Delivered",
};

/**
 * Records a status change and fires the customer email that goes with it.
 *
 * Lives here rather than in app/actions/orders.ts because that file is a
 * "use server" module, where every export has to be a server action — and
 * this needs calling from the Slider sync, which runs in a cron route.
 *
 * `employeeId` is null when nobody on the team did it: an outside courier
 * tapping the /deliver link, or Slider's own driver, whose update we mirror.
 */
export async function logStatus(
  orderId: string,
  fromStatus: string | null,
  toStatus: OrderStatus,
  employeeId: string | null
) {
  await db.statusEvent.create({
    data: { orderId, fromStatus, toStatus, employeeId },
  });

  const metricName = KLAVIYO_STATUS_METRICS[toStatus];
  if (!metricName) return;

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { email: true, orderNumber: true, trackingToken: true },
  });
  if (!order?.email || !order.trackingToken) return;

  await trackKlaviyoEvent(order.email, metricName, {
    OrderNumber: order.orderNumber,
    // The visible code a customer can type in manually — same value as the
    // one baked into TrackingURL below, just spelled out for the email body.
    TrackingCode: order.trackingToken,
    // Stays on giftygram.ae — the /pages/track Liquid template iframes
    // app.giftygram.ae/track/<token>, keyed off this ?order= param. Uses the
    // random trackingToken, not orderNumber: order numbers are sequential
    // and guessable, so a link built from one would let anyone enumerate
    // other customers' orders. (App Proxy would be the cleaner fix but is
    // currently broken on Shopify's end; see next.config.ts.)
    TrackingURL: `https://giftygram.ae/pages/track?order=${encodeURIComponent(order.trackingToken)}`,
  });
}
