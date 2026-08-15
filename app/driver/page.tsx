import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { StatusChip } from "@/components/status-chip";
import { isOverdue, isDueSoon, type OrderStatus } from "@/lib/status";
import { startOfDay } from "@/lib/date";
import { cn } from "@/lib/cn";

export default async function DriverQueuePage() {
  const session = await requireRole("DRIVER");

  const [toDo, doneToday] = await Promise.all([
    db.order.findMany({
      where: { driverId: session.employeeId, status: { in: ["ASSIGNED_DRIVER", "OUT_FOR_DELIVERY"] } },
      include: { photos: { where: { type: "BOUQUET" }, orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: [{ deadlineAt: "asc" }, { createdAt: "asc" }],
    }),
    db.order.findMany({
      where: { driverId: session.employeeId, status: "DELIVERED", updatedAt: { gte: startOfDay(new Date()) } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
          To deliver ({toDo.length})
        </h2>
        {toDo.length === 0 ? (
          <p className="text-sm text-muted py-8 text-center">No deliveries waiting on you 🚗</p>
        ) : (
          toDo.map((order) => {
            const status = order.status as OrderStatus;
            const overdue = isOverdue(order.deadlineAt, status);
            const dueSoon = isDueSoon(order.deadlineAt, status);
            const bouquetPhoto = order.photos[0];
            return (
              <Link
                key={order.id}
                href={`/driver/orders/${order.id}`}
                className={cn(
                  "flex gap-3 rounded-2xl border bg-surface px-4 py-4 hover:border-brand transition-colors",
                  overdue ? "border-red-300" : "border-line"
                )}
              >
                {bouquetPhoto ? (
                  <div className="relative h-16 w-16 shrink-0 rounded-xl overflow-hidden border border-line">
                    <Image src={bouquetPhoto.url} alt="" fill className="object-cover" />
                  </div>
                ) : (
                  <div className="h-16 w-16 shrink-0 rounded-xl border border-dashed border-line flex items-center justify-center text-xl">
                    💐
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {order.orderNumber}
                    </span>
                    <StatusChip status={status} />
                  </div>
                  <p className="text-sm text-foreground mt-1 truncate">{order.recipientName}</p>
                  {order.bouquetName && (
                    <p className="text-sm font-medium text-brand truncate">{order.bouquetName}</p>
                  )}
                  <p className="text-xs text-muted mt-0.5 truncate">
                    {order.deliveryArea ? `${order.deliveryArea} — ` : ""}
                    {order.deliveryAddress}
                  </p>
                  {overdue && <p className="text-xs font-semibold text-red-600 mt-1">Overdue</p>}
                  {!overdue && dueSoon && (
                    <p className="text-xs font-semibold text-amber-600 mt-1">Due soon</p>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </section>

      {doneToday.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Delivered today</h2>
          {doneToday.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl border border-line bg-surface/60 px-4 py-3 flex items-center justify-between"
            >
              <span className="font-mono text-sm text-muted">{order.orderNumber}</span>
              <span className="text-xs text-muted">Delivered ✓</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
