"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/ops/reports/florists", label: "Florists" },
  { href: "/ops/reports/drivers", label: "Drivers" },
];

export function ReportTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors",
              active
                ? "border-brand bg-brand-soft text-brand"
                : "border-line text-muted hover:border-brand hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
