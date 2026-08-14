import { logoutAction } from "@/app/actions/auth";

const ROLE_LABEL = {
  OPERATIONS: "Operations",
  FLORIST: "Florist",
  DRIVER: "Driver",
} as const;

export function TopBar({
  name,
  role,
  title,
}: {
  name: string;
  role: keyof typeof ROLE_LABEL;
  title: string;
}) {
  return (
    <header className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-line">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">{ROLE_LABEL[role]}</p>
          <h1 className="text-base font-semibold text-foreground leading-tight">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted hidden sm:inline">{name}</span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-sm font-medium text-muted hover:text-rose px-3 py-1.5 rounded-lg border border-line hover:border-rose transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
