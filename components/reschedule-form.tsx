"use client";

import { useState, useTransition } from "react";
import { toDatetimeLocalValue } from "@/lib/date";
import { DateTimeField } from "@/components/datetime-field";

export function RescheduleForm({
  currentDeadline,
  action,
}: {
  currentDeadline: Date | null;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-xs font-medium text-brand hover:underline"
      >
        Reschedule delivery
      </button>
    );
  }

  return (
    <form
      className="self-start w-full flex flex-col gap-2 rounded-xl border border-line bg-background p-3 max-w-xs"
      action={(formData) => {
        startTransition(async () => {
          await action(formData);
          setOpen(false);
        });
      }}
    >
      <DateTimeField
        label="New delivery date & time"
        name="deadlineAt"
        required
        defaultValue={currentDeadline ? toDatetimeLocalValue(currentDeadline) : ""}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="flex-1 rounded-lg border border-line py-2 text-xs font-medium text-muted hover:text-foreground transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-brand text-brand-ink py-2 text-xs font-semibold hover:opacity-90 transition disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save new date"}
        </button>
      </div>
    </form>
  );
}
