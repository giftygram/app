import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { isOverdue, type OrderStatus } from "@/lib/status";
import { cn } from "@/lib/cn";

const STUCK_STATUSES = ["ASSIGNED_DRIVER", "OUT_FOR_DELIVERY"];
// Below this, one or two orders can swing a percentage from 0% to 100% and
// back — not enough of a pattern yet to flag someone over.
const MIN_ORDERS_FOR_COURIERS = 3;

type OrderForStats = {
  id: string;
  status: string;
  deadlineAt: Date | null;
  statusEvents: { toStatus: string; employeeId: string | null }[];
};

function computeStats(assigned: OrderForStats[], selfEmployeeId: string | null) {
  const withOfd = assigned.filter((o) => o.statusEvents.some((e) => e.toStatus === "OUT_FOR_DELIVERY"));
  const selfOfd = withOfd.filter(
    (o) => (o.statusEvents.find((e) => e.toStatus === "OUT_FOR_DELIVERY")?.employeeId ?? null) === selfEmployeeId
  );

  const delivered = assigned.filter((o) => o.status === "DELIVERED");
  const selfDelivered = delivered.filter(
    (o) => (o.statusEvents.find((e) => e.toStatus === "DELIVERED")?.employeeId ?? null) === selfEmployeeId
  );

  const stuck = assigned.filter((o) => STUCK_STATUSES.includes(o.status));
  const stuckOverdue = stuck.filter((o) => isOverdue(o.deadlineAt, o.status as OrderStatus));

  return {
    totalAssigned: assigned.length,
    ofdTotal: withOfd.length,
    ofdSelf: selfOfd.length,
    deliveredTotal: delivered.length,
    deliveredSelf: selfDelivered.length,
    deliveredRate: delivered.length > 0 ? selfDelivered.length / delivered.length : null,
    stuckNow: stuck.length,
    stuckOverdueNow: stuckOverdue.length,
  };
}

export default async function DriverReliabilityReportPage() {
  await requireRole("OPERATIONS");

  const orderSelect = {
    id: true,
    status: true,
    deadlineAt: true,
    statusEvents: {
      where: { toStatus: { in: ["OUT_FOR_DELIVERY", "DELIVERED"] } },
      orderBy: { createdAt: "asc" as const },
      select: { toStatus: true, employeeId: true },
    },
  };

  const [drivers, teamOrders, courierOrders] = await Promise.all([
    db.employee.findMany({ where: { role: "DRIVER" }, orderBy: { name: "asc" } }),
    db.order.findMany({ where: { driverId: { not: null } }, select: { driverId: true, ...orderSelect } }),
    db.order.findMany({
      where: { externalDriverName: { not: null } },
      select: { externalDriverName: true, ...orderSelect },
    }),
  ]);

  const teamRows = drivers.map((driver) => ({
    name: driver.name,
    ...computeStats(
      teamOrders.filter((o) => o.driverId === driver.id),
      driver.id
    ),
  }));

  const courierNames = [...new Set(courierOrders.map((o) => o.externalDriverName!.trim()))];
  const courierRows = courierNames
    .map((name) => ({
      name,
      // Outside couriers have no login — a status change made from their own
      // shareable /deliver link is recorded with no employee attached at
      // all, so "no one" here means "the courier, via their own link".
      ...computeStats(
        courierOrders.filter((o) => o.externalDriverName!.trim() === name),
        null
      ),
    }))
    .filter((row) => row.totalAssigned >= MIN_ORDERS_FOR_COURIERS);

  const sortByRate = <T extends { deliveredRate: number | null }>(rows: T[]) =>
    [...rows].sort((a, b) => (a.deliveredRate ?? 2) - (b.deliveredRate ?? 2));

  const sortedTeam = sortByRate(teamRows);
  const sortedCouriers = sortByRate(courierRows);
  const hiddenCourierCount = courierNames.length - courierRows.length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/ops" className="text-sm text-muted hover:text-foreground">
          ← Back to orders
        </Link>
        <h2 className="text-lg font-semibold text-foreground mt-2">Driver reliability</h2>
        <p className="text-sm text-muted mt-1">
          How often each driver updates their own delivery status, versus Operations having to do it
          for them.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Outside couriers</h3>
        <p className="text-xs text-muted -mt-2">
          Couriers have no login — &ldquo;self&rdquo; here means the status was changed from their own
          delivery link, not by someone opening the dashboard. Grouped by the exact name text on the
          order, so inconsistent spelling (e.g. &ldquo;Zyad&rdquo; vs &ldquo;Zeyad&rdquo;) shows up as
          separate rows.
          {hiddenCourierCount > 0 &&
            ` ${hiddenCourierCount} name${hiddenCourierCount === 1 ? "" : "s"} with fewer than ${MIN_ORDERS_FOR_COURIERS} orders are hidden as too little data to judge.`}
        </p>
        {sortedCouriers.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">No outside courier deliveries yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedCouriers.map((row) => (
              <DriverCard key={row.name} {...row} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Team drivers</h3>
        {sortedTeam.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">No team drivers yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedTeam.map((row) => (
              <DriverCard key={row.name} {...row} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DriverCard({
  name,
  totalAssigned,
  ofdTotal,
  ofdSelf,
  deliveredTotal,
  deliveredSelf,
  deliveredRate,
  stuckNow,
  stuckOverdueNow,
}: {
  name: string;
  totalAssigned: number;
  ofdTotal: number;
  ofdSelf: number;
  deliveredTotal: number;
  deliveredSelf: number;
  deliveredRate: number | null;
  stuckNow: number;
  stuckOverdueNow: number;
}) {
  const flagged = deliveredRate !== null && deliveredRate < 0.5;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-surface p-4 flex flex-col gap-3",
        flagged ? "border-red-300" : "border-line"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{name}</p>
        {deliveredRate !== null ? (
          <span
            className={cn(
              "text-xs font-semibold rounded-full px-2.5 py-1",
              flagged ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
            )}
          >
            {Math.round(deliveredRate * 100)}% self-updated
          </span>
        ) : (
          <span className="text-xs font-medium text-muted rounded-full px-2.5 py-1 bg-background border border-line">
            No deliveries yet
          </span>
        )}
      </div>

      {totalAssigned === 0 ? (
        <p className="text-sm text-muted">No orders assigned yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat
            label="Marked out for delivery"
            value={ofdTotal > 0 ? `${ofdSelf} / ${ofdTotal} themselves` : "—"}
          />
          <Stat
            label="Marked delivered"
            value={deliveredTotal > 0 ? `${deliveredSelf} / ${deliveredTotal} themselves` : "—"}
          />
        </div>
      )}

      {stuckNow > 0 && (
        <p className={cn("text-xs font-medium", stuckOverdueNow > 0 ? "text-red-600" : "text-amber-600")}>
          {stuckNow} order{stuckNow === 1 ? "" : "s"} currently waiting on them right now
          {stuckOverdueNow > 0 && ` — ${stuckOverdueNow} already overdue`}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}
