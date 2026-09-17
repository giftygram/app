import { redirect } from "next/navigation";
import Image from "next/image";
import { db } from "@/lib/db";
import { TrackSearchForm } from "@/components/track-search-form";

// The direct link (/track/#2798) is what most customers land on from their
// email or WhatsApp — this bare page is the fallback for the rare visitor
// who has no link at all, just their order number.
//
// Also doubles as the landing spot for the "Placed Order" confirmation
// email's button, which can't safely put a raw "#" in a path segment (mail
// clients and browsers treat it as a fragment, truncating the URL there).
// That email links here with ?order=2798 instead, and this redirects to
// the real order page server-side, where the "#" is safely percent-encoded.
//
// ?shopifyId=<numeric> is the other entry point, used by the same email:
// Klaviyo's template engine rejects dotted access into the "Placed Order"
// event's $extra bag (where the display order number "#2798" lives), so
// the button instead uses {{ event.$event_id }} — a plain top-level merge
// tag, same family as the standard {{ event.$value }} — which is the
// Shopify numeric order id, not the display number. Resolved here instead.
export default async function TrackLandingPage(props: PageProps<"/track">) {
  const searchParams = await props.searchParams;
  const rawOrder = typeof searchParams.order === "string" ? searchParams.order.trim() : "";
  if (rawOrder) {
    const orderNumber = rawOrder.startsWith("#") ? rawOrder : `#${rawOrder}`;
    redirect(`/track/${encodeURIComponent(orderNumber)}`);
  }

  const shopifyId = typeof searchParams.shopifyId === "string" ? searchParams.shopifyId.trim() : "";
  if (shopifyId) {
    const order = await db.order.findUnique({ where: { shopifyOrderId: shopifyId }, select: { orderNumber: true } });
    if (order) redirect(`/track/${encodeURIComponent(order.orderNumber)}`);
  }

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
          <p className="text-sm text-muted mt-1">Enter your order number to track your delivery</p>
        </div>

        <TrackSearchForm />
      </div>
    </main>
  );
}
