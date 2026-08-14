import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapShopifyOrder, verifyShopifyWebhook, type ShopifyOrderPayload } from "@/lib/shopify";

// Shopify expects a fast 2xx response and retries (with backoff, then
// disables the webhook after enough consecutive failures) on anything else —
// so every branch below responds quickly rather than doing slow work first.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const hmac = request.headers.get("x-shopify-hmac-sha256");

  if (!verifyShopifyWebhook(rawBody, hmac)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: ShopifyOrderPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.id || !payload.name) {
    return NextResponse.json({ error: "Missing order id/name" }, { status: 400 });
  }

  const mapped = mapShopifyOrder(payload);
  const { status, ...updatable } = mapped;

  const existing = await db.order.findUnique({ where: { shopifyOrderId: mapped.shopifyOrderId } });

  if (existing) {
    // Shopify retries deliveries — update the descriptive fields in case the
    // order changed, but never touch status/assignment; Operations may
    // already be partway through fulfilling it.
    await db.order.update({ where: { id: existing.id }, data: updatable });
    return NextResponse.json({ ok: true, orderId: existing.id, deduped: true });
  }

  const created = await db.order.create({ data: mapped });
  await db.statusEvent.create({
    data: { orderId: created.id, fromStatus: null, toStatus: status, employeeId: null },
  });

  return NextResponse.json({ ok: true, orderId: created.id });
}
