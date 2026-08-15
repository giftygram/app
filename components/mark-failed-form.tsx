"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";

const REASONS = [
  "Recipient not answering",
  "Wrong or incomplete address",
  "Recipient refused delivery",
  "Recipient asked to reschedule",
  "Other",
];

export function MarkFailedForm({
  action,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "w-full rounded-xl border border-red-200 text-red-600 py-3 text-sm font-semibold hover:border-red-400 hover:bg-red-50 transition",
          className
        )}
      >
        Couldn&apos;t deliver
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50/60 p-4"
      action={(formData) => startTransition(() => action(formData))}
    >
      <p className="text-sm font-semibold text-foreground">Why couldn&apos;t this be delivered?</p>
      <select
        name="reason"
        value={reason}
        disabled={pending}
        onChange={(e) => setReason(e.target.value)}
        className="rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-60"
      >
        {REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {reason === "Other" && (
        <textarea
          name="reasonNote"
          required
          autoFocus
          rows={2}
          disabled={pending}
          placeholder="What happened?"
          className="rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand resize-none disabled:opacity-60"
        />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => setOpen(false)}
          className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium text-muted hover:text-foreground transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-xl bg-red-600 text-white py-2.5 text-sm font-semibold hover:opacity-90 transition disabled:opacity-60 disabled:cursor-wait"
        >
          {pending ? "Saving…" : "Confirm failed delivery"}
        </button>
      </div>
    </form>
  );
}
