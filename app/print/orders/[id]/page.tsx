import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { formatDeliveryWindow } from "@/lib/date";
import { OrderPrintCards } from "@/components/order-print-cards";
import "./print.css";

export default async function OrderPrintPage(props: PageProps<"/print/orders/[id]">) {
  await requireRole("OPERATIONS");
  const { id } = await props.params;

  const order = await db.order.findUnique({
    where: { id },
    include: { florist: true, driver: true },
  });
  if (!order) notFound();

  const driverLabel = order.driver?.name ?? order.externalDriverName ?? null;
  const isExternalDriver = !order.driverId && !!order.externalDriverName;

  return (
    <OrderPrintCards
      orderId={order.id}
      orderNumber={order.orderNumber}
      bouquetName={order.bouquetName}
      occasion={order.occasion}
      deliverBy={order.deadlineAt ? formatDeliveryWindow(order.deadlineAt, order.deliveryTimeSlot) : null}
      customerNote={order.notes}
      cardMessage={order.cardMessage}
      recipientName={order.recipientName}
      recipientPhone={order.recipientPhone}
      deliveryAddress={order.deliveryAddress}
      deliveryArea={order.deliveryArea}
      senderName={order.senderName}
      senderPhone={order.senderPhone}
      floristName={order.florist?.name ?? null}
      driverLabel={driverLabel}
      isExternalDriver={isExternalDriver}
    />
  );
}
