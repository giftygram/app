"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function ApprovalCountdown({ deadline }: { deadline: string }) {
  const router = useRouter();
  const target = new Date(deadline).getTime();
  const [msLeft, setMsLeft] = useState(() => target - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const left = target - Date.now();
      setMsLeft(left);
      if (left <= 0) {
        clearInterval(id);
        // Flip the page over to the auto-approved view without the customer
        // needing to refresh — the server re-derives approval from "now".
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [target, router]);

  if (msLeft <= 0) return null;

  const totalSeconds = Math.max(0, Math.floor(msLeft / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return (
    <p className="text-xs text-muted">
      We&apos;ll send it as is in{" "}
      <span className="font-semibold text-foreground tabular-nums">
        {mins}:{String(secs).padStart(2, "0")}
      </span>{" "}
      if we don&apos;t hear from you
    </p>
  );
}
