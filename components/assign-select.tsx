"use client";

import { useTransition } from "react";

export function AssignSelect({
  orderId,
  value,
  options,
  placeholder,
  action,
}: {
  orderId: string;
  value: string | null;
  options: { id: string; name: string }[];
  placeholder: string;
  action: (orderId: string, employeeId: string) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={value ?? ""}
      disabled={pending}
      onChange={(e) => {
        const employeeId = e.target.value;
        if (!employeeId) return;
        startTransition(() => action(orderId, employeeId));
      }}
      className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-60"
    >
      <option value="" disabled>
        {pending ? "Assigning…" : placeholder}
      </option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
