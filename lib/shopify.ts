import { createHmac, timingSafeEqual } from "crypto";
import { fromDubaiComponents } from "@/lib/date";

/**
 * Verifies the `X-Shopify-Hmac-Sha256` header against the raw request body.
 * Must run on the raw (unparsed) body text — the signature is computed over
 * the exact bytes Shopify sent, not a re-serialized JSON.parse/stringify.
 */
export function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret || !hmacHeader) return false;

  const computed = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

  const a = Buffer.from(computed);
  const b = Buffer.from(hmacHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}

type ShopifyAddress = {
  name?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  phone?: string | null;
};

type ShopifyLineItem = {
  name?: string | null;
  quantity?: number | null;
  product_id?: number | string | null;
};

export type ShopifyOrderPayload = {
  id: number | string;
  name: string;
  // Shopify's own random order token — the one behind order_status_url.
  // Stored so the order-confirmation email can link a customer straight to
  // their tracking page: Shopify renders that email the moment checkout
  // completes, before our webhook has created the order here, so it can't
  // reference our trackingToken — but it always has this one.
  token?: string | null;
  note?: string | null;
  note_attributes?: { name?: string | null; value?: string | null }[] | null;
  email?: string | null;
  phone?: string | null;
  shipping_address?: ShopifyAddress | null;
  billing_address?: ShopifyAddress | null;
  line_items?: ShopifyLineItem[] | null;
};

/** Note attributes come in as an array of {name, value} — flatten to a map, matched case-insensitively since checkout field labels can vary slightly. */
export function noteAttributeMap(attrs: ShopifyOrderPayload["note_attributes"]) {
  const map = new Map<string, string>();
  for (const attr of attrs ?? []) {
    if (attr?.name && attr.value != null) {
      map.set(attr.name.trim().toLowerCase(), attr.value.trim());
    }
  }
  return (key: string) => map.get(key.toLowerCase()) || null;
}

/**
 * Checkout's delivery-date picker sends "DD-MM-YYYY" (e.g. "19-09-2026"),
 * not ISO order — confirmed against real Shopify order payloads after
 * orders with a chosen delivery date were silently landing with a null
 * deadline (and falling back to being sorted by createdAt, i.e. "today").
 * YYYY-MM-DD is also accepted in case that ever changes back.
 */
function parseDateComponents(dateStr: string): [number, number, number] | null {
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return [+iso[1], +iso[2], +iso[3]];

  const dmy = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return [+dmy[3], +dmy[2], +dmy[1]];

  return null;
}

/** "6:00 PM - 9:00 PM" → 21:00. Combined with the delivery date for deadlineAt. */
export function parseDeadline(dateStr: string | null, timeWindow: string | null): Date | null {
  const components = dateStr ? parseDateComponents(dateStr) : null;
  if (!components) return null;
  const [y, m, d] = components;

  const endTime = timeWindow?.split("-")[1]?.trim();
  const match = endTime?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) return fromDubaiComponents(y, m, d, 12, 0);

  let hour = parseInt(match[1], 10) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  const minute = parseInt(match[2], 10);

  // "12:00 AM" as a window's *end* time (e.g. "9:00 PM - 12:00 AM") means
  // midnight at the close of that day, not the start of it — the same
  // calendar day's delivery, just its very last moment. Using the instant
  // exactly at the next day's 00:00 (rather than 1ms before it) used to
  // push these orders into tomorrow's date bucket everywhere the app
  // groups orders by day, making a delivery scheduled for tonight
  // disappear from today's list.
  if (hour === 0) {
    return new Date(fromDubaiComponents(y, m, d, 0, minute).getTime() + 24 * 60 * 60 * 1000 - 1);
  }
  return fromDubaiComponents(y, m, d, hour, minute);
}

/** Maps a Shopify order payload to our Order.create() input. */
export function mapShopifyOrder(order: ShopifyOrderPayload) {
  const attr = noteAttributeMap(order.note_attributes);

  const recipient = order.shipping_address ?? order.billing_address ?? null;
  const recipientName = recipient?.name?.trim() || "Unknown recipient";
  const recipientPhone = recipient?.phone?.trim() || order.phone?.trim() || "";
  const deliveryAddress =
    [recipient?.address1, recipient?.address2].filter(Boolean).join(", ") || "Address not provided";
  const deliveryArea = recipient?.city?.trim() || null;

  const lineItems = order.line_items ?? [];
  const bouquetName =
    lineItems
      .map((li) => li.name?.trim())
      .filter(Boolean)
      .join(", ") || null;

  const deliveryMethodRaw = attr("Delivery Method");
  const deliveryMethod = deliveryMethodRaw
    ? deliveryMethodRaw.toLowerCase().includes("pickup")
      ? "PICKUP"
      : "DELIVERY"
    : null;

  const notesParts = [order.note?.trim() || null].filter(Boolean);

  return {
    orderNumber: order.name,
    source: "SHOPIFY" as const,
    shopifyOrderId: String(order.id),
    shopifyOrderToken: order.token?.trim() || null,
    status: "NEW" as const,
    email: order.email?.trim() || null,
    senderName: attr("Sender Name"),
    senderPhone: attr("Sender Phone"),
    recipientName,
    recipientPhone,
    deliveryAddress,
    deliveryArea,
    deliveryMethod,
    cardMessage: attr("Gift Message"),
    bouquetName,
    notes: notesParts.length > 0 ? notesParts.join("\n") : null,
    deadlineAt: parseDeadline(attr("Delivery Date"), attr("Delivery Time")),
    deliveryTimeSlot: attr("Delivery Time"),
  };
}

/**
 * The order webhook's line_items only ever carry a product_id/variant_id,
 * never an image — Shopify has to be asked separately for the product's
 * photo. Used as the florist's reference image, since a bouquet name alone
 * ("Customized Letter – Red Roses Bouquet") isn't enough to go on. Returns
 * null on any failure (missing credentials, deleted product, rate limit,
 * etc.) so a hiccup here never blocks the order itself from being saved.
 */
export async function fetchProductImageUrl(productId: number | string): Promise<string | null> {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!domain || !token) return null;

  try {
    const res = await fetch(`https://${domain}/admin/api/2026-07/products/${productId}.json?fields=image`, {
      headers: { "X-Shopify-Access-Token": token },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.product?.image?.src ?? null;
  } catch {
    return null;
  }
}
