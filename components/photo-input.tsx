"use client";

import { useState } from "react";

export function PhotoInput({
  name,
  label,
  required = true,
  useCamera = true,
  placeholder = "Tap to take a photo",
}: {
  name: string;
  label: string;
  required?: boolean;
  useCamera?: boolean;
  placeholder?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Preview"
          className="w-full aspect-square object-cover rounded-2xl border border-line"
        />
      ) : (
        <div className="w-full aspect-square rounded-2xl border-2 border-dashed border-line flex flex-col items-center justify-center gap-2 text-muted">
          <span className="text-3xl">📷</span>
          <span className="text-sm">{placeholder}</span>
        </div>
      )}
      <input
        type="file"
        name={name}
        accept="image/*"
        capture={useCamera ? "environment" : undefined}
        required={required}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setPreview(URL.createObjectURL(file));
        }}
      />
      <span className="text-center text-sm font-medium text-brand">
        {preview ? "Change photo" : useCamera ? "Open camera" : "Choose photo"}
      </span>
    </label>
  );
}
