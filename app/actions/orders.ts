"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { nextWhatsAppOrderNumber } from "@/lib/orderNumber";
import { savePhoto } from "@/lib/photos";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/status";
import { approvalDeadlineFromNow, effectiveApproval } from "@/lib/approval";
import { formatDubaiDateTime, fromDatetimeLocalValue } from "@/lib/date";

async function logStatus(
  orderId: string,
  fromStatus: string | null,
  toStatus: OrderStatus,
  employeeId: string | null
) {
  await db.statusEvent.create({
    data: { orderId, fromStatus, toStatus, employeeId },
  });
}

export async function createOrderAction(formData: FormData) {
  const session = await requireRole("OPERATIONS");

  const senderName = String(formData.get("senderName") ?? "").trim() || null;
  const senderPhone = String(formData.get("senderPhone") ?? "").trim() || null;
  const bouquetName = String(formData.get("bouquetName") ?? "").trim() || null;
  const recipientName = String(formData.get("recipientName") ?? "").trim();
  const recipientPhone = String(formData.get("recipientPhone") ?? "").trim();
  const deliveryAddress = String(formData.get("deliveryAddress") ?? "").trim();
  const deliveryArea = String(formData.get("deliveryArea") ?? "").trim() || null;
  const mapsLink = String(formData.get("mapsLink") ?? "").trim() || null;
  const cardMessage = String(formData.get("cardMessage") ?? "").trim() || null;
  const occasion = String(formData.get("occasion") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const deadlineRaw = String(formData.get("deadlineAt") ?? "");
  const deadlineAt = deadlineRaw ? fromDatetimeLocalValue(deadlineRaw) : null;

  if (!recipientName || !recipientPhone || !deliveryAddress) {
    throw new Error("Recipient name, phone, and address are required.");
  }

  const orderNumber = await nextWhatsAppOrderNumber();

  const order = await db.order.create({
    data: {
      orderNumber,
      source: "WHATSAPP",
      status: "NEW",
      senderName,
      senderPhone,
      bouquetName,
      recipientName,
      recipientPhone,
      deliveryAddress,
      deliveryArea,
      mapsLink,
      cardMessage,
      occasion,
      notes,
      deadlineAt,
    },
  });

  const referenceImage = formData.get("referenceImage");
  if (referenceImage instanceof File && referenceImage.size > 0) {
    const url = await savePhoto(order.id, "REFERENCE", referenceImage);
    await db.order.update({ where: { id: order.id }, data: { referenceImageUrl: url } });
  }

  await logStatus(order.id, null, "NEW", session.employeeId);

  revalidatePath("/ops");
  redirect(`/ops/orders/${order.id}`);
}

/** Lets Operations fix a typo'd address, etc. after the fact. */
export async function updateOrderAction(orderId: string, formData: FormData) {
  await requireRole("OPERATIONS");

  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });

  const senderName = String(formData.get("senderName") ?? "").trim() || null;
  const senderPhone = String(formData.get("senderPhone") ?? "").trim() || null;
  const bouquetName = String(formData.get("bouquetName") ?? "").trim() || null;
  const recipientName = String(formData.get("recipientName") ?? "").trim();
  const recipientPhone = String(formData.get("recipientPhone") ?? "").trim();
  const deliveryAddress = String(formData.get("deliveryAddress") ?? "").trim();
  const deliveryArea = String(formData.get("deliveryArea") ?? "").trim() || null;
  const cardMessage = String(formData.get("cardMessage") ?? "").trim() || null;
  const occasion = String(formData.get("occasion") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const deadlineRaw = String(formData.get("deadlineAt") ?? "");
  const deadlineAt = deadlineRaw ? fromDatetimeLocalValue(deadlineRaw) : null;

  if (!recipientName || !recipientPhone || !deliveryAddress) {
    throw new Error("Recipient name, phone, and address are required.");
  }

  await db.order.update({
    where: { id: orderId },
    data: {
      senderName,
      senderPhone,
      bouquetName,
      recipientName,
      recipientPhone,
      deliveryAddress,
      deliveryArea,
      cardMessage,
      occasion,
      notes,
      deadlineAt,
    },
  });

  revalidatePath("/ops");
  revalidatePath(`/ops/orders/${orderId}`);
  revalidatePath(`/track/${encodeURIComponent(order.orderNumber)}`);
  redirect(`/ops/orders/${orderId}`);
}

/**
 * Quick, dedicated reschedule — customers sometimes ask to move their
 * delivery to a different day. Deliberately separate from
 * updateOrderAction (which requires re-submitting every field) so this is
 * a two-field, low-friction action, and leaves a timeline entry so the
 * team can see a reschedule happened instead of the deadline silently
 * changing.
 */
