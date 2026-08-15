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
};

export type ShopifyOrderPayload = {
  id: number | string;
  name: string;
  note?: string | null;
  note_attributes?: { name?: string | null; value?: string | null }[] | null;
  email?: string | null;
  phone?: string | null;
  shipping_address?: ShopifyAddress | null;
  billing_address?: ShopifyAddress | null;
  line_items?: ShopifyLineItem[] | null;
};

/** Note attributes come in as an array of {name, value} — flatten to a map, matched case-insensitively since checkout field labels can vary slightly. */
function noteAttributeMap(attrs: ShopifyOrderPayload["note_attributes"]) {
  const map = new Map<string, string>();
  for (const attr of attrs ?? []) {
    if (attr?.name && attr.value != null) {
      map.set(attr.name.trim().toLowerCase(), attr.value.trim());
    }
  }
  return (key: string) => map.get(key.toLowerCase()) || null;
}

/** "6:00 PM - 9:00 PM" → 21:00. Combined with the delivery date for deadlineAt. */
function parseDeadline(dateStr: string | null, timeWindow: string | null): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;

  const endTime = timeWindow?.split("-")[1]?.trim();
  const match = endTime?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  const [y, m, d] = dateStr.split("-").map(Number);
  if (!match) return fromDubaiComponents(y, m, d, 23, 59);

  let hour = parseInt(match[1], 10) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return fromDubaiComponents(y, m, d, hour, parseInt(match[2], 10));
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
    status: "NEW" as const,
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
  };
}
