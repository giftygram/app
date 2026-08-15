"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { hashPin } from "@/lib/pin";

export async function createEmployeeAction(formData: FormData) {
  await requireRole("OPERATIONS");

  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const pin = String(formData.get("pin") ?? "");

  if (!name) throw new Error("Name is required.");
  if (!["OPERATIONS", "FLORIST", "DRIVER"].includes(role)) {
    throw new Error("Choose a role.");
  }
  if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be exactly 4 digits.");

  await db.employee.create({
    data: { name, role, phone, pinHash: hashPin(pin) },
  });

  revalidatePath("/ops/employees");
}

export async function setEmployeeActiveAction(employeeId: string, active: boolean) {
  await requireRole("OPERATIONS");
  await db.employee.update({ where: { id: employeeId }, data: { active } });
  revalidatePath("/ops/employees");
}

/** Fills in a team driver's phone after the fact — added before this was captured, or typo'd. */
export async function updateEmployeePhoneAction(employeeId: string, formData: FormData) {
  await requireRole("OPERATIONS");

  const phone = String(formData.get("phone") ?? "").trim();
  if (!phone) throw new Error("Enter a phone number.");

  await db.employee.update({ where: { id: employeeId }, data: { phone } });

  revalidatePath("/ops/employees");
  revalidatePath("/ops");
}
