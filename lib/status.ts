export const ORDER_STATUSES = [
  "NEW",
  "ASSIGNED_FLORIST",
  "READY",
  "ASSIGNED_DRIVER",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ACTIVE_STATUSES: OrderStatus[] = [
  "NEW",
  "ASSIGNED_FLORIST",
  "READY",
  "ASSIGNED_DRIVER",
  "OUT_FOR_DELIVERY",
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
  READY: "Ready",
  ASSIGNED_DRIVER: "Waiting for pickup",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const CUSTOMER_TIMELINE: OrderStatus[] = [
  "NEW",
  "ASSIGNED_FLORIST",
  "READY",
  "ASSIGNED_DRIVER",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

// Warmer, sentence-style copy for the public tracking page — used for both
// the big current-status headline and each row of the step-by-step timeline.
export const CUSTOMER_STEP_MESSAGE: Record<OrderStatus, string> = {
  NEW: "We've received your order 🌸",
  ASSIGNED_FLORIST: "Your florist is putting it together",
  READY: "Your bouquet is ready!",
  ASSIGNED_DRIVER: "Packed and waiting for pickup",
  OUT_FOR_DELIVERY: "On its way to you 🚗",
  DELIVERED: "Delivered! Enjoy your flowers 💐",
  CANCELLED: "This order was cancelled",
};

export function isOverdue(deadlineAt: Date | null, status: OrderStatus) {
  if (!deadlineAt) return false;
  if (status === "DELIVERED" || status === "CANCELLED") return false;
  return deadlineAt.getTime() < Date.now();
}

export function isDueSoon(deadlineAt: Date | null, status: OrderStatus) {
  if (!deadlineAt) return false;
  if (status === "DELIVERED" || status === "CANCELLED") return false;
  const msLeft = deadlineAt.getTime() - Date.now();
  return msLeft > 0 && msLeft < 60 * 60 * 1000;
}
