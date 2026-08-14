"use client";

import { useState } from "react";

export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(`${window.location.origin}${path}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-sm font-medium text-brand hover:underline text-left break-all"
    >
      {copied ? "Copied ✓" : path}
    </button>
  );
}
