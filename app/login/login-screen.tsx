"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { loginAction } from "@/app/actions/auth";
import { cn } from "@/lib/cn";

type Role = "OPERATIONS" | "FLORIST" | "DRIVER";
type Employee = { id: string; name: string; role: Role };

const ROLE_LABEL: Record<Role, string> = {
  OPERATIONS: "Operations",
  FLORIST: "Florist",
  DRIVER: "Driver",
};

export default function LoginScreen({ employees }: { employees: Employee[] }) {
  const [role, setRole] = useState<Role>("OPERATIONS");
  const [selected, setSelected] = useState<Employee | null>(null);

  const byRole = useMemo(
    () => employees.filter((e) => e.role === role),
    [employees, role]
  );

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-10 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image
            src="/logo.png"
            alt="GiftyGram Flowers"
            width={1000}
            height={500}
            priority
            className="mx-auto h-20 w-auto mb-2"
          />
          <p className="text-sm text-muted mt-1">Sign in to see your orders</p>
        </div>

        {selected ? (
          <PinPad employee={selected} onBack={() => setSelected(null)} />
        ) : (
          <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm">
            <div className="grid grid-cols-3 gap-1 mb-5 bg-background rounded-xl p-1">
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={cn(
                    "rounded-lg py-2 text-sm font-medium transition-colors",
                    role === r
                      ? "bg-brand text-brand-ink shadow-sm"
                      : "text-muted hover:text-foreground"
                  )}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>

            {byRole.length === 0 ? (
              <p className="text-sm text-muted text-center py-6">
                No {ROLE_LABEL[role].toLowerCase()} accounts yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {byRole.map((employee) => (
                  <button
                    key={employee.id}
                    onClick={() => setSelected(employee)}
                    className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-left hover:border-brand hover:bg-brand-soft transition-colors"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand font-semibold text-sm">
                      {initials(employee.name)}
                    </span>
                    <span className="font-medium text-foreground">{employee.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function PinPad({ employee, onBack }: { employee: Employee; onBack: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function press(digit: string) {
    if (pending) return;
    setError(null);
    const next = (pin + digit).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      startTransition(async () => {
        const result = await loginAction(employee.id, next);
        if (result.ok) {
          router.push(result.home);
        } else {
          setError(result.error);
          setPin("");
        }
      });
    }
  }

  return (
    <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="text-muted hover:text-foreground text-sm px-2 py-1 -ml-2"
          aria-label="Back"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand font-semibold text-xs">
            {initials(employee.name)}
          </span>
          <span className="font-medium text-foreground">{employee.name}</span>
        </div>
      </div>

      <div className="flex justify-center gap-3 mb-6" aria-live="polite">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-3.5 w-3.5 rounded-full border-2",
              i < pin.length ? "bg-brand border-brand" : "border-line"
            )}
          />
        ))}
      </div>

      {error && (
        <p className="text-center text-sm text-rose mb-4">{error}</p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            onClick={() => press(d)}
            disabled={pending}
            className="h-14 rounded-xl border border-line text-lg font-medium text-foreground hover:bg-background active:scale-[0.97] transition disabled:opacity-50"
          >
            {d}
          </button>
        ))}
        <div />
        <button
          onClick={() => press("0")}
          disabled={pending}
          className="h-14 rounded-xl border border-line text-lg font-medium text-foreground hover:bg-background active:scale-[0.97] transition disabled:opacity-50"
        >
          0
        </button>
        <button
          onClick={() => setPin(pin.slice(0, -1))}
          disabled={pending || pin.length === 0}
          className="h-14 rounded-xl text-sm font-medium text-muted hover:bg-background active:scale-[0.97] transition disabled:opacity-30"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function initials(name: string) {
  const letters = name.match(/[A-Za-z]+/g) ?? [];
  return letters
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
