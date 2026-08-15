"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";

/**
 * Must be rendered as a child of the <form> it belongs to (useFormStatus
 * reads context from the nearest parent form), not the form itself.
 */
export function SubmitButton({
  children,
  pendingText,
  className,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(className, pending && "opacity-60 cursor-wait")}
    >
      {pending ? (pendingText ?? "Working…") : children}
    </button>
  );
}
