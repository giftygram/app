import { db } from "@/lib/db";

/**
 * How a florist finishing a bouquet is recorded.
 *
 * There's no "bouquets made" column anywhere — the record is the status
 * event the florist themselves logged when they pressed "mark ready", and
 * that event's employeeId is the only trustworthy attribution. (The order's
 * own floristId can be reassigned afterwards, which would silently move
 * finished work from one person's total to another's.)
 *
 * Two statuses because the flow changed on 24 Sep 2026: before that, mark-ready
 * took the order straight to READY; since the bouquet photo moved to
 * Operations it stops at AWAITING_PHOTO first. Counting both keeps the
 * history continuous across that change. Events Operations logged are
 * excluded by the employeeId filter, so a manual status override never
 * lands in a florist's total.
 */
const FLORIST_DONE_STATUSES = ["AWAITING_PHOTO", "READY"];

export type Completion = { employeeId: string; orderId: string; at: Date };

/**
 * Every bouquet finished by one of `floristIds` in [from, toExclusive).
 *
 * An order that was sent back and remade logs a second event for the same
 * florist; that's one bouquet delivered to one customer, so it's counted
 * once, on the day they first finished it.
 */
export async function floristCompletions(
  floristIds: string[],
  from: Date,
  toExclusive: Date
): Promise<Completion[]> {
  if (floristIds.length === 0) return [];

  const events = await db.statusEvent.findMany({
    where: {
      employeeId: { in: floristIds },
      toStatus: { in: FLORIST_DONE_STATUSES },
      createdAt: { gte: from, lt: toExclusive },
    },
    orderBy: { createdAt: "asc" },
    select: { employeeId: true, orderId: true, createdAt: true },
  });

  const seen = new Set<string>();
  const completions: Completion[] = [];
  for (const event of events) {
    if (!event.employeeId) continue;
    const key = `${event.employeeId}:${event.orderId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    completions.push({ employeeId: event.employeeId, orderId: event.orderId, at: event.createdAt });
  }
  return completions;
}

/** completions → { employeeId: count }. */
export function countByFlorist(completions: Completion[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of completions) counts[c.employeeId] = (counts[c.employeeId] ?? 0) + 1;
  return counts;
}
