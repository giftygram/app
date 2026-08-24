"use client";

import { useState, useTransition } from "react";

export function EditDriverForm({
  currentName,
  currentPhone,
  action,
}: {
  currentName: string;
  currentPhone: string | null;
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
        Edit name/phone
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3"
      action={(formData) => {
        startTransition(async () => {
          await action(formData);
          setOpen(false);
        });
      }}
    >
      <input
        type="text"
        name="name"
        required
        defaultValue={currentName}
        placeholder="Name"
        className="rounded-lg border border-line bg-background px-2.5 py-1.5 text-xs placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
      />
      <input
        type="tel"
        name="phone"
        required
        defaultValue={currentPhone ?? ""}
        placeholder="Phone number"
        className="rounded-lg border border-line bg-background px-2.5 py-1.5 text-xs placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="flex-1 rounded-lg border border-line py-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-brand text-brand-ink py-1.5 text-xs font-semibold hover:opacity-90 transition disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
