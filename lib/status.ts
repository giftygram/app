export const ORDER_STATUSES = [
  "NEW",
  "ASSIGNED_FLORIST",
  // Internal only. The florist has finished the bouquet and pressed "mark
  // ready"; Operations still has to photograph it. Florists' phone photos
  // weren't good enough to send to a customer, so the photo moved to
  // Operations — but the florist shouldn't have to wait around for them, so
  // the order parks here in between. Nothing customer-facing happens until
  // the photo lands and the order reaches READY: see customerFacingStatus.
  "AWAITING_PHOTO",
  "READY",
  "ASSIGNED_DRIVER",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED_DELIVERY",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Failed deliveries stay "active" — they need Operations to re-dispatch or
// otherwise resolve them, same as anything still moving through the flow.
export const ACTIVE_STATUSES: OrderStatus[] = [
  "NEW",
  "ASSIGNED_FLORIST",
  "AWAITING_PHOTO",
  "READY",
  "ASSIGNED_DRIVER",
  "OUT_FOR_DELIVERY",
  "FAILED_DELIVERY",
];

// What operations sees on the board, and the color used for its chip.
export const STATUS_META: Record<
  OrderStatus,
  { label: string; chip: string; dot: string }
> = {
  NEW: {
    label: "New",
    chip: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
  },
  ASSIGNED_FLORIST: {
    label: "With florist",
    chip: "bg-indigo-50 text-indigo-700 border-indigo-200",
    dot: "bg-indigo-500",
  },
  AWAITING_PHOTO: {
    label: "Needs photo",
    chip: "bg-pink-50 text-pink-700 border-pink-200",
    dot: "bg-pink-500",
  },
  READY: {
    label: "Ready",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  ASSIGNED_DRIVER: {
    label: "Waiting for pickup",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  OUT_FOR_DELIVERY: {
    label: "Out for delivery",
    chip: "bg-violet-50 text-violet-700 border-violet-200",
    dot: "bg-violet-500",
  },
  DELIVERED: {
    label: "Delivered",
    chip: "bg-green-100 text-green-800 border-green-300",
    dot: "bg-green-600",
  },
  FAILED_DELIVERY: {
    label: "Delivery failed",
    chip: "bg-orange-50 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
  },
  CANCELLED: {
    label: "Cancelled",
    chip: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
};

// What the customer sees on the public tracking page — same six stages,
// friendlier words, no shop-internal detail (who, notes, price).
export const CUSTOMER_STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: "Order received",
  ASSIGNED_FLORIST: "Being prepared",
  AWAITING_PHOTO: "Being prepared",
  READY: "Ready",
  ASSIGNED_DRIVER: "Waiting for pickup",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  FAILED_DELIVERY: "Delivery attempt failed",
  CANCELLED: "Cancelled",
};

// Deliberately excludes AWAITING_PHOTO — it's a shop-internal hand-off, not
// a stage a customer should ever be shown. Route every status through
// customerFacingStatus() before using it against this list.
export const CUSTOMER_TIMELINE: OrderStatus[] = [
  "NEW",
  "ASSIGNED_FLORIST",
  "READY",
  "ASSIGNED_DRIVER",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

/**
 * The stage a customer should be shown for an order in a given status.
 *
 * Internal-only statuses map onto the customer-visible stage they sit
 * inside, so the public tracking page looks exactly as it did before that
 * status existed. This matters more than it sounds: the tracking page finds
 * the current step with CUSTOMER_TIMELINE.indexOf(status), and a status
 * missing from that list gives -1 — every step drawn as not-yet-reached, no
 * matter how far along the order really is.
 */
export function customerFacingStatus(status: OrderStatus): OrderStatus {
  // "Mark ready" only ends the florist's part of the job; as far as the
  // customer is concerned the bouquet is still being put together until the
  // photo exists and the order moves to READY.
  return status === "AWAITING_PHOTO" ? "ASSIGNED_FLORIST" : status;
}

// Warmer, sentence-style copy for the public tracking page — used for both
// the big current-status headline and each row of the step-by-step timeline.
export const CUSTOMER_STEP_MESSAGE: Record<OrderStatus, string> = {
  NEW: "We've received your order 🌸",
  ASSIGNED_FLORIST: "Your florist is putting it together",
  AWAITING_PHOTO: "Your florist is putting it together",
  READY: "Your bouquet is ready!",
  ASSIGNED_DRIVER: "Packed and waiting for pickup",
  OUT_FOR_DELIVERY: "On its way to you 🚗",
  DELIVERED: "Delivered! Enjoy your flowers 💐",
  FAILED_DELIVERY: "We couldn't complete delivery — we'll be in touch",
  CANCELLED: "This order was cancelled",
};

const TERMINAL_STATUSES: OrderStatus[] = ["DELIVERED", "FAILED_DELIVERY", "CANCELLED"];

export function isOverdue(deadlineAt: Date | null, status: OrderStatus) {
  if (!deadlineAt) return false;
  if (TERMINAL_STATUSES.includes(status)) return false;
  return deadlineAt.getTime() < Date.now();
}

export function isDueSoon(deadlineAt: Date | null, status: OrderStatus) {
  if (!deadlineAt) return false;
  if (TERMINAL_STATUSES.includes(status)) return false;
  const msLeft = deadlineAt.getTime() - Date.now();
  return msLeft > 0 && msLeft < 60 * 60 * 1000;
}