export async function rescheduleOrderAction(orderId: string, formData: FormData) {
  const session = await requireRole("OPERATIONS");

  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });

  const deadlineRaw = String(formData.get("deadlineAt") ?? "");
  const deadlineAt = deadlineRaw ? fromDatetimeLocalValue(deadlineRaw) : null;
  if (!deadlineAt) throw new Error("Choose a new delivery date and time.");

  await db.order.update({ where: { id: orderId }, data: { deadlineAt } });
  await db.statusEvent.create({
    data: {
      orderId,
      fromStatus: null,
      toStatus: `Rescheduled to ${formatDubaiDateTime(deadlineAt)}`,
      employeeId: session.employeeId,
    },
  });

  revalidatePath("/ops");
  revalidatePath(`/ops/orders/${orderId}`);
  revalidatePath(`/track/${encodeURIComponent(order.orderNumber)}`);
}

/**
 * Set from the order card, right next to florist/driver assignment — Maps
 * links usually come in after the fact (recipient shares their pin over
 * WhatsApp), not at order creation.
 */
export async function updateMapsLinkAction(orderId: string, formData: FormData) {
  await requireRole("OPERATIONS");

  const mapsLink = String(formData.get("mapsLink") ?? "").trim() || null;

  await db.order.update({ where: { id: orderId }, data: { mapsLink } });

  revalidatePath("/ops");
  revalidatePath(`/ops/orders/${orderId}`);
}

export async function assignFloristAction(orderId: string, floristId: string) {
  const session = await requireRole("OPERATIONS");

  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "NEW" && order.status !== "ASSIGNED_FLORIST") {
    throw new Error("This order has already moved past the florist stage.");
  }

  await db.order.update({
    where: { id: orderId },
    data: { floristId, status: "ASSIGNED_FLORIST" },
  });

  if (order.status !== "ASSIGNED_FLORIST") {
    await logStatus(orderId, order.status, "ASSIGNED_FLORIST", session.employeeId);
  }

  revalidatePath("/ops");
  revalidatePath(`/ops/orders/${orderId}`);
  revalidatePath("/florist");
}

function assertCanDispatch(order: { status: string; approvalStatus: string; approvalDeadline: Date | null }) {
  if (order.status !== "READY" && order.status !== "ASSIGNED_DRIVER") {
    throw new Error("This order isn't ready for a driver yet.");
  }
  if (order.status === "READY" && effectiveApproval(order) !== "APPROVED") {
    throw new Error("Waiting on the customer to approve the bouquet before this can be dispatched.");
  }
}

/** Assigns one of your own PIN-login drivers. */
export async function assignDriverAction(orderId: string, driverId: string) {
  const session = await requireRole("OPERATIONS");

  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  assertCanDispatch(order);

  await db.order.update({
    where: { id: orderId },
    data: { driverId, externalDriverName: null, externalDriverPhone: null, status: "ASSIGNED_DRIVER" },
  });

  if (order.status !== "ASSIGNED_DRIVER") {
    await logStatus(orderId, order.status, "ASSIGNED_DRIVER", session.employeeId);
  }

  revalidatePath("/ops");
  revalidatePath(`/ops/orders/${orderId}`);
  revalidatePath("/driver");
}

/**
 * Assigns an outside courier who has no account — Operations shares the
 * /deliver/[id] link with them (WhatsApp, SMS, whatever) instead.
 */
export async function assignExternalDriverAction(orderId: string, formData: FormData) {
  const session = await requireRole("OPERATIONS");

  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  assertCanDispatch(order);

  const name = String(formData.get("externalDriverName") ?? "").trim();
  const phone = String(formData.get("externalDriverPhone") ?? "").trim();
  if (!name) throw new Error("Enter the courier's name.");
  if (!phone) throw new Error("Enter the courier's phone number — you'll need it to reach them.");

  await db.order.update({
    where: { id: orderId },
    data: { driverId: null, externalDriverName: name, externalDriverPhone: phone, status: "ASSIGNED_DRIVER" },
  });

  if (order.status !== "ASSIGNED_DRIVER") {
    await logStatus(orderId, order.status, "ASSIGNED_DRIVER", session.employeeId);
  }

  revalidatePath("/ops");
  revalidatePath(`/ops/orders/${orderId}`);
}

/** Fills in an outside courier's phone after the fact — assigned before this was required, or typo'd. */
export async function updateExternalDriverPhoneAction(orderId: string, formData: FormData) {
  await requireRole("OPERATIONS");

  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!order.externalDriverName) {
    throw new Error("This order doesn't have an outside courier assigned.");
  }

  const phone = String(formData.get("externalDriverPhone") ?? "").trim();
  if (!phone) throw new Error("Enter a phone number.");

  await db.order.update({ where: { id: orderId }, data: { externalDriverPhone: phone } });

  revalidatePath("/ops");
  revalidatePath(`/ops/orders/${orderId}`);
}

