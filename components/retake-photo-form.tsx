"use client";

import { useState } from "react";
import { PhotoActionForm } from "@/components/photo-action-form";

export function RetakePhotoForm({
  action,
  photoLabel,
  triggerLabel = "Retake photo",
  useCamera = true,
}: {
  action: (formData: FormData) => Promise<void>;
  photoLabel: string;
  triggerLabel?: string;
  useCamera?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-sm font-medium text-brand hover:underline"
      >
        {triggerLabel}
      </button>
    );
  }

  return (
    <div className="self-start w-full flex flex-col gap-2 rounded-xl border border-line bg-background p-3">
      <PhotoActionForm
        action={async (formData) => {
          await action(formData);
          setOpen(false);
        }}
        photoLabel={photoLabel}
        useCamera={useCamera}
        submitLabel="Save new photo"
        pendingLabel="Uploading…"
      />
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm text-muted hover:text-foreground text-center"
      >
        Cancel
      </button>
    </div>
  );
}
