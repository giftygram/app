import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { updateOrderAction } from "@/app/actions/orders";
import { Field } from "@/components/order-form-field";
import { SubmitButton } from "@/components/submit-button";
import { toDatetimeLocalValue } from "@/lib/date";

export default async function EditOrderPage(props: PageProps<"/ops/orders/[id]/edit">) {
  const { id } = await props.params;

  const order = await db.order.findUnique({ where: { id } });
  if (!order) notFound();

  return (
    <div className="max-w-lg">
      <Link href={`/ops/orders/${order.id}`} className="text-sm text-muted hover:text-foreground">
        ← Back to order
      </Link>
      <h2 className="text-lg font-semibold text-foreground mt-2 mb-1 font-mono">{order.orderNumber}</h2>
      <p className="text-sm text-muted mb-6">
        Editing delivery details. Status, photos, and assignment aren&apos;t changed here.
      </p>

      <form action={updateOrderAction.bind(null, order.id)} className="flex flex-col gap-4">
        <Field
          label="Sender name"
          name="senderName"
          placeholder="Whoever placed the order, if different from recipient"
          defaultValue={order.senderName ?? ""}
        />
        <Field
          label="Sender phone"
          name="senderPhone"
          type="tel"
          placeholder="Their phone number"
          defaultValue={order.senderPhone ?? ""}
        />
        <Field
          label="Recipient name"
          name="recipientName"
          required
          placeholder="Who's receiving the flowers"
          defaultValue={order.recipientName}
        />
        <Field
          label="Recipient phone"
          name="recipientPhone"
          required
          type="tel"
          placeholder="05x xxx xxxx"
          defaultValue={order.recipientPhone}
        />
        <Field
          label="Delivery address"
          name="deliveryAddress"
          required
          as="textarea"
          placeholder="Full address, including landmark if useful"
          defaultValue={order.deliveryAddress}
        />
        <Field
          label="Delivery area"
          name="deliveryArea"
          placeholder="e.g. Jumeirah, Downtown"
          defaultValue={order.deliveryArea ?? ""}
        />
        <Field
          label="Card message"
          name="cardMessage"
          as="textarea"
          placeholder="What goes on the card"
          defaultValue={order.cardMessage ?? ""}
        />
        <Field
          label="Occasion"
          name="occasion"
          placeholder="e.g. Birthday, Anniversary"
          defaultValue={order.occasion ?? ""}
        />
        <Field
          label="Bouquet name"
          name="bouquetName"
          placeholder="e.g. Rose Deluxe, Sunshine Mix"
          defaultValue={order.bouquetName ?? ""}
        />
        <Field
          label="Deliver by"
          name="deadlineAt"
          type="datetime-local"
          defaultValue={order.deadlineAt ? toDatetimeLocalValue(order.deadlineAt) : ""}
        />
        <Field
          label="Internal notes"
          name="notes"
          as="textarea"
          placeholder="Anything the team should know (not shown to customer)"
          defaultValue={order.notes ?? ""}
        />

        <SubmitButton
          pendingText="Saving…"
          className="mt-2 rounded-xl bg-brand text-brand-ink font-semibold py-3 hover:opacity-90 transition"
        >
          Save changes
        </SubmitButton>
      </form>
    </div>
  );
}
