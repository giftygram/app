/** Local-timezone YYYY-MM-DD, matching what a <input type="date"> produces. */
export function toDateParam(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local midnight for a YYYY-MM-DD string. Falls back to today if unparseable. */
export function fromDateParam(param: string | undefined): Date {
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
    const [y, m, d] = param.split("-").map(Number);
    const parsed = new Date(y, m - 1, d);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return startOfDay(new Date());
}

export function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Always 42 cells (6 full weeks) so the grid height never jumps between months. */
export function buildMonthGrid(viewMonth: Date) {
  const firstOfMonth = startOfMonth(viewMonth);
  const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(gridStart, i);
    return { date, inMonth: date.getMonth() === viewMonth.getMonth() };
  });
}

export function isSameDay(a: Date, b: Date) {
  return toDateParam(a) === toDateParam(b);
}

export function formatDateLabel(d: Date, today: Date) {
  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, addDays(today, 1))) return "Tomorrow";
  if (isSameDay(d, addDays(today, -1))) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

/** Local "YYYY-MM-DDTHH:mm", the value a <input type="datetime-local"> expects. */
export function toDatetimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${toDateParam(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Compact event timestamp: just the time today, otherwise date + time. */
export function formatEventTime(d: Date) {
  if (isSameDay(d, new Date())) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
