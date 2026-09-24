import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { markReadyAction, retakeBouquetPhotoAction } from "@/app/actions/orders";
import { RetakePhotoForm } from "@/components/retake-photo-form";
import { SubmitButton } from "@/components/submit-button";
import { ZoomablePhoto } from "@/components/zoomable-photo";
import { StatusChip } from "@/components/status-chip";
import { ACTIVE_STATUSES, type OrderStatus } from "@/lib/status";
import { formatDubaiDateTime } from "@/lib/date";

export default async function FloristOrderPage(props: PageProps<"/florist/orders/[id]">) {
  const session = await requireRole("FLORIST");
  const { id } = await props.params;

  const order = await db.order.findUnique({
    where: { id },
    include: { photos: { where: { type: "BOUQUET" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) notFound();
  if (order.floristId !== session.employeeId) redirect("/florist");

  const bouquetPhoto = order.photos[0];
  // Only for orders the florist photographed themselves, under the old flow.
  // The first photo is Operations' job now, so there's nothing to retake
  // while the order is still waiting for one.
  const canRetake =
    order.status !== "ASSIGNED_FLORIST" &&
    order.status !== "AWAITING_PHOTO" &&
    ACTIVE_STATUSES.includes(order.status as OrderStatus);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/florist" className="text-sm text-muted hover:text-foreground">
        ← Back to my orders
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-mono text-lg font-semibold text-foreground">{order.orderNumber}</h2>
          <p className="text-sm text-foreground mt-0.5">For {order.recipientName}</p>
          {order.deadlineAt && (
            <p className="text-sm text-muted mt-1">
              Deliver by{" "}
              {formatDubaiDateTime(order.deadlineAt)}
            </p>
          )}
        </div>
        <StatusChip status={order.status as OrderStatus} />
      </div>

      {order.changeRequestNote && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">
            Customer asked for changes
          </p>
          <p className="text-sm text-amber-900">{order.changeRequestNote}</p>
        </div>
      )}

      {order.referenceImageUrl && (
        <div>
          <div className="relative aspect-square rounded-2xl overflow-hidden border border-line">
            <Image src={order.referenceImageUrl} alt="Reference" fill className="object-cover" />
          </div>
          <p className="text-xs text-muted mt-1.5 text-center">Reference photo from the order</p>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col gap-3">
        {order.bouquetName && <Row label="Bouquet" value={order.bouquetName} />}
        {order.occasion && <Row label="Occasion" value={order.occasion} />}
        {order.cardMessage && <Row label="Card message" value={order.cardMessage} />}
        {order.notes && <Row label="Notes" value={order.notes} />}
        {!order.bouquetName && !order.occasion && !order.cardMessage && !order.notes && (
          <p className="text-sm text-muted">No extra details for this order.</p>
        )}
      </div>

      {order.status === "ASSIGNED_FLORIST" ? (
        <form action={markReadyAction.bind(null, order.id)} className="flex flex-col gap-2">
          <SubmitButton
            pendingText="Marking ready…"
            className="rounded-xl bg-brand text-brand-ink font-semibold py-3.5 hover:opacity-90 transition disabled:opacity-60 disabled:cursor-wait"
          >
            Mark ready
          </SubmitButton>
          <p className="text-xs text-muted text-center">
            No photo needed — the team photographs it before it goes out.
          </p>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          {bouquetPhoto && <ZoomablePhoto src={bouquetPhoto.url} alt="Bouquet you submitted" />}
          <p className="text-sm text-muted text-center">This order has already been marked ready.</p>
          {canRetake && (
            <RetakePhotoForm
              action={retakeBouquetPhotoAction.bind(null, order.id)}
              photoLabel="New photo of the finished bouquet"
              triggerLabel="Photo didn't turn out well? Retake it"
              useCamera={false}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-32 shrink-0 text-muted">{label}</span>
      <span className="text-foreground whitespace-pre-line">{value}</span>
    </div>
  );
}
