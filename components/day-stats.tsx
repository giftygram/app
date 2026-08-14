const TRACKED_STATUSES = [
  { key: "DELIVERED", label: "delivered" },
  { key: "OUT_FOR_DELIVERY", label: "out for delivery" },
  { key: "READY", label: "ready" },
  { key: "ASSIGNED_FLORIST", label: "with florist" },
  { key: "CANCELLED", label: "cancelled" },
] as const;

export function DayStats({ counts, total }: { counts: Record<string, number>; total: number }) {
  if (total === 0) {
    return <p className="text-sm text-muted">No orders on this day.</p>;
  }

  const parts = TRACKED_STATUSES.map((s) => counts[s.key] ? `${counts[s.key]} ${s.label}` : null).filter(
    Boolean
  );

  return (
    <p className="text-sm text-muted">
      <span className="font-semibold text-foreground">{total}</span> order{total === 1 ? "" : "s"}
      {parts.length > 0 && <> — {parts.join(", ")}</>}
    </p>
  );
}
