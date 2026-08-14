"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function ZoomablePhoto({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open photo, pinch to zoom"
        className="relative aspect-square w-full rounded-2xl overflow-hidden border border-line block"
      >
        <Image src={src} alt={alt} fill className="object-cover" />
        <span className="absolute bottom-2 right-2 rounded-full bg-black/50 text-white text-[11px] font-medium px-2.5 py-1">
          Tap to zoom
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/95 overflow-auto"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="fixed top-4 right-4 z-10 h-10 w-10 rounded-full bg-white/10 text-white text-xl flex items-center justify-center"
          >
            ×
          </button>
          <div className="min-h-full flex items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              onClick={(e) => e.stopPropagation()}
              className="max-w-none w-full sm:w-auto sm:max-w-[90vw] sm:max-h-[85vh] object-contain"
            />
          </div>
          {caption && (
            <p className="fixed bottom-4 left-0 right-0 text-center text-white/80 text-xs">
              {caption}
            </p>
          )}
        </div>
      )}
    </>
  );
}
