/** wa.me needs the full international number as digits only, no "+". */
export function whatsappLink(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export const DRIVER_PICKUP_MESSAGE =
  "Hello!\n\nI have now picked up your order from giftygram.ae and on my way to you.\n\nI will text you when I arrive.";

export const OPS_LOCATION_REQUEST_MESSAGE =
  "Hello, someone sent you gift/flowers from giftygram.ae\n\nCould you please share your pin location for delivery?";
