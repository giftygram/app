import Link from "next/link";
import { db } from "@/lib/db";
import { ACTIVE_STATUSES } from "@/lib/status";
import { startOfDay } from "@/lib/date";

/**
 * Flags orders whose delivery date's calendar day (Dubai) has already
 * passed — not the same-day time-of-day "Overdue" chip each card already
 * shows. A missed slot or failed delivery attempt from yesterday or
 * earlier needs Operations to actively re-dispatch it, not just wait for
 * someone to notice it's stale.
 */
export async function PastDueBanner() {
  const todayStart = startOfDay(new Date());
  const count = await db.order.count({
    where: { deadlineAt: { lt: todayStart }, status: { in: ACTIVE_STATUSES } },
  });
  if (count === 0) return null;

  return (
    <Link
      href="/ops?status=pastdue"
      className="block bg-orange-600 text-white text-sm font-semibold text-center py-2 px-4 hover:bg-orange-700 transition-colors"
    >
      ⏰ {count} order{count === 1 ? "" : "s"} past their delivery date — tap to review
    </Link>
  );
}
