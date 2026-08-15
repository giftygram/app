"use client";

import { useState, useTransition } from "react";
import { PhotoInput } from "@/components/photo-input";
import { cn } from "@/lib/cn";

/**
 * Wraps PhotoInput with explicit, always-visible validation instead of
 * relying on the file input's native `required` — that input is visually
 * hidden (sr-only) for styling, and a hidden required field's native
 * validation bubble can anchor to a near-invisible point or fail to show at
 * all on mobile, which made "nothing happens" the only feedback when a
 * driver tapped submit without a photo selected.
 */
export function PhotoActionForm({
  action,
  photoName = "photo",
  photoLabel,
  useCamera = true,
  photoPlaceholder,
  submitLabel,
  pendingLabel = "Uploading…",
  className,
  buttonClassName,
}: {
  action: (formData: FormData) => void | Promise<void>;
  photoName?: string;
  photoLabel: string;
  useCamera?: boolean;
  photoPlaceholder?: string;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [hasPhoto, setHasPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={cn("flex flex-col gap-4", className)}
      action={(formData) => {
        if (!hasPhoto) {
          setError("Add a photo before continuing.");
          return;
        }
        setError(null);
        startTransition(() => action(formData));
      }}
    >
      <PhotoInput
        name={photoName}
        label={photoLabel}
        required={false}
        useCamera={useCamera}
        placeholder={photoPlaceholder}
        onFileReady={(ready) => {
          setHasPhoto(ready);
          if (ready) setError(null);
        }}
      />
      {error && <p className="text-sm font-medium text-red-600 text-center">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "rounded-xl bg-brand text-brand-ink font-semibold py-3.5 hover:opacity-90 transition disabled:opacity-60 disabled:cursor-wait",
          buttonClassName
        )}
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
