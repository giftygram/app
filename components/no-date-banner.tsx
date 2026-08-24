import Link from "next/link";
import { db } from "@/lib/db";
import { ACTIVE_STATUSES } from "@/lib/status";

/**
 * Express-checkout orders (Apple Pay, Shop Pay, etc.) skip the normal
 * checkout funnel entirely, so the delivery-date-picker app never runs —
 * they land with no deadlineAt at all. Bucketed only by createdAt, they
 * fall out of view the moment "today" moves on, which is how they went
 * unnoticed before. This stays visible everywhere in Ops until resolved.
 */
export async function NoDateBanner() {
  const count = await db.order.count({
    where: { deadlineAt: null, status: { in: ACTIVE_STATUSES } },
  });
  if (count === 0) return null;

  return (
    <Link
      href="/ops?status=nodate"
      className="block bg-red-600 text-white text-sm font-semibold text-center py-2 px-4 hover:bg-red-700 transition-colors"
    >
      ⚠️ {count} order{count === 1 ? "" : "s"} with no delivery date chosen — tap to review
    </Link>
  );
}
