import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { TopBar } from "@/components/top-bar";

export default async function OpsLayout({ children }: LayoutProps<"/ops">) {
  const session = await requireRole("OPERATIONS");

  return (
    <div className="flex-1 flex flex-col bg-background">
      <TopBar name={session.name} role="OPERATIONS" title="Orders" />
      <nav className="max-w-3xl w-full mx-auto px-4 pt-4 flex gap-4 text-sm">
        <Link href="/ops" className="font-medium text-foreground hover:text-brand">
          Orders
        </Link>
        <Link href="/ops/employees" className="font-medium text-muted hover:text-brand">
          Team
        </Link>
      </nav>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-5">{children}</main>
    </div>
  );
}
