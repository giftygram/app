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

  const headerIconRef = useRef<HTMLImageElement>(null);
  const messageLogoRef = useRef<HTMLImageElement>(null);
  const messageBoxRef = useRef<HTMLDivElement>(null);
  const messageTextRef = useRef<HTMLParagraphElement>(null);
  const [ready, setReady] = useState(false);

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

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => window.print(), 100);
    return () => clearTimeout(timer);
  }, [ready]);

  return (
    <div className="print-page min-h-screen">
      <div className="print-toolbar no-print">
        <a href={`/ops/orders/${orderId}`} className="text-sm text-muted hover:text-foreground">
          ← Back to order
        </a>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-brand text-brand-ink px-4 py-2 text-sm font-semibold hover:opacity-90 transition"
        >
          🖨️ Print
        </button>
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
            >
              {cardMessage ?? "No card message"}
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
  return (
    <div>
      <div className="ops-field-label">{label}</div>
      <div className="ops-field-value">{value}</div>
    </div>
  );
}
