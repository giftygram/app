import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSessionToken, type SessionPayload } from "@/lib/session";

export const SESSION_COOKIE = "gg_session";

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const payload = readSessionToken(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;

  // A validly-signed cookie can still point at an employee that's since been
  // deactivated or removed (e.g. after a database reset in dev) — treat that
  // the same as no session, rather than letting stale writes hit the DB.
  const employee = await db.employee.findUnique({ where: { id: payload.employeeId } });
  if (!employee || !employee.active) return null;

  return payload;
}

/** Redirects to /login if nobody is signed in. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Redirects to /login if signed out, or to their own home if wrong role. */
export async function requireRole(
  role: SessionPayload["role"]
): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== role) redirect(homeForRole(session.role));
  return session;
}

export function homeForRole(role: SessionPayload["role"]) {
  switch (role) {
    case "OPERATIONS":
      return "/ops";
    case "FLORIST":
      return "/florist";
    case "DRIVER":
      return "/driver";
  }
}
