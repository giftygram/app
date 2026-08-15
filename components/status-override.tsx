"use client";

import { useRef, useState, useTransition } from "react";
import { ORDER_STATUSES, STATUS_META, type OrderStatus } from "@/lib/status";
import { ConfirmOverlay } from "@/components/confirm-overlay";

export function StatusOverride({
  orderId,
  current,
  action,
}: {
  orderId: string;
  current: OrderStatus;
  action: (orderId: string, formData: FormData) => void | Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [confirmValue, setConfirmValue] = useState<OrderStatus | null>(null);

  return (
    <>
      <form
        ref={formRef}
        action={(formData) => startTransition(() => action(orderId, formData))}
      >
        <select
          name="status"
          defaultValue={current}
          disabled={pending}
          onChange={(e) => {
            const value = e.target.value as OrderStatus;
            if (value === current) return;
            setConfirmValue(value);
          }}
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-60"
        >
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
      </form>

      {confirmValue && (
        <ConfirmOverlay
          message={`Change status to "${STATUS_META[confirmValue].label}"?`}
          detail="This skips the normal order flow and any checks along the way (photos, approval, etc.)."
          confirmLabel="Yes, change status"
          danger
          pending={pending}
          onCancel={() => {
            setConfirmValue(null);
            if (formRef.current) {
              const select = formRef.current.querySelector("select");
              if (select) select.value = current;
            }
          }}
          onConfirm={() => {
            const value = confirmValue;
            const select = formRef.current?.querySelector("select");
            if (select) select.value = value;
            setConfirmValue(null);
            formRef.current?.requestSubmit();
          }}
        />
      )}
    </>
  );
}
