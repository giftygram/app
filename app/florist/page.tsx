import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { isOverdue, isDueSoon, type OrderStatus } from "@/lib/status";
import { cn } from "@/lib/cn";

export default async function FloristQueuePage() {
  const session = await requireRole("FLORIST");

  const [toDo, doneToday] = await Promise.all([
    db.order.findMany({
      where: { floristId: session.employeeId, status: "ASSIGNED_FLORIST" },
      orderBy: [{ deadlineAt: "asc" }, { createdAt: "asc" }],
    }),
    db.order.findMany({
      where: {
        floristId: session.employeeId,
        status: { in: ["READY", "ASSIGNED_DRIVER", "OUT_FOR_DELIVERY", "DELIVERED"] },
        updatedAt: { gte: startOfToday() },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
          To make ({toDo.length})
        </h2>
        {toDo.length === 0 ? (
          <p className="text-sm text-muted py-8 text-center">Nothing waiting on you right now 🌸</p>
        ) : (
          toDo.map((order) => {
            const overdue = isOverdue(order.deadlineAt, order.status as OrderStatus);
            const dueSoon = isDueSoon(order.deadlineAt, order.status as OrderStatus);
            return (
              <Link
                key={order.id}
                href={`/florist/orders/${order.id}`}
                className={cn(
                  "rounded-2xl border bg-surface px-4 py-4 hover:border-brand transition-colors",
                  overdue ? "border-red-300" : "border-line"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {order.orderNumber}
                  </span>
                  {overdue && <span className="text-xs font-semibold text-red-600">Overdue</span>}
                  {!overdue && dueSoon && (
                    <span className="text-xs font-semibold text-amber-600">Due soon</span>
                  )}
                </div>
                {order.bouquetName && (
                  <p className="text-sm font-medium text-foreground mt-1">{order.bouquetName}</p>
                )}
                {order.occasion && <p className="text-sm text-muted mt-0.5">{order.occasion}</p>}
                {order.deadlineAt && (
                  <p className="text-xs text-muted mt-1">
                    Deliver by{" "}
                    {order.deadlineAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                )}
              </Link>
            );
          })
        )}
      </section>

      {doneToday.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Done today</h2>
          {doneToday.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl border border-line bg-surface/60 px-4 py-3 flex items-center justify-between"
            >
              <span className="font-mono text-sm text-muted">{order.orderNumber}</span>
              <span className="text-xs text-muted">Ready ✓</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