export async function cancelOrderAction(orderId: string) {
  const session = await requireRole("OPERATIONS");
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });

  await db.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
  await logStatus(orderId, order.status, "CANCELLED", session.employeeId);

  revalidatePath("/ops");
  revalidatePath(`/ops/orders/${orderId}`);
}

export async function markReadyAction(orderId: string, formData: FormData) {
  const session = await requireRole("FLORIST");

  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.floristId !== session.employeeId) {
    throw new Error("This order isn't assigned to you.");
  }
  if (order.status !== "ASSIGNED_FLORIST") {
    throw new Error("This order isn't waiting on a bouquet photo.");
  }

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    throw new Error("A bouquet photo is required to mark this order ready.");
  }

  const url = await savePhoto(orderId, "BOUQUET", photo);

  await db.$transaction([
    db.photo.create({ data: { orderId, type: "BOUQUET", url } }),
    db.order.update({
      where: { id: orderId },
      data: {
        status: "READY",
        approvalStatus: "PENDING",
        approvalDeadline: approvalDeadlineFromNow(),
        changeRequestNote: null,
      },
    }),
  ]);
  await logStatus(orderId, order.status, "READY", session.employeeId);

  revalidatePath("/florist");
  revalidatePath("/ops");
  revalidatePath(`/ops/orders/${orderId}`);
  revalidatePath(`/track/${encodeURIComponent(order.orderNumber)}`);
  redirect("/florist");
}

/**
 * Public — invoked from the customer's tracking link, no employee session.
 * The order id itself is the capability token here, same trust model as the
 * rest of the tracking page (an unguessable id embedded in a link only the
 * recipient has).
 */
export async function approveBouquetAction(orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "READY" || effectiveApproval(order) !== "PENDING") return;

  await db.order.update({ where: { id: orderId }, data: { approvalStatus: "APPROVED" } });

  revalidatePath(`/track/${encodeURIComponent(order.orderNumber)}`);
  revalidatePath("/ops");
  revalidatePath(`/ops/orders/${orderId}`);
}

/** Public — see approveBouquetAction. Sends the order back to the florist. */
export async function requestBouquetChangesAction(orderId: string, formData: FormData) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "READY" || effectiveApproval(order) !== "PENDING") return;

  const note = String(formData.get("note") ?? "").trim();
  if (!note) return;

  await db.order.update({
    where: { id: orderId },
    data: { status: "ASSIGNED_FLORIST", approvalStatus: "CHANGES_REQUESTED", changeRequestNote: note },
  });
  await logStatus(orderId, "READY", "ASSIGNED_FLORIST", null);

  revalidatePath(`/track/${encodeURIComponent(order.orderNumber)}`);
  revalidatePath("/florist");
  revalidatePath(`/florist/orders/${orderId}`);
  revalidatePath("/ops");
  revalidatePath(`/ops/orders/${orderId}`);
}

async function doMarkOutForDelivery(order: { id: string; status: string }, employeeId: string | null) {
  if (order.status !== "ASSIGNED_DRIVER") {
    throw new Error("This order isn't waiting for pickup.");
  }
  await db.order.update({ where: { id: order.id }, data: { status: "OUT_FOR_DELIVERY" } });
  await logStatus(order.id, order.status, "OUT_FOR_DELIVERY", employeeId);

  revalidatePath("/driver");
  revalidatePath("/ops");
  revalidatePath(`/ops/orders/${order.id}`);
  revalidatePath(`/deliver/${order.id}`);
}

async function doMarkDelivered(order: { id: string; status: string }, photo: File, employeeId: string | null) {
  if (order.status !== "OUT_FOR_DELIVERY") {
    throw new Error("This order isn't out for delivery.");
  }
  const url = await savePhoto(order.id, "DELIVERY", photo);

  await db.$transaction([
    db.photo.create({ data: { orderId: order.id, type: "DELIVERY", url } }),
    db.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } }),
  ]);
  await logStatus(order.id, order.status, "DELIVERED", employeeId);

  revalidatePath("/driver");
  revalidatePath("/ops");
  revalidatePath(`/ops/orders/${order.id}`);
  revalidatePath(`/deliver/${order.id}`);
}

function reasonFromFormData(formData: FormData): string {
  const preset = String(formData.get("reason") ?? "").trim();
  const note = String(formData.get("reasonNote") ?? "").trim();
  return preset === "Other" && note ? note : preset || "No reason given";
}

