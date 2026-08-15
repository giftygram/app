"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verifyPin } from "@/lib/pin";
import { createSessionToken } from "@/lib/session";
import { SESSION_COOKIE, homeForRole } from "@/lib/auth";

type LoginResult = { ok: true; home: string } | { ok: false; error: string };

// Rate-limited by IP, not by account: the PIN pad has no per-employee lock,
// on purpose — a long account lockout is itself a denial-of-service against
// the real employee (anyone who knows their name could lock them out
// indefinitely). Instead, failed attempts from the same connection get
// throttled within a short sliding window, so brute-forcing a 4-digit PIN
// (10,000 combinations) becomes impractically slow while a legitimate
// employee mistyping their PIN a couple of times is never affected, and
// even a real lockout self-clears in well under a minute.
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const PER_EMPLOYEE_FAILURE_LIMIT = 5;
const PER_IP_FAILURE_LIMIT = 20;

async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

export async function loginAction(
  employeeId: string,
  pin: string
): Promise<LoginResult> {
  const ip = await getClientIp();
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  const [employeeFailures, ipFailures] = await Promise.all([
    db.loginAttempt.count({ where: { ip, employeeId, success: false, createdAt: { gte: since } } }),
    db.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } }),
  ]);

  if (employeeFailures >= PER_EMPLOYEE_FAILURE_LIMIT || ipFailures >= PER_IP_FAILURE_LIMIT) {
    return { ok: false, error: "Too many attempts. Please wait a moment and try again." };
  }

  const employee = await db.employee.findUnique({ where: { id: employeeId } });
  const valid = !!employee && employee.active && verifyPin(pin, employee.pinHash);

  await db.loginAttempt.create({ data: { ip, employeeId, success: valid } });

  if (!employee || !valid) {
    return { ok: false, error: "Wrong PIN. Try again." };
  }

  const role = employee.role as "OPERATIONS" | "FLORIST" | "DRIVER";
  const token = createSessionToken({
    employeeId: employee.id,
    name: employee.name,
    role,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return { ok: true, home: homeForRole(role) };
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
