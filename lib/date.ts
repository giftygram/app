// Every function here is deliberately independent of the server's own
// system timezone. Locally that's Asia/Dubai (set via TZ in .env), but
// Vercel's runtime ignores TZ (it's a reserved env var there) and defaults
// to UTC — so anything using plain Date methods like getHours()/setHours()
// silently drifted by 4 hours in production. The UAE has never observed
// DST, so a fixed +4h offset is exact, not an approximation.
export const DUBAI_TZ = "Asia/Dubai";
const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;

function toDubaiWallClock(d: Date) {
  return new Date(d.getTime() + DUBAI_OFFSET_MS);
}

/**
 * The five fixed three-hour windows Shopify's checkout offers. Shared with
 * the Ops time-slot filter dropdown so the two can never drift apart.
 */
export const DELIVERY_TIME_WINDOWS = [
  { label: "9:00 AM - 12:00 PM", startMin: 9 * 60, endMin: 12 * 60 },
  { label: "12:00 PM - 3:00 PM", startMin: 12 * 60, endMin: 15 * 60 },
  { label: "3:00 PM - 6:00 PM", startMin: 15 * 60, endMin: 18 * 60 },
  { label: "6:00 PM - 9:00 PM", startMin: 18 * 60, endMin: 21 * 60 },
  { label: "9:00 PM - 12:00 AM", startMin: 21 * 60, endMin: 24 * 60 },
] as const;

/**
 * Maps a deadline's Dubai wall-clock time to whichever of the five windows
 * it falls in — used whenever Operations sets/changes a deadline by hand
 * (new order, edit, reschedule), since those flows only capture a plain
 * date/time, not one of Shopify's window labels. Without this, a manually
 * set deadline left deliveryTimeSlot null, so the order was invisible under
 * the time-slot filter even though its deadline clearly fell in a window.
 */
export function deliveryTimeSlotFor(d: Date): string | null {
  const dubai = toDubaiWallClock(d);
  const minutes = dubai.getUTCHours() * 60 + dubai.getUTCMinutes();
  return DELIVERY_TIME_WINDOWS.find((w) => minutes >= w.startMin && minutes < w.endMin)?.label ?? null;
}

/**
 * The slot to store alongside a deadline, for flows where Operations picks a
 * deadline by hand. deadlineAt always holds a window's *end*, but the windows
 * are half-open, so feeding an end straight to deliveryTimeSlotFor lands it in
 * the *next* window — rescheduling a 9:00 AM - 12:00 PM order used to relabel
 * it 12:00 PM - 3:00 PM and push the whole delivery three hours late. An exact
 * window end therefore belongs to the window it closes; anything else is a
 * time inside its window, as before.
 */
export function deliveryTimeSlotForDeadline(d: Date): string | null {
  const dubai = toDubaiWallClock(d);
  const minutes = dubai.getUTCHours() * 60 + dubai.getUTCMinutes();
  const closes = DELIVERY_TIME_WINDOWS.find((w) => w.endMin === minutes);
  if (closes) return closes.label;
  // The 9:00 PM - 12:00 AM window stores 23:59:59.999 rather than a clean
  // midnight (see parseDeadline), so it never matches endMin exactly.
  if (minutes === 24 * 60 - 1) return DELIVERY_TIME_WINDOWS[DELIVERY_TIME_WINDOWS.length - 1].label;
  return deliveryTimeSlotFor(d);
}