async function doMarkFailed(
  order: { id: string; status: string },
  reason: string,
  employeeId: string | null
) {
  if (order.status !== "OUT_FOR_DELIVERY") {
    throw new Error("This order isn't out for delivery.");
  }
  await db.order.update({
    where: { id: order.id },
    data: { status: "FAILED_DELIVERY", deliveryFailureReason: reason },
  });
  await logStatus(order.id, order.status, "FAILED_DELIVERY", employeeId);

  revalidatePath("/driver");
  revalidatePath("/ops");
  revalidatePath(`/ops/orders/${order.id}`);
  revalidatePath(`/deliver/${order.id}`);
}

export async function markFailedAction(orderId: string, formData: FormData) {
  const session = await requireRole("DRIVER");
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.driverId !== session.employeeId) {
    throw new Error("This order isn't assigned to you.");
  }
  await doMarkFailed(order, reasonFromFormData(formData), session.employeeId);
  redirect("/driver");
}

/** Public — see publicMarkOutForDeliveryAction/publicMarkDeliveredAction. */
export async function publicMarkFailedAction(orderId: string, formData: FormData) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "OUT_FOR_DELIVERY") return;
  await doMarkFailed(order, reasonFromFormData(formData), null);
}

/** Operations marking a failed delivery on a driver's behalf. */
export async function opsMarkFailedAction(orderId: string, formData: FormData) {
  const session = await requireRole("OPERATIONS");
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  await doMarkFailed(order, reasonFromFormData(formData), session.employeeId);
}

/**
 * Operations-only escape hatch: move an order straight to any status,
 * bypassing the normal state-machine guards above. For recovering from
 * mistakes (wrong cancel, wrong "delivered") and re-dispatching failed
 * deliveries without forcing a specific path back through the flow.
 */
export async function opsSetStatusAction(orderId: string, formData: FormData) {
  const session = await requireRole("OPERATIONS");

  const newStatus = String(formData.get("status") ?? "");
  if (!ORDER_STATUSES.includes(newStatus as OrderStatus)) {
    throw new Error("Invalid status.");
  }

  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status === newStatus) return;

  await db.order.update({
    where: { id: orderId },
    data: {
      status: newStatus,
      ...(newStatus !== "FAILED_DELIVERY" ? { deliveryFailureReason: null } : {}),
    },
  });
  await logStatus(orderId, order.status, newStatus as OrderStatus, session.employeeId);

  revalidatePath("/ops");
  revalidatePath(`/ops/orders/${orderId}`);
  revalidatePath("/florist");
  revalidatePath("/driver");
  revalidatePath(`/deliver/${orderId}`);
  revalidatePath(`/track/${encodeURIComponent(order.orderNumber)}`);
}

export async function markOutForDeliveryAction(orderId: string) {
  const session = await requireRole("DRIVER");
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.driverId !== session.employeeId) {
    throw new Error("This order isn't assigned to you.");
  }
  await doMarkOutForDelivery(order, session.employeeId);
}

export async function markDeliveredAction(orderId: string, formData: FormData) {
  const session = await requireRole("DRIVER");
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.driverId !== session.employeeId) {
    throw new Error("This order isn't assigned to you.");
  }
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    throw new Error("A delivery photo is required to mark this order delivered.");
  }
  await doMarkDelivered(order, photo, session.employeeId);
  redirect("/driver");
}

/**
 * Public — invoked from the /deliver/[id] link Operations sends an outside
 * courier. The order id is the capability token, same trust model as the
 * customer tracking link. Fails silently (rather than throwing) so a stray
 * double-tap from someone with no session never surfaces an error page.
 */
export async function publicMarkOutForDeliveryAction(orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "ASSIGNED_DRIVER") return;
  await doMarkOutForDelivery(order, null);
}

/** Public — see publicMarkOutForDeliveryAction. */
export async function publicMarkDeliveredAction(orderId: string, formData: FormData) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "OUT_FOR_DELIVERY") return;
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return;
  await doMarkDelivered(order, photo, null);
}

/** Operations updating a delivery on a driver's behalf — team or outside courier. */
export async function opsMarkOutForDeliveryAction(orderId: string) {
  const session = await requireRole("OPERATIONS");
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  await doMarkOutForDelivery(order, session.employeeId);
}

/** Operations — see opsMarkOutForDeliveryAction. */
export async function opsMarkDeliveredAction(orderId: string, formData: FormData) {
  const session = await requireRole("OPERATIONS");
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    throw new Error("A delivery photo is required to mark this order delivered.");
  }
  await doMarkDelivered(order, photo, session.employeeId);
}
