import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { countByFlorist, floristCompletions } from "@/lib/floristStats";
import {
  addDays,
  addMonths,
  formatDubaiDate,
  fromDateParam,
  startOfDay,
  startOfMonth,
  toDateParam,
} from "@/lib/date";
import { cn } from "@/lib/cn";

// A day-by-day list is the point of a short range ("how did the first two
// weeks of September go"); over a long one it's just a wall of rows, and the
// per-florist totals are what's being asked anyway.
const MAX_DAYS_CHARTED = 31;

/**
 * Rounding alone turns "1 bouquet out of 419" into "0%", which reads as
 * having made none, and the 418 next to it into "100%", as if they made
 * them all. Clamp both ends so a non-zero count never disappears.
 */
function sharePercent(count: number, total: number) {
  if (total === 0 || count === 0) return "0%";
  const pct = (count / total) * 100;
  if (pct < 1) return "<1%";
  if (pct > 99 && count < total) return ">99%";
  return `${Math.round(pct)}%`;
}

export default async function FloristReportPage(props: PageProps<"/ops/reports/florists">) {
  await requireRole("OPERATIONS");
  const searchParams = await props.searchParams;

  const today = startOfDay(new Date());
  const param = (key: string) =>
    typeof searchParams[key] === "string" ? (searchParams[key] as string) : undefined;

  // Default to the last 7 days including today — the range someone opening
  // this page cold is most likely to want, and it makes the inputs
  // self-explanatory rather than empty.
  const rawFrom = param("from") ? fromDateParam(param("from")) : addDays(today, -6);
  const rawTo = param("to") ? fromDateParam(param("to")) : today;
  // Tolerate a backwards range rather than silently returning nothing.
  const from = rawFrom <= rawTo ? rawFrom : rawTo;
  const to = rawFrom <= rawTo ? rawTo : rawFrom;
  const toExclusive = addDays(to, 1);

  const florists = await db.employee.findMany({
    where: { role: "FLORIST" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, active: true },
  });
  const floristIds = florists.map((f) => f.id);

  const [rangeCompletions, todayCompletions, openWork] = await Promise.all([
    floristCompletions(floristIds, from, toExclusive),
    floristCompletions(floristIds, today, addDays(today, 1)),
    db.order.groupBy({
      by: ["floristId", "status"],
      where: { floristId: { in: floristIds }, status: { in: ["ASSIGNED_FLORIST", "AWAITING_PHOTO"] } },
      _count: { _all: true },
    }),
  ]);

  const rangeCounts = countByFlorist(rangeCompletions);
  const todayCounts = countByFlorist(todayCompletions);

  const openFor = (floristId: string, status: string) =>
    openWork.find((row) => row.floristId === floristId && row.status === status)?._count._all ?? 0;

  // Today's board: everyone still on the team, plus anyone deactivated who
  // somehow still has work open — an order stuck on a leaver is exactly the
  // thing this should surface rather than hide.
  const liveRows = florists
    .map((f) => ({
      name: f.name,
      active: f.active,
      done: todayCounts[f.id] ?? 0,
      toMake: openFor(f.id, "ASSIGNED_FLORIST"),
      awaitingPhoto: openFor(f.id, "AWAITING_PHOTO"),
    }))
    .filter((r) => r.active || r.done > 0 || r.toMake > 0 || r.awaitingPhoto > 0)
    .sort((a, b) => b.done - a.done || a.name.localeCompare(b.name));

  const rangeTotal = rangeCompletions.length;
  const dayCount = Math.round((toExclusive.getTime() - from.getTime()) / 86_400_000);

  const rangeRows = florists
    .map((f) => ({ name: f.name, active: f.active, count: rangeCounts[f.id] ?? 0 }))
    .filter((r) => r.active || r.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const busiest = rangeRows[0]?.count ?? 0;

  // Day buckets, including the days nobody finished anything — a quiet day is
  // information, and holes in the list would read as missing data.
  const perDay =
    dayCount <= MAX_DAYS_CHARTED
      ? Array.from({ length: dayCount }, (_, i) => {
          const day = addDays(from, i);
          const key = toDateParam(day);
          return { day, count: rangeCompletions.filter((c) => toDateParam(c.at) === key).length };
        })
      : null;
  const busiestDay = perDay ? Math.max(1, ...perDay.map((d) => d.count)) : 1;

  const href = (f: Date, t: Date) =>
    `/ops/reports/florists?from=${toDateParam(f)}&to=${toDateParam(t)}`;
  const thisMonth = startOfMonth(today);
  const lastMonth = addMonths(thisMonth, -1);
  const presets = [
    { label: "Today", from: today, to: today },
    { label: "Yesterday", from: addDays(today, -1), to: addDays(today, -1) },
    { label: "Last 7 days", from: addDays(today, -6), to: today },
    { label: "Last 30 days", from: addDays(today, -29), to: today },
    { label: "This month", from: thisMonth, to: today },
    { label: "Last month", from: lastMonth, to: addDays(thisMonth, -1) },
  ];
  const activePreset = presets.find(
    (p) => toDateParam(p.from) === toDateParam(from) && toDateParam(p.to) === toDateParam(to)
  );

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Right now</h3>
          <p className="text-xs text-muted mt-0.5">
            Finished today and still open, per florist. Updates as the team works.
          </p>
        </div>
        {liveRows.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">No florists on the team yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {liveRows.map((row) => (
              <div
                key={row.name}
                className={cn(
                  "rounded-2xl border bg-surface p-4 flex items-center justify-between gap-3",
                  row.toMake > 0 ? "border-line" : "border-line bg-surface/60"
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {row.name}
                    {!row.active && <span className="font-normal text-muted"> · left the team</span>}
                  </p>
                  <p className="text-sm text-muted mt-0.5">
                    {row.toMake > 0 ? (
                      <span className="text-foreground font-medium">
                        {row.toMake} bouquet{row.toMake === 1 ? "" : "s"} to make
                      </span>
                    ) : (
                      "Nothing waiting on them"
                    )}
                    {row.awaitingPhoto > 0 && (
                      <span className="text-pink-600">
                        {" · "}
                        {row.awaitingPhoto} waiting on a photo
                      </span>
                    )}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-semibold text-foreground leading-none">{row.done}</p>
                  <p className="text-xs text-muted mt-1">done today</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Over a date range</h3>
          <p className="text-xs text-muted mt-0.5">
            Counted by who pressed &ldquo;mark ready&rdquo;, so reassigning an order later never
            moves finished work between people. A bouquet remade counts once.
          </p>
        </div>

        <form method="GET" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">From</span>
            <input
              type="date"
              name="from"
              defaultValue={toDateParam(from)}
              max={toDateParam(today)}
              className="rounded-xl border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">To</span>
            <input
              type="date"
              name="to"
              defaultValue={toDateParam(to)}
              max={toDateParam(today)}
              className="rounded-xl border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
          <button
            type="submit"
            className="rounded-xl bg-brand text-brand-ink font-semibold px-4 py-2 text-sm hover:opacity-90 transition"
          >
            Show
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <Link
              key={preset.label}
              href={href(preset.from, preset.to)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                activePreset?.label === preset.label
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line text-muted hover:border-brand hover:text-foreground"
              )}
            >
              {preset.label}
            </Link>
          ))}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm text-muted">
            {formatDubaiDate(from)}
            {dayCount > 1 && ` – ${formatDubaiDate(to)}`}
          </p>
          <p className="mt-1">
            <span className="text-2xl font-semibold text-foreground">{rangeTotal}</span>
            <span className="text-sm text-muted"> bouquet{rangeTotal === 1 ? "" : "s"} made</span>
            {dayCount > 1 && (
              <span className="text-sm text-muted">
                {" "}
                · {(rangeTotal / dayCount).toFixed(1)} a day over {dayCount} days
              </span>
            )}
          </p>
        </div>

        {rangeTotal === 0 ? (
          <p className="text-sm text-muted text-center py-8">
            No bouquets marked ready in this range.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {rangeRows.map((row) => (
              <div key={row.name} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    {row.name}
                    {!row.active && <span className="font-normal text-muted"> · left the team</span>}
                  </p>
                  <p className="text-sm text-muted shrink-0">
                    <span className="font-semibold text-foreground">{row.count}</span>
                    {` · ${sharePercent(row.count, rangeTotal)}`}
                  </p>
                </div>
                <div className="mt-2 h-2 rounded-full bg-background overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${busiest > 0 ? (row.count / busiest) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {perDay && rangeTotal > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            <h4 className="text-sm font-semibold text-foreground">Day by day</h4>
            <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col gap-2">
              {perDay.map(({ day, count }) => (
                <div key={toDateParam(day)} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-muted text-xs">{formatDubaiDate(day)}</span>
                  <div className="flex-1 h-2 rounded-full bg-background overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand/60"
                      style={{ width: `${(count / busiestDay) * 100}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      "w-8 shrink-0 text-right font-medium",
                      count === 0 ? "text-muted" : "text-foreground"
                    )}
                  >
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!perDay && (
          <p className="text-xs text-muted">
            Day-by-day breakdown is shown for ranges up to {MAX_DAYS_CHARTED} days.
          </p>
        )}
      </section>
    </div>
  );
}
