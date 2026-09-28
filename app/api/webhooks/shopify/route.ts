import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db";
import {
  fetchProductImageUrl,
  mapShopifyLineItems,
  mapShopifyOrder,
  verifyShopifyWebhook,
  type ShopifyOrderPayload,
} from "@/lib/shopify";
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

  // Product photos, which the webhook payload never carries — see
  // fetchProductImageUrl. One per line, so a four-item order gives the
  // florist four reference pictures instead of just the first product's.
  // Each returns null on any failure, and nulls are dropped rather than
  // written, so a rate limit or network blip can't blank an image that a
  // previous delivery already resolved.
  const lineItems = mapShopifyLineItems(payload);
  const itemImages = await Promise.all(
    lineItems.map((item) =>
      item.shopifyProductId ? fetchProductImageUrl(item.shopifyProductId) : null
    )
  );
  const itemsToCreate = lineItems.map((item, i) => ({ ...item, referenceImageUrl: itemImages[i] }));

  // Order.referenceImageUrl stays the first line's image: it's what every
  // screen showed before line items existed, and it's still the fallback for
  // orders that have none.
  const referenceImageUrl = itemImages[0] ?? null;
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

    // Lines are filled in once and then left alone. Once they exist,
    // Operations' photos hang off them, so re-creating them on a routine
    // redelivery would orphan those photos. Creating them when there are
    // none also means an order placed before line items existed picks them
    // up from its next redelivery, for free.
    if (itemsToCreate.length > 0) {
      const alreadyHasItems = await db.orderItem.count({ where: { orderId: existing.id } });
      if (alreadyHasItems === 0) {
        await db.orderItem.createMany({
          data: itemsToCreate.map((item) => ({ ...item, orderId: existing.id })),
        });
      }
    }
    return NextResponse.json({ ok: true, orderId: existing.id, deduped: true });
  }

  let created;
  try {
    created = await db.order.create({
      data: {
        ...orderData,
        trackingToken: await createUniqueTrackingToken(),
        items: { create: itemsToCreate },
      },
    });
  } catch (err) {
    // Unique-constraint clash. Either two deliveries for this order raced each
    // other here (harmless — the winner's row is the one we want), or the
    // order number collides with an existing row. Answering 2xx matters more
    // than the row: Shopify disables a webhook after enough consecutive
    // failures, and a permanent 500 here would silently cut off all order
    // intake with nothing to show for it.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      console.error("Shopify webhook: order create conflicted", {
        shopifyOrderId: mapped.shopifyOrderId,
        orderNumber: mapped.orderNumber,
        target: err.meta?.target,
      });
      return NextResponse.json({ ok: true, conflicted: true });
    }
    throw err;
  }

  await db.statusEvent.create({
    data: { orderId: created.id, fromStatus: null, toStatus: status, employeeId: null },
  });

  return NextResponse.json({ ok: true, orderId: created.id });
}
