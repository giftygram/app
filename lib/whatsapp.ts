/**
 * Normalizes the phone formats staff actually paste in — local UAE numbers
 * with a trunk "0" (with or without spaces/dashes), "00"-prefixed
 * international dialing, already-E.164 UAE numbers, and foreign numbers
 * that already carry their own country code (+1, +44, ...) — into a bare
 * digit string with country code, no "+", no leading trunk zero.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return "971" + digits.slice(1);
  return digits;
}

/** wa.me needs the full international number as digits only, no "+". */
export function whatsappLink(phone: string, message: string) {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

export const DRIVER_PICKUP_MESSAGE =
  "Hello!\n\nI have now picked up your order from giftygram.ae and on my way to you.\n\nI will text you when I arrive.";

export const OPS_LOCATION_REQUEST_MESSAGE =
  "Hello, someone sent you gift/flowers from giftygram.ae\n\nCould you please share your pin location for delivery?";
