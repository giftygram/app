import { db } from "@/lib/db";
import { createEmployeeAction, setEmployeeActiveAction } from "@/app/actions/employees";
import { ToggleActive } from "@/components/toggle-active";
import { SubmitButton } from "@/components/submit-button";

const ROLE_LABEL = { OPERATIONS: "Operations", FLORIST: "Florist", DRIVER: "Driver" } as const;

export default async function EmployeesPage() {
  const employees = await db.employee.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] });

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Add team member</h2>
        <form action={createEmployeeAction} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              name="name"
              required
              placeholder="Full name"
              className="col-span-2 rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <select
              name="role"
              required
              defaultValue=""
              className="rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="" disabled>
                Role
              </option>
              <option value="OPERATIONS">Operations</option>
              <option value="FLORIST">Florist</option>
              <option value="DRIVER">Driver</option>
            </select>
            <input
              name="pin"
              required
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              placeholder="4-digit PIN"
              className="rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <SubmitButton
            pendingText="Adding…"
            className="rounded-xl bg-brand text-brand-ink font-semibold py-2.5 text-sm hover:opacity-90 transition"
          >
            Add
          </SubmitButton>
        </form>
      </section>

      <section className="flex flex-col gap-2.5">
        {employees.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-foreground">
                {e.name}
                {!e.active && <span className="text-muted font-normal"> (inactive)</span>}
              </p>
              <p className="text-xs text-muted">{ROLE_LABEL[e.role as keyof typeof ROLE_LABEL]}</p>
            </div>
            <ToggleActive employeeId={e.id} active={e.active} action={setEmployeeActiveAction} />
          </div>
        ))}
      </section>
    </div>
  );
}
