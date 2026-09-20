import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchProductImageUrl, mapShopifyOrder, verifyShopifyWebhook, type ShopifyOrderPayload } from "@/lib/shopify";
import { createUniqueTrackingToken } from "@/lib/trackingToken";

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

  // The main product's photo, not the webhook payload — see
  // fetchProductImageUrl. Only merged in on success: a transient failure
  // (rate limit, network blip) must never overwrite an already-fetched
  // reference image with nothing on a later retry/update.
  const primaryProductId = payload.line_items?.[0]?.product_id;
  const referenceImageUrl = primaryProductId ? await fetchProductImageUrl(primaryProductId) : null;
  const orderData = referenceImageUrl ? { ...mapped, referenceImageUrl } : mapped;
  const { status, ...updatable } = orderData;

  const existing = await db.order.findUnique({ where: { shopifyOrderId: mapped.shopifyOrderId } });

  if (existing) {
    // Shopify retries deliveries for days after an order is placed —
    // completely normal, and unrelated to whether anything actually
    // changed — so re-parsing the payload here re-applies the *original*
    // Shopify note attributes every time. Once Operations has hand-corrected
    // any of these fields (a typo'd address, a customer-requested date
    // change), re-applying stale Shopify data would silently discard that
    // correction, so editedByOps orders skip this sync — except the
    // reference image, which never overwrites a real photo with nothing
    // (see above), so re-running that fetch can only help.
    if (existing.editedByOps) {
      if (referenceImageUrl) {
        await db.order.update({ where: { id: existing.id }, data: { referenceImageUrl } });
      }
    } else {
      await db.order.update({ where: { id: existing.id }, data: updatable });
    }
    return NextResponse.json({ ok: true, orderId: existing.id, deduped: true });
  }

  const created = await db.order.create({
    data: { ...orderData, trackingToken: await createUniqueTrackingToken() },
  });
  await db.statusEvent.create({
    data: { orderId: created.id, fromStatus: null, toStatus: status, employeeId: null },
  });

  return NextResponse.json({ ok: true, orderId: created.id });
}
