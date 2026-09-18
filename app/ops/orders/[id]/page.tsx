import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { StatusChip } from "@/components/status-chip";
import { AssignSelect } from "@/components/assign-select";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { CopyLink } from "@/components/copy-link";
import { PhotoActionForm } from "@/components/photo-action-form";
import { RetakePhotoForm } from "@/components/retake-photo-form";
import { EditDriverForm } from "@/components/edit-driver-form";
import { SubmitButton } from "@/components/submit-button";
import { StatusOverride } from "@/components/status-override";
import { MarkFailedForm } from "@/components/mark-failed-form";
import { RescheduleForm } from "@/components/reschedule-form";
import {
  assignDriverAction,
  assignExternalDriverAction,
  assignFloristAction,
  cancelOrderAction,
  opsMarkDeliveredAction,
  opsMarkFailedAction,
  opsMarkOutForDeliveryAction,
  opsReplaceBouquetPhotoAction,
  opsSetStatusAction,
  rescheduleOrderAction,
  updateExternalDriverAction,
  updateExternalDriverPhoneAction,
  updateMapsLinkAction,
} from "@/app/actions/orders";
import { updateDriverProfileAction, updateEmployeePhoneAction } from "@/app/actions/employees";
import {
  linkSliderOrderAction,
  syncSliderOrderAction,
  unlinkSliderOrderAction,
} from "@/app/actions/slider";
import { sliderAccountConfigured, sliderStatusLabel } from "@/lib/slider";
import { SliderOrderForm } from "@/components/slider-order-form";
import { ContactActions } from "@/components/contact-actions";
import { CUSTOMER_STATUS_LABEL, isOverdue, isDueSoon, type OrderStatus } from "@/lib/status";
import { canAttachCourier } from "@/lib/dispatchReady";
import { formatDeliveryWindow, formatDubaiDateTime, formatDubaiTime } from "@/lib/date";
import {
  driverDeliveryLinkMessage,
  normalizePhone,
  OPS_LOCATION_REQUEST_MESSAGE,
  trackingLinkMessage,
  whatsappLink,
} from "@/lib/whatsapp";
import { SITE_URL } from "@/lib/site";
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
  // A driver can be lined up from the moment the order lands — Operations
  // books transport while the florist is still working. Attaching one doesn't
  // move the order; it reaches the driver's queue once the bouquet is ready
  // and approved (lib/dispatchReady.ts).
  const canAssignDriver = canAttachCourier(status);
  const bouquetReady = status === "READY" || status === "ASSIGNED_DRIVER";

  // Newest first, so this is always the latest revision after any redo.
  const bouquetPhoto = order.photos.find((p) => p.type === "BOUQUET");
  const deliveryPhoto = order.photos.find((p) => p.type === "DELIVERY");

  const driverLabel = order.driver?.name ?? order.externalDriverName ?? null;
  const driverPhone = order.driver?.phone ?? order.externalDriverPhone ?? null;
  const isExternalDriver = !order.driverId && !!order.externalDriverName;
  const showDeliverySection =
    status === "ASSIGNED_DRIVER" || status === "OUT_FOR_DELIVERY" || status === "FAILED_DELIVERY";

  // Slider's riders mark pickup and delivery in Slider's own app, so linking
  // the order there is what makes those updates — and their delivery photo —
  // land here. Worth offering from the moment the bouquet is ready; pointless
  // once the order is closed, unless it's already linked.
  // Dispatching needs the shop's pickup pin and the Slider account; until
  // they're configured the button can only fail, so don't show one.
  const canOrderSlider = canAssignDriver && sliderAccountConfigured();

  const showSliderSection =
    Boolean(order.sliderOrderNumber) ||
    canAssignDriver ||
    status === "OUT_FOR_DELIVERY" ||
    status === "FAILED_DELIVERY";

  const deliverLink = `${SITE_URL}/deliver/${order.id}`;
  const trackingLink = `${SITE_URL}/track/${encodeURIComponent(order.trackingToken)}`;
  // Whoever should get customer-facing links — the sender for gifted orders,
  // or the recipient themselves when they placed the order for their own use.
  const trackingContactPhone = order.senderPhone || order.recipientPhone;

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div>
        <Link href="/ops" className="text-sm text-muted hover:text-foreground">
          ← Back to orders
        </Link>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
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
              {formatDeliveryWindow(order.deadlineAt, order.deliveryTimeSlot)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Link
            href={`/print/orders/${order.id}`}
            target="_blank"
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-foreground hover:border-brand transition-colors"
          >
            🖨️ Print card
          </Link>
          <StatusChip status={status} />
        </div>
      </div>

      <div className="flex items-center gap-4 -mt-3">
        <Link href={`/ops/orders/${order.id}/edit`} className="text-xs font-medium text-brand hover:underline">
          Edit details
        </Link>
        {canCancel && (
          <form action={cancelOrderAction.bind(null, order.id)}>
            <ConfirmSubmit
              confirmText="Are you sure you want to CANCEL this order?"
              confirmDetail={`Order ${order.orderNumber} — this can't be undone.`}
              confirmLabel="Yes, cancel order"
              className="text-xs font-medium text-muted hover:text-red-600"
            >
              Cancel this order
            </ConfirmSubmit>
          </form>
        )}
      </div>

      {canCancel && (
        <RescheduleForm
          currentDeadline={order.deadlineAt}
          action={rescheduleOrderAction.bind(null, order.id)}
        />
      )}

      <section className="rounded-2xl border border-line bg-surface p-4 flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Change status</h3>
        <p className="text-xs text-muted">
          Manual override — moves the order directly to any status, skipping the normal checks.
        </p>
        {/* key resets the uncontrolled <select> whenever the real status
            changes underneath it — otherwise a completed override (or
            anyone else's concurrent change) leaves the dropdown showing a
            stale value even though the chip above is correct. */}
        <StatusOverride key={status} orderId={order.id} current={status} action={opsSetStatusAction} />
      </section>

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
            <SubmitButton
              pendingText="Saving…"
              className="shrink-0 rounded-xl border border-line px-4 text-sm font-semibold text-foreground hover:border-brand transition-colors"
            >
              Save
            </SubmitButton>
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

          {/* Persists regardless of status — once a courier is assigned,
              Operations can always see who and (for outside couriers) reach
              their no-login link again, even after delivery. */}
          {(order.driver || order.externalDriverName) && (
            <div className="mb-3 rounded-xl border border-line bg-background p-3 flex flex-col gap-1.5">
              <p className="text-sm font-medium text-foreground">
                {driverLabel}
                {isExternalDriver && <span className="text-muted font-normal"> · Outside courier</span>}
              </p>
              {driverPhone ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={`tel:+${normalizePhone(driverPhone)}`}
                    className="text-xs font-medium text-brand hover:underline"
                  >
                    📞 {driverPhone}
                  </a>
                  <a
                    href={whatsappLink(driverPhone, driverDeliveryLinkMessage(deliverLink))}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-foreground hover:border-brand transition-colors"
                  >
                    💬 Send on WhatsApp
                  </a>
                </div>
              ) : (
                <form
                  action={
                    order.driver
                      ? updateEmployeePhoneAction.bind(null, order.driver.id)
                      : updateExternalDriverPhoneAction.bind(null, order.id)
                  }
                  className="flex gap-2"
                >
                  <input
                    type="tel"
                    name={order.driver ? "phone" : "externalDriverPhone"}
                    required
                    placeholder="Add their phone number"
                    className="flex-1 min-w-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <SubmitButton
                    pendingText="Saving…"
                    className="shrink-0 rounded-lg border border-line px-3 text-xs font-semibold text-foreground hover:border-brand transition-colors"
                  >
                    Save
                  </SubmitButton>
                </form>
              )}
              <EditDriverForm
                currentName={driverLabel ?? ""}
                currentPhone={driverPhone}
                action={
                  order.driver
                    ? updateDriverProfileAction.bind(null, order.driver.id)
                    : updateExternalDriverAction.bind(null, order.id)
                }
              />
              <div className="mt-0.5">
                <CopyLink path={`/deliver/${order.id}`} />
              </div>
            </div>
          )}

          {canAssignDriver ? (
            <div className="flex flex-col gap-3">
              {!bouquetReady && (
                <p className="text-xs text-muted">
                  Still with the florist. You can line a driver up now — the order stays where it
                  is and moves to &ldquo;waiting for pickup&rdquo; the moment the bouquet is
                  marked ready.
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
                  placeholder="Their phone number"
                  required
                  className="rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
                />
                <SubmitButton
                  pendingText="Assigning…"
                  className="rounded-xl border border-line py-2.5 text-sm font-semibold text-foreground hover:border-brand transition-colors"
                >
                  Assign outside courier
                </SubmitButton>
              </form>
            </div>
          ) : null}
        </div>
      </section>

      {showSliderSection && (
        <section className="rounded-2xl border border-line bg-surface p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">Slider delivery</h3>
            {order.sliderOrderNumber && (
              <span className="font-mono text-xs text-muted">#{order.sliderOrderNumber}</span>
            )}
          </div>

          {order.sliderOrderNumber ? (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex gap-3 text-sm">
                  <span className="w-24 shrink-0 text-muted">Slider says</span>
                  <span className="text-foreground">
                    {sliderStatusLabel(order.sliderStatus) ?? "Not synced yet"}
                  </span>
                </div>
                {order.sliderSyncedAt && (
                  <div className="flex gap-3 text-sm">
                    <span className="w-24 shrink-0 text-muted">Last checked</span>
                    <span className="text-muted">{formatDubaiTime(order.sliderSyncedAt)}</span>
                  </div>
                )}
                {order.sliderTrackingUrl && (
                  <a
                    href={order.sliderTrackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-brand hover:underline"
                  >
                    Live rider tracking →
                  </a>
                )}
              </div>

              {order.sliderStatus === "delivered" && !deliveryPhoto && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm text-amber-900">
                    Slider marked this delivered but sent no proof photo. We ask for one on every
                    order; if this keeps happening, the rider isn&apos;t being prompted — worth
                    raising with Slider.
                  </p>
                </div>
              )}

              {order.sliderSyncError && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 mb-1">
                    Slider sync problem
                  </p>
                  <p className="text-sm text-orange-900">{order.sliderSyncError}</p>
                </div>
              )}

              <div className="flex gap-2">
                <form action={syncSliderOrderAction.bind(null, order.id)} className="flex-1">
                  <SubmitButton
                    pendingText="Checking…"
                    className="w-full rounded-xl border border-line py-2.5 text-sm font-semibold text-foreground hover:border-brand transition-colors"
                  >
                    Sync now
                  </SubmitButton>
                </form>
                <form action={unlinkSliderOrderAction.bind(null, order.id)}>
                  <ConfirmSubmit
                    confirmText="Unlink this Slider order?"
                    confirmDetail="Status updates and the delivery photo will stop arriving from Slider. Anything already saved stays."
                    confirmLabel="Yes, unlink"
                    className="rounded-xl border border-line px-3.5 py-2.5 text-sm font-semibold text-muted hover:border-red-300 hover:text-red-600 transition-colors"
                  >
                    Unlink
                  </ConfirmSubmit>
                </form>
              </div>
            </>
          ) : (
            <>
              {canOrderSlider && (
                <>
                  <SliderOrderForm
                    orderId={order.id}
                    hasMapLink={Boolean(order.mapsLink?.trim())}
                    bouquetReady={bouquetReady}
                  />
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span className="h-px flex-1 bg-line" />
                    or, if you placed it in Slider yourself
                    <span className="h-px flex-1 bg-line" />
                  </div>
                </>
              )}
              <p className="text-sm text-muted">
                Paste the order number from Slider&apos;s dashboard and its status updates and
                delivery photo will land here on their own.
              </p>
              <form
                action={linkSliderOrderAction.bind(null, order.id)}
                className="flex flex-col gap-2"
              >
                <input
                  type="text"
                  name="sliderOrderNumber"
                  inputMode="numeric"
                  placeholder="Slider order number, e.g. 64542958"
                  required
                  className="rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
                />
                <SubmitButton
                  pendingText="Linking…"
                  className="rounded-xl border border-line py-2.5 text-sm font-semibold text-foreground hover:border-brand transition-colors"
                >
                  Link Slider order
                </SubmitButton>
              </form>
            </>
          )}
        </section>
      )}

      {showDeliverySection && (
        <section className="rounded-2xl border border-line bg-surface p-4 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-foreground">Delivery</h3>

          <div>
            <p className="text-xs text-muted mb-1.5">Or update it yourself</p>
            {status === "ASSIGNED_DRIVER" && (
              <form action={opsMarkOutForDeliveryAction.bind(null, order.id)}>
                <SubmitButton
                  pendingText="Updating…"
                  className="w-full rounded-xl border border-line py-2.5 text-sm font-semibold text-foreground hover:border-brand transition-colors"
                >
                  Mark picked up
                </SubmitButton>
              </form>
            )}
            {status === "OUT_FOR_DELIVERY" && (
              <div className="flex flex-col gap-3">
                <PhotoActionForm
                  action={opsMarkDeliveredAction.bind(null, order.id)}
                  photoLabel="Delivery photo"
                  useCamera={false}
                  photoPlaceholder="Add proof of delivery"
                  submitLabel="Mark delivered"
                />
                <MarkFailedForm action={opsMarkFailedAction.bind(null, order.id)} />
              </div>
            )}
            {status === "FAILED_DELIVERY" && order.deliveryFailureReason && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 mb-1">
                  Delivery failed
                </p>
                <p className="text-sm text-orange-900">{order.deliveryFailureReason}</p>
              </div>
            )}
          </div>
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
          {bouquetPhoto && (
            <RetakePhotoForm
              action={opsReplaceBouquetPhotoAction.bind(null, order.id)}
              photoLabel="New bouquet photo"
              triggerLabel="Replace bouquet photo"
            />
          )}
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h3 className="text-sm font-semibold text-foreground mb-1">Customer tracking link</h3>
        <p className="text-xs text-muted mb-2">Share this after the order is confirmed — no login needed.</p>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CopyLink path={`/track/${encodeURIComponent(order.trackingToken)}`} />
          {trackingContactPhone && (
            <a
              href={whatsappLink(trackingContactPhone, trackingLinkMessage(trackingLink))}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-foreground hover:border-brand transition-colors"
            >
              💬 Send on WhatsApp
            </a>
          )}
        </div>
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
                  {formatDubaiDateTime(event.createdAt)}
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
      <span className="text-foreground whitespace-pre-line">{value}</span>
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