/** Dubai-local YYYY-MM-DD, matching what a <input type="date"> produces. */
export function toDateParam(d: Date) {
  const dubai = toDubaiWallClock(d);
  const y = dubai.getUTCFullYear();
  const m = String(dubai.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dubai.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Dubai midnight for a YYYY-MM-DD string. Falls back to today if unparseable. */
export function fromDateParam(param: string | undefined): Date {
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
    const [y, m, d] = param.split("-").map(Number);
    const parsed = new Date(Date.UTC(y, m - 1, d) - DUBAI_OFFSET_MS);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return startOfDay(new Date());
}

/** Dubai midnight for whichever calendar day `d` falls on there. */
export function startOfDay(d: Date) {
  const dubai = toDubaiWallClock(d);
  const utcMidnight = Date.UTC(dubai.getUTCFullYear(), dubai.getUTCMonth(), dubai.getUTCDate());
  return new Date(utcMidnight - DUBAI_OFFSET_MS);
}

export function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}

export function startOfMonth(d: Date) {
  const dubai = toDubaiWallClock(d);
  return new Date(Date.UTC(dubai.getUTCFullYear(), dubai.getUTCMonth(), 1) - DUBAI_OFFSET_MS);
}

export function addMonths(d: Date, n: number) {
  const dubai = toDubaiWallClock(d);
  return new Date(Date.UTC(dubai.getUTCFullYear(), dubai.getUTCMonth() + n, 1) - DUBAI_OFFSET_MS);
}

function dubaiDayOfWeek(d: Date) {
  return toDubaiWallClock(d).getUTCDay();
}

function dubaiMonth(d: Date) {
  return toDubaiWallClock(d).getUTCMonth();
}

/** Always 42 cells (6 full weeks) so the grid height never jumps between months. */
export function buildMonthGrid(viewMonth: Date) {
  const firstOfMonth = startOfMonth(viewMonth);
  const gridStart = addDays(firstOfMonth, -dubaiDayOfWeek(firstOfMonth));
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(gridStart, i);
    return { date, inMonth: dubaiMonth(date) === dubaiMonth(viewMonth) };
  });
}

export function isSameDay(a: Date, b: Date) {
  return toDateParam(a) === toDateParam(b);
}

export function formatDateLabel(d: Date, today: Date) {
  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, addDays(today, 1))) return "Tomorrow";
  if (isSameDay(d, addDays(today, -1))) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", timeZone: DUBAI_TZ });
}

/** Dubai-local "YYYY-MM-DDTHH:mm", the value a <input type="datetime-local"> expects. */
export function toDatetimeLocalValue(d: Date) {
  const dubai = toDubaiWallClock(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${toDateParam(d)}T${pad(dubai.getUTCHours())}:${pad(dubai.getUTCMinutes())}`;
}

/**
 * Converts Dubai wall-clock date/time components into the correct absolute
 * instant. Must not use `new Date(y, m, d, h, mi)` directly: that
 * multi-arg constructor builds the date in the *server's* local timezone,
 * which on Vercel is UTC, not Dubai — the exact bug that had every
 * Shopify-order deadline (parsed from the checkout's delivery date/time)
 * and every manually-typed deadline stored 4 hours later than intended.
 */
export function fromDubaiComponents(y: number, m: number, d: number, h = 0, mi = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h, mi) - DUBAI_OFFSET_MS);
}

/**
 * Inverse of toDatetimeLocalValue — parses a <input type="datetime-local">
 * value (Dubai wall-clock, no timezone info in the string itself) into the
 * correct absolute instant.
 */
export function fromDatetimeLocalValue(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return fromDubaiComponents(+y, +mo, +d, +h, +mi);
}

/** Full date + time, Dubai-local — "Aug 15, 2026, 4:16 PM". */
export function formatDubaiDateTime(d: Date) {
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short", timeZone: DUBAI_TZ });
}

/** Time only, Dubai-local — "4:16 PM". */
export function formatDubaiTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: DUBAI_TZ });
}

/** Date only, Dubai-local — "Aug 15, 2026". */
export function formatDubaiDate(d: Date) {
  return d.toLocaleDateString([], { dateStyle: "medium", timeZone: DUBAI_TZ });
}

/**
 * "Aug 20, 2026 · 6:00 PM - 9:00 PM" when Shopify's actual delivery window
 * is known, otherwise the plain computed timestamp ("Aug 20, 2026, 9:00 PM").
 */
export function formatDeliveryWindow(deadlineAt: Date | null, deliveryTimeSlot: string | null) {
  if (!deadlineAt) return null;
  if (deliveryTimeSlot) return `${formatDubaiDate(deadlineAt)} · ${deliveryTimeSlot}`;
  return formatDubaiDateTime(deadlineAt);
}

/** Compact event timestamp: just the time today, otherwise date + time. */
export function formatEventTime(d: Date) {
  if (isSameDay(d, new Date())) return formatDubaiTime(d);
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: DUBAI_TZ });
}
