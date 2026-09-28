import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { ReportTabs } from "@/components/report-tabs";

export default async function ReportsLayout({ children }: LayoutProps<"/ops/reports">) {
  // Staff output figures are Operations'. Gating the whole subtree here means
  // a report added later is covered without anyone having to remember.
  await requireRole("OPERATIONS");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/ops" className="text-sm text-muted hover:text-foreground">
          ← Back to orders
        </Link>
        <h2 className="text-lg font-semibold text-foreground mt-2">Reports</h2>
      </div>
      <ReportTabs />
      {children}
    </div>
  );
}
