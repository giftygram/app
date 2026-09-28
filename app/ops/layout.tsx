import Link from "next/link";
import { requireOpsAccess } from "@/lib/auth";
import { isFullOperations } from "@/lib/roles";
import { TopBar } from "@/components/top-bar";
import { NoDateBanner } from "@/components/no-date-banner";
import { PastDueBanner } from "@/components/past-due-banner";
import { SliderLiveRefresh } from "@/components/slider-live-refresh";

export default async function OpsLayout({ children }: LayoutProps<"/ops">) {
  const session = await requireOpsAccess();
  const fullOps = isFullOperations(session.role);

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Mounted at the layout so it survives navigation between the board and
          an order, and so there's exactly one poller no matter which ops page
          is open. Renders nothing.

          Full Operations only: the sync it calls is theirs, and a Service &
          sales session polling it would be bounced to /ops mid-poll. Someone
          with dispatch rights almost always has the board open anyway, and
          the cron covers the rest. */}
      {fullOps && <SliderLiveRefresh />}
      <TopBar
        name={session.name}
        role={session.role}
        title="Orders"
        banner={
          <>
            <NoDateBanner />
            <PastDueBanner />
          </>
        }
      />
      <nav className="max-w-3xl w-full mx-auto px-4 pt-4 flex gap-4 text-sm">
        <Link href="/ops" className="font-medium text-foreground hover:text-brand">
          Orders
        </Link>
        {/* Both are Operations-only, and both pages enforce that themselves —
            hiding them here just keeps Service & sales from walking into a
            redirect. */}
        {fullOps && (
          <>
            <Link href="/ops/employees" className="font-medium text-muted hover:text-brand">
              Team
            </Link>
            <Link href="/ops/reports" className="font-medium text-muted hover:text-brand">
              Reports
            </Link>
          </>
        )}
      </nav>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-5">{children}</main>
    </div>
  );
}
