"use client";

import { useEffect, useRef, useState } from "react";
import { Lora } from "next/font/google";
import { isArabicText } from "@/lib/language";
import { isFarEmirate } from "@/lib/emirates";
import { cn } from "@/lib/cn";
import { cardsToPdf } from "@/lib/printPdf";

const lora = Lora({ subsets: ["latin"], weight: ["400", "500", "600"] });

// A short message (a couple of words) has room to grow far past what
// actually looks elegant on a small card — capping well below the size
// the box could technically fit keeps every message, short or long, at a
// consistent, boutique-card scale instead of a few words looking
// oversized just because they had the space.
const MAX_FONT_SIZE = 18;
const MIN_FONT_SIZE = 7;

/** How long to wait on one image before carrying on regardless. */
const IMAGE_WAIT_MS = 1500;

/**
 * Resolves once an <img> has finished loading, or immediately if it already
 * has — but never blocks indefinitely.
 *
 * The timeout is not paranoia: on a day sheet holding ~80 images, decode()
 * stops resolving altogether (measured — it hung for a single image on a
 * page with 79 of them), which left every card stuck before it could be
 * measured and the Download button disabled forever. decode() is only a
 * nicety here — `complete`, or a `load` event, already means the bitmap is
 * in, and the nextPaint() that follows is what actually guarantees layout
 * has settled — so losing the race costs nothing.
 */
function waitForImage(img: HTMLImageElement | null): Promise<void> {
  if (!img) return Promise.resolve();
  const settled: Promise<unknown> = img.complete
    ? img.decode().catch(() => undefined)
    : new Promise((resolve) => {
        img.addEventListener("load", () => resolve(undefined), { once: true });
        img.addEventListener("error", () => resolve(undefined), { once: true });
      });
  return Promise.race([
    settled,
    new Promise((resolve) => setTimeout(resolve, IMAGE_WAIT_MS)),
  ]).then(() => undefined);
}

/** Resolves after the browser has actually painted a frame — fonts/images
 * resolving "loaded" doesn't guarantee layout has caught up yet (e.g. an
 * image's `height: auto` box can still measure as 0 for a tick), so this
 * is a belt-and-suspenders wait before trusting any measurement. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** The note steps down a size at each of these lengths. The card is a
 *  fixed-height A6 with overflow hidden, so a long note left at full size
 *  silently pushes the recipient, address and courier signature box off the
 *  bottom — measured, not guessed. */
const NOTE_SHRINK_AT = 160;
const NOTE_SHRINK_AGAIN_AT = 320;

function noteSizeClass(note: string) {
  if (note.length > NOTE_SHRINK_AGAIN_AT) return "ops-note-value ops-note-value-longer";
  if (note.length > NOTE_SHRINK_AT) return "ops-note-value ops-note-value-long";
  return "ops-note-value";
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
  embedded = false,
  onReady,
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
  /** Rendered as one order among many on a day sheet: no toolbar and no
   *  page chrome, because the sheet owns both. */
  embedded?: boolean;
  /** Fires once this order's message text has been fitted and its cards are
   *  safe to rasterise — the day sheet waits for every order before it will
   *  let anyone press Download. */
  onReady?: () => void;
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

  const isFar = !!deliveryArea && isFarEmirate(deliveryArea);

  const headerIconRef = useRef<HTMLImageElement>(null);
  const messageLogoRef = useRef<HTMLImageElement>(null);
  const messageBoxRef = useRef<HTMLDivElement>(null);
  const messageTextRef = useRef<HTMLParagraphElement>(null);
  const [ready, setReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // Held in a ref so an inline parent callback doesn't retrigger the
  // measure-and-shrink effect on every render.
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      await Promise.all([
        document.fonts?.ready ?? Promise.resolve(),
        waitForImage(headerIconRef.current),
        waitForImage(messageLogoRef.current),
      ]);
      await nextPaint();
      if (cancelled) return;

      // Shrink-to-fit: measure against the real (now-loaded) font metrics
      // rather than a fallback font's different proportions, so the size
      // chosen here is the size that actually prints.
      const box = messageBoxRef.current;
      const text = messageTextRef.current;
      // A zero-height box means layout hasn't actually settled despite every
      // wait above — trust it as "doesn't fit" would shrink the font to the
      // floor for no real reason, so skip shrinking rather than act on a
      // measurement that can't be right.
      if (hasMessage && box && text && box.clientHeight > 0) {
        let size = MAX_FONT_SIZE;
        text.style.fontSize = `${size}pt`;
        // A 10% safety margin on height only, not the raw box size: the PDF
        // export re-renders this same text through html2canvas, whose text
        // metrics don't measure identically to the live browser, and a size
        // that just barely fit here (a couple of px of headroom) came out
        // clipped in the exported PDF. Width gets no such margin — wrapped,
        // centered text's scrollWidth sits at exactly the container's full
        // width at every font size (that's what wrapping to fill the line
        // means), so shrinking that target just forced the floor size every
        // time for no reason.
        const maxHeight = box.clientHeight * 0.9;
        const maxWidth = box.clientWidth;
        while (size > MIN_FONT_SIZE && (text.scrollHeight > maxHeight || text.scrollWidth > maxWidth)) {
          size -= 0.5;
          text.style.fontSize = `${size}pt`;
        }
      }
      if (cancelled) return;
      setReady(true);
      onReadyRef.current?.();
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
      await cardsToPdf(`GiftyGram-${orderNumber.replace(/[^\w-]+/g, "")}.pdf`);
    } finally {
      setDownloading(false);
    }
  }

  const cards = (
    <>
    <div className="card ops-card">
      <div className="ops-card-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={headerIconRef} src="/flower-icon.png" alt="" />
        <span>GiftyGram Flowers — Operations card</span>
      </div>

      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="ops-field-label">Order number</div>
          <div className="ops-card-order-number">{orderNumber}</div>
        </div>
        {deliveryArea && (
          <div className={cn("ops-area-badge", isFar && "ops-area-badge-far")}>
            {isFar && "🚗 "}
            {deliveryArea}
          </div>
        )}
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
        {/* Deliberately the loudest thing on the card after the order
            number. This is where "add a red balloon" lives, and it was
            being missed when it read like one more grey field. */}
        {customerNote && (
          <div className="ops-note-box">
            <div className="ops-note-label">⚠ Customer note</div>
            <div
              className={noteSizeClass(customerNote)}
              dir={isArabicText(customerNote) ? "rtl" : "ltr"}
              style={{
                fontFamily: isArabicText(customerNote)
                  ? '"Montserrat Arabic", "Segoe UI", Tahoma, sans-serif'
                  : undefined,
              }}
            >
              {customerNote}
            </div>
          </div>
        )}
        <Field label="Recipient" value={`${recipientName} — ${recipientPhone}`} />
        <Field label="Address" value={deliveryAddress} />
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
    </>
  );

  // On a day sheet the parent owns the toolbar and the page chrome, so
  // this renders nothing but the cards themselves.
  if (embedded) return cards;

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

      {cards}
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
