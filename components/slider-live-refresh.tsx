"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { refreshSliderOrdersAction } from "@/app/actions/slider";

/**
 * Keeps Slider-linked orders fresh while someone is actually looking at the
 * screen.
 *
 * The cron is the safety net — it catches deliveries that finish while nobody
 * is at a screen, so the customer's "delivered" email still goes out — but how
 * often it may run depends on the Vercel plan, and Operations shouldn't be
 * watching a stale board because of a billing tier. So the screen refreshes
 * itself: cheap when nothing changed, and the server skips orders it checked
 * seconds ago, so several people with the board open don't multiply into a
 * burst of calls for the same order.
 *
 * Renders nothing.
 */
const INTERVAL_MS = 20_000;

export function SliderLiveRefresh() {
  const router = useRouter();
  // A slow sync must not overlap with the next tick.
  const running = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      // A backgrounded tab shouldn't poll — phones leave the ops board open
      // all day.
      if (running.current || document.visibilityState !== "visible") return;
      running.current = true;
      try {
        const changed = await refreshSliderOrdersAction();
        if (changed && !cancelled) router.refresh();
      } catch {
        // Not worth putting an error in Operations' face: the cron is still
        // running and the next tick tries again.
      } finally {
        running.current = false;
      }
    }

    tick();
    const interval = setInterval(tick, INTERVAL_MS);
    // Coming back to the tab should show the truth immediately.
    document.addEventListener("visibilitychange", tick);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);

  return null;
}
