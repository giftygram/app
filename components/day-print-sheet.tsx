"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { OrderPrintCards } from "@/components/order-print-cards";
import { cardsToPdf } from "@/lib/printPdf";

export type PrintableOrder = React.ComponentProps<typeof OrderPrintCards>;

/**
 * Every card for a day's run on one page, and one button that turns the lot
 * into a single PDF.
 *
 * Printing them one order at a time meant opening a tab per order on a
 * fifty-order day. The cards themselves are unchanged — this renders the
 * same component per order and owns the toolbar for all of them.
 */
export function DayPrintSheet({
  orders,
  dateLabel,
  fileLabel,
  backHref,
}: {
  orders: PrintableOrder[];
  dateLabel: string;
  fileLabel: string;
  backHref: string;
}) {
  // Each order fits its own card message to the card before it's safe to
  // rasterise. Rasterising early bakes in the un-shrunk size, so Download
  // stays disabled until every order has reported in.
  const [readyCount, setReadyCount] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const markReady = useCallback(() => setReadyCount((n) => n + 1), []);

  const allReady = readyCount >= orders.length;
  const cardCount = orders.reduce((n, order) => n + (order.cardMessage ? 2 : 1), 0);

  async function download() {
    setProgress({ done: 0, total: cardCount });
    try {
      await cardsToPdf(`GiftyGram-${fileLabel}.pdf`, (done, total) => setProgress({ done, total }));
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="print-page min-h-screen">
      <div className="print-toolbar no-print">
        <div className="min-w-0">
          <Link href={backHref} className="text-sm text-muted hover:text-foreground">
            ← Back to orders
          </Link>
          <p className="text-xs text-muted mt-0.5">
            {orders.length} order{orders.length === 1 ? "" : "s"} · {cardCount} card
            {cardCount === 1 ? "" : "s"} · {dateLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-foreground hover:border-brand transition-colors"
          >
            🖨️ Print directly
          </button>
          <button
            type="button"
            onClick={download}
            disabled={!allReady || progress !== null}
            className="rounded-lg bg-brand text-brand-ink px-4 py-2 text-sm font-semibold hover:opacity-90 transition disabled:opacity-60 disabled:cursor-wait"
          >
            {progress
              ? `Building PDF… ${progress.done}/${progress.total}`
              : allReady
                ? `⬇️ Download all ${cardCount} cards`
                : `Preparing ${readyCount}/${orders.length}…`}
          </button>
        </div>
      </div>

      {orders.map((order) => (
        <OrderPrintCards key={order.orderId} {...order} embedded onReady={markReady} />
      ))}
    </div>
  );
}
