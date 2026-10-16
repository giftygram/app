import { db } from "@/lib/db";
import { requireOpsAccess } from "@/lib/auth";
import { addDays, formatDateLabel, formatDeliveryWindow, fromDateParam, startOfDay, toDateParam } from "@/lib/date";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/status";
import { DayPrintSheet, type PrintableOrder } from "@/components/day-print-sheet";
import "../orders/[id]/print.css";

/**
 * Every card for one day's deliveries, on one page, as one PDF.
 *
 * Cancelled orders are never printed, and delivered ones are left out by
 * default — the point is the pile still to go out. `status` and `slot`
 * mirror the board's own filters so "print what I'm looking at" works.
 */
export default async function DayPrintPage(props: PageProps<"/print/day">) {
  await requireOpsAccess();
  const searchParams = await props.searchParams;

  const param = (key: string) =>
    typeof searchParams[key] === "string" ? (searchParams[key] as string) : undefined;

  const selectedDate = fromDateParam(param("date"));
  const dayStart = selectedDate;
  const dayEnd = addDays(selectedDate, 1);
  const status = param("status");
  const slot = param("slot");

  // Identical bucketing to the board: an order with no delivery date at all
  // belongs to the day it came in, otherwise it would print on no day.
  const dateWhere = {
    OR: [
      { deadlineAt: { gte: dayStart, lt: dayEnd } },
      { AND: [{ deadlineAt: null }, { createdAt: { gte: dayStart, lt: dayEnd } }] },
    ],
  };

  // A concrete status prints exactly that stage. Everything else — "All",
  // "Not delivered", "Active", or no filter at all — prints what's still to
  // go out, because that's what cards are for.
  const statusWhere = ORDER_STATUSES.includes(status as OrderStatus)
    ? { status }
    : { status: { notIn: ["DELIVERED", "CANCELLED"] } };

  const orders = await db.order.findMany({
    where: { AND: [dateWhere, statusWhere, slot ? { deliveryTimeSlot: slot } : {}] },
    include: { florist: true, driver: true },
    // Same ordering as the board, so the printed stack comes out in the
    // order the screen listed them — a run is checked against the screen.
    orderBy: [{ deadlineAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 200,
  });

  const printable: PrintableOrder[] = orders.map((order) => ({
    orderId: order.id,
    orderNumber: order.orderNumber,
    bouquetName: order.bouquetName,
    occasion: order.occasion,
    deliverBy: order.deadlineAt ? formatDeliveryWindow(order.deadlineAt, order.deliveryTimeSlot) : null,
    customerNote: order.notes,
    cardMessage: order.cardMessage,
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    deliveryAddress: order.deliveryAddress,
    deliveryArea: order.deliveryArea,
    senderName: order.senderName,
    senderPhone: order.senderPhone,
    floristName: order.florist?.name ?? null,
    driverLabel: order.driver?.name ?? order.externalDriverName ?? null,
    isExternalDriver: !order.driverId && !!order.externalDriverName,
  }));

  const dateParam = toDateParam(selectedDate);
  const backHref = `/ops?date=${dateParam}${status ? `&status=${status}` : ""}${slot ? `&slot=${encodeURIComponent(slot)}` : ""}`;

  if (printable.length === 0) {
    return (
      <main className="flex-1 flex items-center justify-center bg-background px-4 py-16">
        <div className="text-center">
          <p className="text-foreground font-medium">Nothing to print for this day.</p>
          <p className="text-sm text-muted mt-1">
            No orders are waiting to go out on {formatDateLabel(selectedDate, startOfDay(new Date()))}.
          </p>
          <a href={backHref} className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
            ← Back to orders
          </a>
        </div>
      </main>
    );
  }

  return (
    <DayPrintSheet
      orders={printable}
      dateLabel={formatDateLabel(selectedDate, startOfDay(new Date()))}
      fileLabel={dateParam}
      backHref={backHref}
    />
  );
}
