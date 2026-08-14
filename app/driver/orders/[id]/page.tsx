import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { markDeliveredAction, markOutForDeliveryAction } from "@/app/actions/orders";
import { PhotoInput } from "@/components/photo-input";
import { StatusChip } from "@/components/status-chip";
import { ContactActions } from "@/components/contact-actions";
import { ZoomablePhoto } from "@/components/zoomable-photo";
import type { OrderStatus } from "@/lib/status";
import { DRIVER_PICKUP_MESSAGE } from "@/lib/whatsapp";

export default async function DriverOrderPage(props: PageProps<"/driver/orders/[id]">) {
  const session = await requireRole("DRIVER");
  const { id } = await props.params;

  const order = await db.order.findUnique({
    where: { id },
    include: { photos: { where: { type: "BOUQUET" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) notFound();
  if (order.driverId !== session.employeeId) redirect("/driver");

  const bouquetPhoto = order.photos[0];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/driver" className="text-sm text-muted hover:text-foreground">
        ← Back to my deliveries
      </Link>

      <div className="flex items-center justify-between gap-2">
        <h2 className="font-mono text-lg font-semibold text-foreground">{order.orderNumber}</h2>
        <StatusChip status={order.status as OrderStatus} />
      </div>

      {bouquetPhoto && (
        <div>
          <ZoomablePhoto src={bouquetPhoto.url} alt="Bouquet for this order" />
          <p className="text-xs text-muted text-center mt-1.5">This is the bouquet for this order</p>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col gap-3">
        <Row label="Recipient" value={order.recipientName} />
        <Row label="Phone" value={order.recipientPhone} />
        <Row label="Address" value={order.deliveryAddress} />
        {order.deliveryArea && <Row label="Area" value={order.deliveryArea} />}
      </div>

      <ContactActions
        phone={order.recipientPhone}
        whatsappMessage={DRIVER_PICKUP_MESSAGE}
        mapsLink={order.mapsLink}
      />

      {order.status === "ASSIGNED_DRIVER" && (
        <form action={markOutForDeliveryAction.bind(null, order.id)}>
          <button
            type="submit"
            className="w-full rounded-xl bg-brand text-brand-ink font-semibold py-3.5 hover:opacity-90 transition"
          >
            Picked up — heading out
          </button>
        </form>
      )}

      {order.status === "OUT_FOR_DELIVERY" && (
        <form action={markDeliveredAction.bind(null, order.id)} className="flex flex-col gap-4">
          <PhotoInput name="photo" label="Photo proof of delivery" />
          <button
            type="submit"
            className="rounded-xl bg-brand text-brand-ink font-semibold py-3.5 hover:opacity-90 transition"
          >
            Mark delivered
          </button>
        </form>
      )}

      {order.status === "DELIVERED" && (
        <p className="text-sm text-muted text-center py-4">This order has been delivered.</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-20 shrink-0 text-muted">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
