import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { markReadyAction } from "@/app/actions/orders";
import { PhotoActionForm } from "@/components/photo-action-form";
import { StatusChip } from "@/components/status-chip";
import type { OrderStatus } from "@/lib/status";

export default async function FloristOrderPage(props: PageProps<"/florist/orders/[id]">) {
  const session = await requireRole("FLORIST");
  const { id } = await props.params;

  const order = await db.order.findUnique({ where: { id } });
  if (!order) notFound();
  if (order.floristId !== session.employeeId) redirect("/florist");

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
              {order.deadlineAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
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
        <PhotoActionForm
          action={markReadyAction.bind(null, order.id)}
          photoLabel="Photo of the finished bouquet"
          submitLabel="Mark ready"
        />
      ) : (
        <p className="text-sm text-muted text-center py-4">This order has already been marked ready.</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-32 shrink-0 text-muted">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
