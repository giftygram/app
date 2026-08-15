"use client";

import { useRef, useState } from "react";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

/**
 * Camera photos are routinely 3-10MB — uploading that raw over a driver's
 * mobile data is the main source of the app feeling "stuck" after tapping
 * submit. Downscale + re-encode client-side before it ever reaches the
 * network. Falls back to the original file untouched if compression fails
 * for any reason (unsupported browser, corrupt image, etc.).
 */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap === "undefined") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY)
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function PhotoInput({
  name,
  label,
  required = true,
  useCamera = true,
  placeholder = "Tap to take a photo",
  onFileReady,
}: {
  name: string;
  label: string;
  required?: boolean;
  useCamera?: boolean;
  placeholder?: string;
  onFileReady?: (ready: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      onFileReady?.(false);
      return;
    }

    setBusy(true);
    onFileReady?.(false);
    try {
      const compressed = await compressImage(file);
      const dt = new DataTransfer();
      dt.items.add(compressed);
      if (inputRef.current) inputRef.current.files = dt.files;
      setPreview(URL.createObjectURL(compressed));
      onFileReady?.(true);
    } finally {
      setBusy(false);
    }
  }

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
          <span className="text-3xl">{busy ? "⏳" : "📷"}</span>
          <span className="text-sm">{busy ? "Preparing photo…" : placeholder}</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/*"
        capture={useCamera ? "environment" : undefined}
        required={required}
        className="sr-only"
        onChange={handleChange}
      />
      <span className="text-center text-sm font-medium text-brand">
        {busy ? "Preparing…" : preview ? "Change photo" : useCamera ? "Open camera" : "Choose photo"}
      </span>
    </label>
  );
}
