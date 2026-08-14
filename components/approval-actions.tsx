"use client";

import { useState, useTransition } from "react";
import { approveBouquetAction, requestBouquetChangesAction } from "@/app/actions/orders";

export function ApprovalActions({ orderId }: { orderId: string }) {
  const [mode, setMode] = useState<"choose" | "changes">("choose");
  const [pending, startTransition] = useTransition();

  if (mode === "changes") {
    return (
      <form action={requestBouquetChangesAction.bind(null, orderId)} className="w-full flex flex-col gap-2">
        <textarea
          name="note"
          required
          autoFocus
          rows={3}
          placeholder="What would you like changed?"
          className="rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand resize-none"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("choose")}
            className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
          >
            Back
          </button>
          <button
            type="submit"
            className="flex-1 rounded-xl bg-brand text-brand-ink py-2.5 text-sm font-semibold hover:opacity-90 transition"
          >
            Send feedback
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex gap-2 w-full">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => approveBouquetAction(orderId))}
        className="flex-1 rounded-xl bg-brand text-brand-ink py-3 text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
      >
        {pending ? "…" : "✓ Looks great"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setMode("changes")}
        className="flex-1 rounded-xl border border-line py-3 text-sm font-semibold text-foreground hover:border-brand transition-colors disabled:opacity-50"
      >
        Ask for changes
      </button>
    </div>
  );
}
