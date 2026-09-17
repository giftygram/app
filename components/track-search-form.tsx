"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TrackSearchForm() {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        // Tokens are lowercase — normalize so a phone's auto-capitalized
        // first letter or a mixed-case paste still matches.
        const token = value.trim().toLowerCase();
        if (!token) return;
        // This page is also served on-domain for customers via Shopify's App
        // Proxy at giftygram.ae/apps/track — same route tree, but the
        // browser's address bar carries the /apps/track prefix that our
        // server never sees (Shopify strips it before forwarding). Stay
        // under whatever prefix is actually visible, or this navigates to a
        // path Shopify never proxies.
        const base = window.location.pathname.startsWith("/apps/track") ? "/apps/track" : "/track";
        router.push(`${base}/${encodeURIComponent(token)}`);
      }}
    >
      <input
        type="text"
        inputMode="text"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="e.g. k3f9m2xq8p"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-center text-base placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="w-full rounded-xl bg-brand text-brand-ink px-4 py-3 text-sm font-semibold shadow-sm hover:opacity-90 transition disabled:opacity-50"
      >
        Track my order
      </button>
    </form>
  );
}
