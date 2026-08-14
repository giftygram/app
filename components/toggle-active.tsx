"use client";

import { useTransition } from "react";

export function ToggleActive({
  employeeId,
  active,
  action,
}: {
  employeeId: string;
  active: boolean;
  action: (employeeId: string, active: boolean) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => action(employeeId, !active))}
      className="text-xs font-medium text-muted hover:text-foreground disabled:opacity-50"
    >
      {active ? "Deactivate" : "Reactivate"}
    </button>
  );
}
