"use client";

import { cn } from "@/lib/cn";

/**
 * A real in-app modal, not window.confirm() — native confirm dialogs are
 * unreliable on mobile (some browsers silently suppress repeated dialogs
 * after a "prevent this page from creating more" checkbox), which is how a
 * mis-click on Cancel order slipped through with no prompt at all.
 */
export function ConfirmOverlay({
  message,
  detail,
  confirmLabel = "Confirm",
  cancelLabel = "Go back",
  danger = false,
  pending = false,
  onConfirm,
  onCancel,
}: {
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl bg-surface border border-line p-5 flex flex-col gap-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-base font-semibold text-foreground text-balance">{message}</p>
          {detail && <p className="text-sm text-muted mt-1">{detail}</p>}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-foreground hover:border-brand transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={cn(
              "flex-1 rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-60 disabled:cursor-wait",
              danger ? "bg-red-600 text-white hover:opacity-90" : "bg-brand text-brand-ink hover:opacity-90"
            )}
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
