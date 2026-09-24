import Link from "next/link";
import { ReportTabs } from "@/components/report-tabs";

export default function ReportsLayout({ children }: LayoutProps<"/ops/reports">) {
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
