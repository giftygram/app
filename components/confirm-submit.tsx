"use client";

import { useRef, useState } from "react";
import { ConfirmOverlay } from "@/components/confirm-overlay";

export function ConfirmSubmit({
  confirmText,
  confirmDetail,
  confirmLabel = "Yes, continue",
  danger = true,
  className,
  children,
}: {
  confirmText: string;
  confirmDetail?: string;
  confirmLabel?: string;
  danger?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <>
      <button type="button" ref={btnRef} className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && (
        <ConfirmOverlay
          message={confirmText}
          detail={confirmDetail}
          confirmLabel={confirmLabel}
          danger={danger}
          pending={pending}
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            setPending(true);
            btnRef.current?.closest("form")?.requestSubmit();
          }}
        />
      )}
    </>
  );
}
