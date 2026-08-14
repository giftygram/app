"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verifyPin } from "@/lib/pin";
import { createSessionToken } from "@/lib/session";
import { SESSION_COOKIE, homeForRole } from "@/lib/auth";

type LoginResult = { ok: true; home: string } | { ok: false; error: string };

export async function loginAction(
  employeeId: string,
  pin: string
): Promise<LoginResult> {
  const employee = await db.employee.findUnique({ where: { id: employeeId } });

  if (!employee || !employee.active || !verifyPin(pin, employee.pinHash)) {
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
