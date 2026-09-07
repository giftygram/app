"use client";

import { useEffect, useRef, useState } from "react";
import { Lora } from "next/font/google";
import { isArabicText } from "@/lib/language";
import { cn } from "@/lib/cn";

const lora = Lora({ subsets: ["latin"], weight: ["400", "500", "600"] });

const MAX_FONT_SIZE = 26;
const MIN_FONT_SIZE = 7;

/** Resolves once an <img> has finished loading, or immediately if it already has. */
function waitForImage(img: HTMLImageElement | null): Promise<void> {
  if (!img) return Promise.resolve();
  if (img.complete) return img.decode().catch(() => undefined);
  return new Promise((resolve) => {
    img.addEventListener("load", () => resolve(), { once: true });
    img.addEventListener("error", () => resolve(), { once: true });
  });
}

export function OrderPrintCards({
  orderId,
  orderNumber,
  bouquetName,
  occasion,
  deliverBy,
  customerNote,
  cardMessage,
  recipientName,
  recipientPhone,
  deliveryAddress,
  deliveryArea,
  senderName,
  senderPhone,
  floristName,
  driverLabel,
  isExternalDriver,
}: {
  orderId: string;
  orderNumber: string;
  bouquetName: string | null;
  occasion: string | null;
  deliverBy: string | null;
  customerNote: string | null;
  cardMessage: string | null;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  deliveryArea: string | null;
  senderName: string | null;
  senderPhone: string | null;
  floristName: string | null;
  driverLabel: string | null;
  isExternalDriver: boolean;
}) {
  const hasMessage = !!cardMessage;
  const arabic = hasMessage && isArabicText(cardMessage);
  // A pre-truncated string, not CSS overflow/line-clamp: the PDF export
  // renders this element through html2canvas, and clipping a multi-line
  // RTL box with `overflow: hidden` (or `-webkit-line-clamp`) confused its
  // layout engine into overlapping/garbled Arabic glyphs, even though the
  // exact same CSS renders correctly in a live browser.
  const cardMessageFlat = cardMessage?.replace(/\s*\n+\s*/g, " ").trim() ?? null;
  const cardMessagePreview =
    cardMessageFlat && cardMessageFlat.length > 130 ? `${cardMessageFlat.slice(0, 130).trim()}…` : cardMessageFlat;

  const headerIconRef = useRef<HTMLImageElement>(null);
  const messageLogoRef = useRef<HTMLImageElement>(null);
  const messageBoxRef = useRef<HTMLDivElement>(null);
  const messageTextRef = useRef<HTMLParagraphElement>(null);
  const [ready, setReady] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      await Promise.all([
        document.fonts?.ready ?? Promise.resolve(),
        waitForImage(headerIconRef.current),
        waitForImage(messageLogoRef.current),
      ]);
      if (cancelled) return;

      // Shrink-to-fit: measure against the real (now-loaded) font metrics
      // rather than a fallback font's different proportions, so the size
      // chosen here is the size that actually prints.
      const box = messageBoxRef.current;
      const text = messageTextRef.current;
      if (hasMessage && box && text) {
        let size = MAX_FONT_SIZE;
        text.style.fontSize = `${size}pt`;
        while (
          size > MIN_FONT_SIZE &&
          (text.scrollHeight > box.clientHeight || text.scrollWidth > box.clientWidth)
        ) {
          size -= 0.5;
          text.style.fontSize = `${size}pt`;
        }
      }
      if (cancelled) return;
      setReady(true);
    }

    prepare();
    return () => {
      cancelled = true;
    };
  }, [hasMessage, cardMessage]);

  // A saved PDF prints with none of the browser's own header/footer (URL,
  // date, page count) that `window.print()` is subject to on most
  // browsers/printers — that chrome comes from the print pipeline itself,
  // not this page, and can't be suppressed from a webpage. Rendering each
  // card to a canvas and assembling a real PDF file sidesteps that
  // pipeline entirely: opening or printing the saved file never invokes it.
  async function downloadPdf() {
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const cards = Array.from(document.querySelectorAll<HTMLElement>(".card"));
      const doc = new jsPDF({ unit: "mm", format: [105, 148], orientation: "portrait" });

      for (let i = 0; i < cards.length; i++) {
        const canvas = await html2canvas(cards[i], { scale: 3, useCORS: true, backgroundColor: "#ffffff" });
        const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
        if (i > 0) doc.addPage([105, 148], "portrait");
        doc.addImage(dataUrl, "JPEG", 0, 0, 105, 148);
      }

      doc.save(`GiftyGram-${orderNumber.replace(/[^\w-]+/g, "")}.pdf`);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="print-page min-h-screen">
      <div className="print-toolbar no-print">
        <a href={`/ops/orders/${orderId}`} className="text-sm text-muted hover:text-foreground">
          ← Back to order
        </a>
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
            onClick={downloadPdf}
            disabled={!ready || downloading}
            className="rounded-lg bg-brand text-brand-ink px-4 py-2 text-sm font-semibold hover:opacity-90 transition disabled:opacity-60 disabled:cursor-wait"
          >
            {downloading ? "Preparing…" : "⬇️ Download PDF"}
          </button>
        </div>
      </div>

      <div className="card ops-card">
        <div className="ops-card-header">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={headerIconRef} src="/flower-icon.png" alt="" />
          <span>GiftyGram Flowers — Operations card</span>
        </div>

        <div>
          <div className="ops-field-label">Order number</div>
          <div className="ops-card-order-number">{orderNumber}</div>
        </div>

        <div className="ops-field-grid">
          <Field label="Bouquet" value={bouquetName} />
          <Field label="Occasion" value={occasion} />
          <Field label="Deliver by" value={deliverBy ?? "No date chosen"} />
          <div>
            <div className="ops-field-label">Card message</div>
            <div
              className="ops-field-value ops-field-value-message"
              dir={arabic ? "rtl" : "ltr"}
              style={{ fontFamily: arabic ? '"Montserrat Arabic", "Segoe UI", Tahoma, sans-serif' : undefined }}
            >
              {cardMessagePreview ?? "No card message"}
            </div>
          </div>
          <Field label="Customer note" value={customerNote} />
          <Field label="Recipient" value={`${recipientName} — ${recipientPhone}`} />
          <Field label="Address" value={deliveryArea ? `${deliveryAddress}, ${deliveryArea}` : deliveryAddress} />
          {senderName && <Field label="Sender" value={senderPhone ? `${senderName} — ${senderPhone}` : senderName} />}
          {floristName && <Field label="Florist" value={floristName} />}
          {driverLabel && (
            <Field label="Driver" value={isExternalDriver ? `${driverLabel} (outside courier)` : driverLabel} />
          )}
        </div>

        <div className="ops-card-spacer" />

        <div className="ops-courier-box">
          <div className="ops-field-label">Outside courier ID</div>
          <div className="ops-courier-line" />
        </div>
      </div>

      {hasMessage && (
        <div className="card message-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={messageLogoRef} src="/logo.png" alt="GiftyGram Flowers" className="message-card-logo" />
          <div className="message-card-body" ref={messageBoxRef}>
            <p
              ref={messageTextRef}
              className={cn("message-card-text", !arabic && lora.className)}
              dir={arabic ? "rtl" : "ltr"}
              lang={arabic ? "ar" : "en"}
              style={{ fontFamily: arabic ? '"Montserrat Arabic", "Segoe UI", Tahoma, sans-serif' : undefined }}
            >
              {cardMessage}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  const fieldArabic = isArabicText(value);
  return (
    <div>
      <div className="ops-field-label">{label}</div>
      <div
        className="ops-field-value"
        dir={fieldArabic ? "rtl" : "ltr"}
        style={{ fontFamily: fieldArabic ? '"Montserrat Arabic", "Segoe UI", Tahoma, sans-serif' : undefined }}
      >
        {value}
      </div>
    </div>
  );
}
