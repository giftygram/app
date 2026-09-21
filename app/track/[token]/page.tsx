import { db } from "@/lib/db";
import { CUSTOMER_STEP_MESSAGE, CUSTOMER_TIMELINE, type OrderStatus } from "@/lib/status";
import { formatEventTime } from "@/lib/date";
import { normalizePhone } from "@/lib/whatsapp";
import { cn } from "@/lib/cn";
import { ZoomablePhoto } from "@/components/zoomable-photo";
import { TrackLogo } from "@/components/track-logo";
import { TrackSearchForm } from "@/components/track-search-form";

export default async function TrackPage(props: PageProps<"/track/[token]">) {
  const { token: rawToken } = await props.params;
  const token = decodeURIComponent(rawToken);

  // Either our own tracking code or Shopify's order token — the confirmation
  // email can only carry the latter, since Shopify sends it before this order
  // reaches us. Both are random and unguessable.
  const order = await db.order.findFirst({
    where: { OR: [{ trackingToken: token }, { shopifyOrderToken: token }] },
    include: {
      driver: true,
      photos: { orderBy: { createdAt: "desc" } },
      statusEvents: { orderBy: { createdAt: "asc" } },
    },
  });
  // A customer opening the confirmation email within a second or two of
  // checking out can beat our own webhook here, and a bare "page not found"
  // reads as "your order doesn't exist". Say what's actually happening and
  // leave them somewhere useful.
  if (!order) {
    return (
      <main className="flex-1 flex justify-center bg-background px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <TrackLogo />
            <h1 className="text-lg font-semibold text-foreground">GiftyGram Flowers</h1>
            <p className="text-sm text-muted mt-1">
              We couldn&apos;t find that order just yet. If you&apos;ve only just ordered, give it a
              minute and refresh — otherwise check the tracking code from your email below.
            </p>
          </div>
          <TrackSearchForm />
        </div>
      </main>
    );
  }

  const status = order.status as OrderStatus;
  const driverName = order.driver?.name ?? order.externalDriverName;
  const driverPhone = order.driver?.phone ?? order.externalDriverPhone;
  // Customers only ever see the florist's bouquet photo — the delivery
  // photo is proof-of-delivery for the shop's own records, not for the
  // recipient (it's often taken at the doorstep, not a flattering shot).
  // Photos are newest-first, so this is always the latest revision.
  const bouquetPhoto = order.photos.find((p) => p.type === "BOUQUET");
  const currentIndex = CUSTOMER_TIMELINE.indexOf(status);

  // First time each stage was reached, so the timeline can show real timings.
  const reachedAt = new Map<OrderStatus, Date>();
  for (const event of order.statusEvents) {
    const s = event.toStatus as OrderStatus;
    if (!reachedAt.has(s)) reachedAt.set(s, event.createdAt);
  }

  return (
    <main className="flex-1 flex justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <TrackLogo />
          <h1 className="text-lg font-semibold text-foreground">GiftyGram Flowers</h1>
          <p className="font-mono text-sm text-muted mt-1">{order.orderNumber}</p>
        </div>

        {status === "CANCELLED" ? (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center">
            <p className="text-foreground font-medium">This order was cancelled.</p>
            <p className="text-sm text-muted mt-1">Contact GiftyGram Flowers for details.</p>
          </div>
        ) : status === "FAILED_DELIVERY" ? (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center">
            <p className="text-foreground font-medium">We couldn&apos;t complete delivery.</p>
            <p className="text-sm text-muted mt-1">
              We&apos;ll be in touch shortly to sort this out — or contact GiftyGram Flowers directly.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-line bg-surface p-6 text-center mb-6">
              <p className="text-xl font-semibold text-brand text-balance">
                {CUSTOMER_STEP_MESSAGE[status]}
              </p>
            </div>

            {status === "OUT_FOR_DELIVERY" && driverPhone && (
              <div className="rounded-2xl border border-line bg-surface p-4 mb-6 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted">Your driver</p>
                  <p className="text-sm font-medium text-foreground truncate">{driverName}</p>
                </div>
                <a
                  href={`tel:+${normalizePhone(driverPhone)}`}
                  className="shrink-0 rounded-xl bg-brand text-brand-ink font-semibold px-4 py-2.5 text-sm hover:opacity-90 transition"
                >
                  📞 Call
                </a>
              </div>
            )}

            {bouquetPhoto && (
              <div className="mb-6">
                <ZoomablePhoto src={bouquetPhoto.url} alt="Your bouquet" />
                <p className="text-xs text-muted text-center mt-2">
                  Your bouquet — tap the photo to zoom in
                </p>
              </div>
            )}

            <ol className="flex flex-col">
              {CUSTOMER_TIMELINE.map((step, i) => {
                const done = i <= currentIndex;
                const isCurrent = i === currentIndex;
                const isLast = i === CUSTOMER_TIMELINE.length - 1;
                const nextDone = i < currentIndex;
                const timestamp = reachedAt.get(step);

                return (
                  <li key={step} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-background",
                          done ? "bg-brand" : "bg-line"
                        )}
                      />
                      {!isLast && (
                        <span
                          className={cn("w-px flex-1 min-h-6", nextDone ? "bg-brand" : "bg-line")}
                        />
                      )}
                    </div>
                    <div className={cn("flex-1 flex items-start justify-between gap-3 min-w-0", !isLast && "pb-4")}>
                      <span
                        className={cn(
                          "text-sm text-balance",
                          isCurrent
                            ? "font-semibold text-foreground"
                            : done
                              ? "text-foreground"
                              : "text-muted"
                        )}
                      >
                        {CUSTOMER_STEP_MESSAGE[step]}
                      </span>
                      {timestamp && (
                        <span className="text-xs text-muted shrink-0 whitespace-nowrap mt-0.5">
                          {formatEventTime(timestamp)}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </main>
  );
}
