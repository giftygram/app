import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSessionToken, type SessionPayload } from "@/lib/session";
import { hasOpsAccess } from "@/lib/roles";

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

/**
 * Redirects to /login if signed out, or to their own home if wrong role.
 *
 * An exact match on purpose: requireRole("OPERATIONS") means *full*
 * Operations, never Service & sales. Every restricted action keeps using it,
 * so anything not deliberately opened up stays shut — a new page that forgets
 * to think about roles fails closed rather than open.
 */
export async function requireRole(
  role: SessionPayload["role"]
): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== role) redirect(homeForRole(session.role));
  return session;
}

/**
 * For the parts of Operations that Service & sales share — the board, an
 * order's detail, editing customer details. Callers that render privileged
 * controls must still check isFullOperations() on the returned role.
 */
export async function requireOpsAccess(): Promise<SessionPayload> {
  const session = await requireSession();
  if (!hasOpsAccess(session.role)) redirect(homeForRole(session.role));
  return session;
}

export function homeForRole(role: SessionPayload["role"]) {
  switch (role) {
    case "OPERATIONS":
    case "SUPPORT":
      return "/ops";
    case "FLORIST":
      return "/florist";
    case "DRIVER":
      return "/driver";
  }
}
