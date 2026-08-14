"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { hashPin } from "@/lib/pin";

export async function createEmployeeAction(formData: FormData) {
  await requireRole("OPERATIONS");

  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const pin = String(formData.get("pin") ?? "");

  if (!name) throw new Error("Name is required.");
  if (!["OPERATIONS", "FLORIST", "DRIVER"].includes(role)) {
    throw new Error("Choose a role.");
  }
  if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be exactly 4 digits.");

  await db.employee.create({
    data: { name, role, pinHash: hashPin(pin) },
  });

  revalidatePath("/ops/employees");
}

export async function setEmployeeActiveAction(employeeId: string, active: boolean) {
  await requireRole("OPERATIONS");
  await db.employee.update({ where: { id: employeeId }, data: { active } });
  revalidatePath("/ops/employees");
}
