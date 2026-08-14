import { requireRole } from "@/lib/auth";
import { TopBar } from "@/components/top-bar";

export default async function DriverLayout({ children }: LayoutProps<"/driver">) {
  const session = await requireRole("DRIVER");

  return (
    <div className="flex-1 flex flex-col bg-background">
      <TopBar name={session.name} role="DRIVER" title="My deliveries" />
      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-5">{children}</main>
    </div>
  );
}
