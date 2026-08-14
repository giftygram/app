import { db } from "@/lib/db";

const PREFIX = "GG-";
const START = 1000;

/** Next sequential GG-#### number for a manually-entered (WhatsApp) order. */
export async function nextWhatsAppOrderNumber() {
  const last = await db.order.findMany({
    where: { source: "WHATSAPP" },
    select: { orderNumber: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  let max = START - 1;
  for (const { orderNumber } of last) {
    const n = Number(orderNumber.replace(PREFIX, ""));
    if (Number.isFinite(n) && n > max) max = n;
  }

  return `${PREFIX}${max + 1}`;
}
