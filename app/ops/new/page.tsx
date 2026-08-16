import Link from "next/link";
import { createOrderAction } from "@/app/actions/orders";
import { PhotoInput } from "@/components/photo-input";
import { Field } from "@/components/order-form-field";
import { DateTimeField } from "@/components/datetime-field";
import { SubmitButton } from "@/components/submit-button";

export default function NewOrderPage() {
  return (
    <div className="max-w-lg">
      <Link href="/ops" className="text-sm text-muted hover:text-foreground">
        ← Back to orders
      </Link>
      <h2 className="text-lg font-semibold text-foreground mt-2 mb-1">New order from WhatsApp</h2>
      <p className="text-sm text-muted mb-6">
        Shopify orders appear automatically — use this for orders taken over WhatsApp or by phone.
      </p>

      <form action={createOrderAction} className="flex flex-col gap-4">
        <Field label="Sender name" name="senderName" placeholder="Whoever placed the order, if different from recipient" />
        <Field label="Sender phone" name="senderPhone" placeholder="Their phone number" type="tel" />
        <Field label="Recipient name" name="recipientName" required placeholder="Who's receiving the flowers" />
        <Field label="Recipient phone" name="recipientPhone" required placeholder="05x xxx xxxx" type="tel" />
        <Field label="Delivery address" name="deliveryAddress" required as="textarea" placeholder="Full address, including landmark if useful" />
        <Field label="Delivery area" name="deliveryArea" placeholder="e.g. Jumeirah, Downtown" />
        <Field label="Card message" name="cardMessage" as="textarea" placeholder="What goes on the card" />
        <Field label="Occasion" name="occasion" placeholder="e.g. Birthday, Anniversary" />
        <Field label="Bouquet name" name="bouquetName" placeholder="e.g. Rose Deluxe, Sunshine Mix" />
        <PhotoInput
          name="referenceImage"
          label="Reference photo (optional)"
          required={false}
          useCamera={false}
          placeholder="What the bouquet should look like"
        />
        <DateTimeField label="Deliver by" name="deadlineAt" />
        <Field label="Internal notes" name="notes" as="textarea" placeholder="Anything the team should know (not shown to customer)" />

        <SubmitButton
          pendingText="Creating…"
          className="mt-2 rounded-xl bg-brand text-brand-ink font-semibold py-3 hover:opacity-90 transition"
        >
          Create order
        </SubmitButton>
      </form>
    </div>
  );
}
