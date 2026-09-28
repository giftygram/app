import { db } from "@/lib/db";
import type { Role } from "@/lib/roles";
import { getSession, homeForRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import LoginScreen from "./login-screen";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(homeForRole(session.role));

  const employees = await db.employee.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  return (
    <LoginScreen
      employees={employees as { id: string; name: string; role: Role }[]}
    />
  );
}
