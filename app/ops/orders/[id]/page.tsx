import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { StatusChip } from "@/components/status-chip";
import { AssignSelect } from "@/components/assign-select";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { CopyLink } from "@/components/copy-link";
import { PhotoInput } from "@/components/photo-input";
import {
  assignDriverAction,
  assignExternalDriverAction,
  assignFloristAction,
  cancelOrderAction,
  opsMarkDeliveredAction,
  opsMarkOutForDeliveryAction,
  updateMapsLinkAction,
} from "@/app/actions/orders";
import { ContactActions } from "@/components/contact-actions";
import { CUSTOMER_STATUS_LABEL, isOverdue, isDueSoon, type OrderStatus } from "@/lib/status";
import { effectiveApproval } from "@/lib/approval";
import { OPS_LOCATION_REQUEST_MESSAGE } from "@/lib/whatsapp";
import { cn } from "@/lib/cn";

export default async function OrderDetailPage(props: PageProps<"/ops/orders/[id]">) {
  const { id } = await props.params;

  const order = await db.order.findUnique({
    where: { id },
    include: {
      florist: true,
      driver: true,
      photos: { orderBy: { createdAt: "desc" } },
      statusEvents: { include: { employee: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  const [florists, drivers] = await Promise.all([
    db.employee.findMany({ where: { role: "FLORIST", active: true }, orderBy: { name: "asc" } }),
    db.employee.findMany({ where: { role: "DRIVER", active: true }, orderBy: { name: "asc" } }),
  ]);

  const status = order.status as OrderStatus;
  const overdue = isOverdue(order.deadlineAt, status);
  const dueSoon = isDueSoon(order.deadlineAt, status);
  const canCancel = status !== "DELIVERED" && status !== "CANCELLED";
  const approval = status === "READY" ? effectiveApproval(order) : null;
  const canAssignDriver = status === "ASSIGNED_DRIVER" || (status === "READY" && approval === "APPROVED");

  // Newest first, so this is always the latest revision after any redo.
  const bouquetPhoto = order.photos.find((p) => p.type === "BOUQUET");
  const deliveryPhoto = order.photos.find((p) => p.type === "DELIVERY");

  const driverLabel = order.driver?.name ?? order.externalDriverName ?? null;
  const isExternalDriver = !order.driverId && !!order.externalDriverName;
  const showDeliverySection = status === "ASSIGNED_DRIVER" || status === "OUT_FOR_DELIVERY";

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div>
        <Link href="/ops" className="text-sm text-muted hover:text-foreground">
          ← Back to orders
        </Link>
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-mono text-lg font-semibold text-foreground">{order.orderNumber}</h2>
            <span className="text-[11px] uppercase tracking-wide text-muted border border-line rounded px-1.5 py-0.5">
              {order.source === "SHOPIFY" ? "Shopify" : "WhatsApp"}
            </span>
            {order.deliveryMethod === "PICKUP" && (
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand border border-brand/40 bg-brand-soft rounded px-1.5 py-0.5">
                Customer pickup — no driver needed
              </span>
            )}
          </div>
          {order.deadlineAt && (
            <p
              className={cn(
                "text-xs mt-1 font-medium",
                overdue ? "text-red-600" : dueSoon ? "text-amber-600" : "text-muted"
              )}
            >
              {overdue ? "Overdue — was due" : "Deliver by"}{" "}
              {order.deadlineAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
        </div>
        <StatusChip status={status} />
      </div>

      <div className="flex items-center gap-4 -mt-3">
        <Link href={`/ops/orders/${order.id}/edit`} className="text-xs font-medium text-brand hover:underline">
          Edit details
        </Link>
        {canCancel && (
          <form action={cancelOrderAction.bind(null, order.id)}>
            <ConfirmSubmit
              confirmText={`Cancel order ${order.orderNumber}? This can't be undone.`}
              className="text-xs font-medium text-muted hover:text-red-600"
            >
              Cancel this order
            </ConfirmSubmit>
          </form>
        )}
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4 flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Recipient</h3>
        {order.senderName && <Row label="Sender name" value={order.senderName} />}
        {order.senderPhone && <Row label="Sender phone" value={order.senderPhone} />}
        <Row label="Name" value={order.recipientName} />
        <Row label="Phone" value={order.recipientPhone} />
        <Row label="Address" value={order.deliveryAddress} />
        {order.deliveryArea && <Row label="Area" value={order.deliveryArea} />}
        {order.occasion && <Row label="Occasion" value={order.occasion} />}
        {order.bouquetName && <Row label="Bouquet" value={order.bouquetName} />}
        {order.cardMessage && <Row label="Card message" value={order.cardMessage} />}
        {order.notes && <Row label="Internal notes" value={order.notes} />}
        <ContactActions
          phone={order.recipientPhone}
          whatsappMessage={OPS_LOCATION_REQUEST_MESSAGE}
          mapsLink={order.mapsLink}
        />
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-foreground">Assignment</h3>
        <div>
          <p className="text-xs text-muted mb-1.5">Google Maps link</p>
          <form action={updateMapsLinkAction.bind(null, order.id)} className="flex gap-2">
            <input
              type="url"
              name="mapsLink"
              defaultValue={order.mapsLink ?? ""}
              placeholder="Paste the recipient's pin location link"
              className="flex-1 min-w-0 rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl border border-line px-4 text-sm font-semibold text-foreground hover:border-brand transition-colors"
            >
              Save
            </button>
          </form>
        </div>
        <div>
          <p className="text-xs text-muted mb-1.5">Florist</p>
          <AssignSelect
            orderId={order.id}
            value={order.floristId}
            options={florists}
            placeholder="Assign a florist"
            action={assignFloristAction}
          />
        </div>
        <div>
          <p className="text-xs text-muted mb-1.5">Driver</p>
          {canAssignDriver ? (
            <div className="flex flex-col gap-3">
              {driverLabel && (
                <p className="text-xs text-muted">
                  Currently: <span className="text-foreground font-medium">{driverLabel}</span>
                  {isExternalDriver && " (outside courier)"}
                </p>
              )}
              <AssignSelect
                orderId={order.id}
                value={order.driverId}
                options={drivers}
                placeholder="Assign a team driver"
                action={assignDriverAction}
              />
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>
              <form action={assignExternalDriverAction.bind(null, order.id)} className="flex flex-col gap-2">
                <input
                  type="text"
                  name="externalDriverName"
                  placeholder="Outside courier's name"
                  required
                  className="rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
                />
                <input
                  type="tel"
                  name="externalDriverPhone"
                  placeholder="Their phone (optional)"
                  className="rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
                />
                <button
                  type="submit"
                  className="rounded-xl border border-line py-2.5 text-sm font-semibold text-foreground hover:border-brand transition-colors"
                >
                  Assign outside courier
                </button>
              </form>
            </div>
          ) : approval === "PENDING" ? (
            <p className="text-sm text-muted italic">
              Waiting on customer approval
              {order.approvalDeadline &&
                ` — auto-approves at ${order.approvalDeadline.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
              .
            </p>
          ) : (
            <p className="text-sm text-muted italic">Available once the bouquet is ready.</p>
          )}
        </div>
      </section>

      {showDeliverySection && (
        <section className="rounded-2xl border border-line bg-surface p-4 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Delivery</h3>
            <p className="text-xs text-muted mt-0.5">
              {driverLabel}
              {isExternalDriver && " — outside courier"}
            </p>
          </div>

          {isExternalDriver && (
            <div>
              <p className="text-xs text-muted mb-1.5">
                Send this link to {driverLabel} — no login needed, works on any phone.
              </p>
              <CopyLink path={`/deliver/${order.id}`} />
            </div>
          )}

          <div>
            <p className="text-xs text-muted mb-1.5">Or update it yourself</p>
            {status === "ASSIGNED_DRIVER" && (
              <form action={opsMarkOutForDeliveryAction.bind(null, order.id)}>
                <button
                  type="submit"
                  className="w-full rounded-xl border border-line py-2.5 text-sm font-semibold text-foreground hover:border-brand transition-colors"
                >
                  Mark picked up
                </button>
              </form>
            )}
            {status === "OUT_FOR_DELIVERY" && (
              <form action={opsMarkDeliveredAction.bind(null, order.id)} className="flex flex-col gap-3">
                <PhotoInput
                  name="photo"
                  label="Delivery photo"
                  useCamera={false}
                  placeholder="Add proof of delivery"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl border border-line py-2.5 text-sm font-semibold text-foreground hover:border-brand transition-colors"
                >
                  Mark delivered
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      {(status === "READY" || order.changeRequestNote) && order.approvalDeadline && (
        <section className="rounded-2xl border border-line bg-surface p-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">Customer review</h3>
          {approval === "PENDING" && (
            <p className="text-sm">
              <span className="font-medium text-amber-700">Awaiting customer approval</span>
              <span className="text-muted">
                {" "}
                — auto-approves at{" "}
                {order.approvalDeadline.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            </p>
          )}
          {approval === "APPROVED" && (
            <p className="text-sm font-medium text-emerald-700">Customer approved ✓</p>
          )}
          {order.changeRequestNote && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">
                Customer requested changes
              </p>
              <p className="text-sm text-amber-900">{order.changeRequestNote}</p>
            </div>
          )}
        </section>
      )}

      {(order.referenceImageUrl || bouquetPhoto || deliveryPhoto) && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">Photos</h3>
          <div className="grid grid-cols-2 gap-3">
            {order.referenceImageUrl && <PhotoCard label="Reference" url={order.referenceImageUrl} />}
            {bouquetPhoto && <PhotoCard label="Bouquet" url={bouquetPhoto.url} />}
            {deliveryPhoto && <PhotoCard label="Delivered" url={deliveryPhoto.url} />}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h3 className="text-sm font-semibold text-foreground mb-1">Customer tracking link</h3>
        <p className="text-xs text-muted mb-2">Share this after the order is confirmed — no login needed.</p>
        <CopyLink path={`/track/${encodeURIComponent(order.orderNumber)}`} />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Timeline</h3>
        <ol className="flex flex-col gap-3">
          {order.statusEvents.map((event) => (
            <li key={event.id} className="flex gap-3 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand shrink-0" />
              <div>
                <p className="text-foreground">
                  {CUSTOMER_STATUS_LABEL[event.toStatus as OrderStatus] ?? event.toStatus}
                  {event.employee && <span className="text-muted"> — {event.employee.name}</span>}
                </p>
                <p className="text-xs text-muted">
                  {event.createdAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-28 shrink-0 text-muted">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function PhotoCard({ label, url }: { label: string; url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <div className="relative aspect-square rounded-xl overflow-hidden border border-line bg-background">
        <Image src={url} alt={label} fill className="object-cover" />
      </div>
      <p className="text-xs text-muted mt-1">{label}</p>
    </a>
  );
}
