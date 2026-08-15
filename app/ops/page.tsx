import Link from "next/link";
import { db } from "@/lib/db";
import { StatusChip } from "@/components/status-chip";
import { DateNav } from "@/components/date-nav";
import { DayStats } from "@/components/day-stats";
import { ACTIVE_STATUSES, isOverdue, isDueSoon, type OrderStatus } from "@/lib/status";
import { effectiveApproval } from "@/lib/approval";
import { addDays, fromDateParam, startOfDay, toDateParam } from "@/lib/date";
import { cn } from "@/lib/cn";

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "READY", label: "Ready" },
  { key: "ASSIGNED_DRIVER", label: "Waiting for pickup" },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "FAILED_DELIVERY", label: "Failed" },
  { key: "active", label: "Active" },
];

export default async function OpsBoardPage(props: PageProps<"/ops">) {
  const searchParams = await props.searchParams;
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";

  if (q) {
    const results = await db.order.findMany({
      where: {
        OR: [
          { orderNumber: { contains: q } },
          { recipientName: { contains: q } },
          { recipientPhone: { contains: q } },
          { senderPhone: { contains: q } },
        ],
      },
      include: { florist: true, driver: true },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
    });
    return (
      <div className="flex flex-col gap-5">
        <SearchBar q={q} />
        <p className="text-sm text-muted">
          {results.length} result{results.length === 1 ? "" : "s"} for &ldquo;{q}&rdquo; ·{" "}
          <Link href="/ops" className="text-brand hover:underline">
            Clear search
          </Link>
        </p>
        <OrderList orders={results} emptyMessage="No orders match that search." />
      </div>
    );
  }

  const today = startOfDay(new Date());
  const selectedDate = fromDateParam(typeof searchParams.date === "string" ? searchParams.date : undefined);
  const dayStart = selectedDate;
  const dayEnd = addDays(selectedDate, 1);
  const filter = typeof searchParams.status === "string" ? searchParams.status : "all";

  const dateWhere = {
    OR: [
      { deadlineAt: { gte: dayStart, lt: dayEnd } },
      { AND: [{ deadlineAt: null }, { createdAt: { gte: dayStart, lt: dayEnd } }] },
    ],
  };

  let statusWhere: Record<string, unknown> = {};
  if (filter === "active") {
    statusWhere = { status: { in: ACTIVE_STATUSES } };
  } else if (filter !== "all") {
    statusWhere = { status: filter };
  }

  const [dayOrders, orders] = await Promise.all([
    db.order.findMany({ where: dateWhere, select: { status: true } }),
    db.order.findMany({
      where: { AND: [dateWhere, statusWhere] },
      include: { florist: true, driver: true },
      orderBy: [{ deadlineAt: "asc" }, { createdAt: "asc" }],
      take: 200,
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const o of dayOrders) counts[o.status] = (counts[o.status] ?? 0) + 1;

  return (
    <div className="flex flex-col gap-5">
      <SearchBar q={q} />

      <div className="flex flex-col gap-2">
        <DateNav selectedDate={selectedDate} today={today} basePath="/ops" />
        <DayStats counts={counts} total={dayOrders.length} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/ops?date=${toDateParam(selectedDate)}&status=${f.key}`}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              filter === f.key
                ? "bg-brand text-brand-ink border-brand"
                : "border-line text-muted hover:text-foreground"
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <OrderList orders={orders} emptyMessage="No orders on this day." />
    </div>
  );
}

function SearchBar({ q }: { q: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <form className="flex-1">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search order #, name, or phone"
          className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </form>
      <Link
        href="/ops/new"
        className="shrink-0 rounded-xl bg-brand text-brand-ink px-4 py-2.5 text-sm font-semibold shadow-sm hover:opacity-90 transition"
      >
        + New order
      </Link>
    </div>
  );
}

type OrderRow = Awaited<ReturnType<typeof db.order.findMany<{ include: { florist: true; driver: true } }>>>[number];

function OrderList({ orders, emptyMessage }: { orders: OrderRow[]; emptyMessage: string }) {
  // Overdue and due-soon orders float to the top so ops never miss them.
  const sorted = [...orders].sort((a, b) => {
    const score = (o: OrderRow) => {
      const status = o.status as OrderStatus;
      if (isOverdue(o.deadlineAt, status)) return 0;
      if (isDueSoon(o.deadlineAt, status)) return 1;
      return 2;
    };
    return score(a) - score(b);
  });

  if (sorted.length === 0) {
    return (
      <div className="text-center py-16 text-muted">
        <p className="text-3xl mb-2">🌿</p>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {sorted.map((order) => {
        const status = order.status as OrderStatus;
        const overdue = isOverdue(order.deadlineAt, status);
        const dueSoon = isDueSoon(order.deadlineAt, status);
        const awaitingApproval = status === "READY" && effectiveApproval(order) === "PENDING";
        return (
          <li key={order.id}>
            <Link
              href={`/ops/orders/${order.id}`}
              className={cn(
                "block rounded-xl border bg-surface px-4 py-3.5 hover:border-brand transition-colors",
                overdue ? "border-red-300" : "border-line"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {order.orderNumber}
                    </span>
                    <span className="text-[11px] uppercase tracking-wide text-muted border border-line rounded px-1.5 py-0.5">
                      {order.source === "SHOPIFY" ? "Shopify" : "WhatsApp"}
                    </span>
                    {overdue && <span className="text-[11px] font-semibold text-red-600">Overdue</span>}
                    {!overdue && dueSoon && (
                      <span className="text-[11px] font-semibold text-amber-600">Due soon</span>
                    )}
                    {awaitingApproval && (
                      <span className="text-[11px] font-semibold text-amber-600">Awaiting approval</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground mt-1 truncate">{order.recipientName}</p>
                  {order.bouquetName && (
                    <p className="text-sm font-medium text-brand truncate">{order.bouquetName}</p>
                  )}
                  <p className="text-xs text-muted mt-0.5">
                    {order.florist ? `Florist: ${order.florist.name}` : "No florist yet"}
                    {order.driver ? ` · Driver: ${order.driver.name}` : ""}
                    {!order.driver && order.externalDriverName ? ` · Driver: ${order.externalDriverName}` : ""}
                  </p>
                </div>
                <StatusChip status={status} />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
