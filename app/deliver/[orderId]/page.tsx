import { notFound } from "next/navigation";
import Image from "next/image";
import { db } from "@/lib/db";
import {
  publicMarkDeliveredAction,
  publicMarkFailedAction,
  publicMarkOutForDeliveryAction,
} from "@/app/actions/orders";
import { PhotoActionForm } from "@/components/photo-action-form";
import { SubmitButton } from "@/components/submit-button";
import { MarkFailedForm } from "@/components/mark-failed-form";
import { ContactActions } from "@/components/contact-actions";
import { ZoomablePhoto } from "@/components/zoomable-photo";
import { DRIVER_PICKUP_MESSAGE } from "@/lib/whatsapp";

export default async function PublicDeliveryPage(props: PageProps<"/deliver/[orderId]">) {
  const { orderId } = await props.params;

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { photos: { where: { type: "BOUQUET" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) notFound();

  const bouquetPhoto = order.photos[0];

  return (
    <main className="flex-1 flex justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image
            src="/flower-icon.png"
            alt=""
            width={512}
            height={512}
            className="mx-auto mb-3 h-12 w-12 rounded-full bg-brand-soft object-cover"
          />
          <h1 className="text-lg font-semibold text-foreground">GiftyGram Flowers</h1>
          <p className="font-mono text-sm text-muted mt-1">{order.orderNumber}</p>
        </div>

        {bouquetPhoto && (
          <div className="mb-6">
            <ZoomablePhoto src={bouquetPhoto.url} alt="Bouquet for this order" />
            <p className="text-xs text-muted text-center mt-1.5">This is the bouquet for this order</p>
          </div>
        )}

        <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col gap-3 mb-6">
          <Row label="Recipient" value={order.recipientName} />
          <Row label="Phone" value={order.recipientPhone} />
          <Row label="Address" value={order.deliveryAddress} />
          {order.deliveryArea && <Row label="Area" value={order.deliveryArea} />}
        </div>

        <div className="mb-4">
          <ContactActions
            phone={order.recipientPhone}
            whatsappMessage={DRIVER_PICKUP_MESSAGE}
            mapsLink={order.mapsLink}
          />
        </div>

        {order.status === "ASSIGNED_DRIVER" && (
          <form action={publicMarkOutForDeliveryAction.bind(null, order.id)}>
            <SubmitButton
              pendingText="Updating…"
              className="w-full rounded-xl bg-brand text-brand-ink font-semibold py-3.5 hover:opacity-90 transition"
            >
              Picked up — heading out
            </SubmitButton>
          </form>
        )}

        {order.status === "OUT_FOR_DELIVERY" && (
          <div className="flex flex-col gap-4">
            <PhotoActionForm
              action={publicMarkDeliveredAction.bind(null, order.id)}
              photoLabel="Photo proof of delivery"
              submitLabel="Mark delivered"
            />
            <MarkFailedForm action={publicMarkFailedAction.bind(null, order.id)} />
          </div>
        )}

        {order.status === "DELIVERED" && (
          <p className="text-sm text-muted text-center py-4">This order has been delivered. Thank you! 🌸</p>
        )}

        {order.status === "FAILED_DELIVERY" && (
          <p className="text-sm text-muted text-center py-4">This delivery was marked as failed.</p>
        )}

        {order.status !== "ASSIGNED_DRIVER" &&
          order.status !== "OUT_FOR_DELIVERY" &&
          order.status !== "DELIVERED" &&
          order.status !== "FAILED_DELIVERY" && (
            <p className="text-sm text-muted text-center py-4">
              This delivery isn&apos;t ready for pickup yet — check back shortly.
            </p>
          )}
      </div>
    </main>
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
