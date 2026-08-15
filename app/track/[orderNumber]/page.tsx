import { notFound } from "next/navigation";
import Image from "next/image";
import { db } from "@/lib/db";
import { CUSTOMER_STEP_MESSAGE, CUSTOMER_TIMELINE, type OrderStatus } from "@/lib/status";
import { effectiveApproval } from "@/lib/approval";
import { formatEventTime } from "@/lib/date";
import { normalizePhone } from "@/lib/whatsapp";
import { cn } from "@/lib/cn";
import { ApprovalActions } from "@/components/approval-actions";
import { ApprovalCountdown } from "@/components/approval-countdown";
import { ZoomablePhoto } from "@/components/zoomable-photo";

export default async function TrackPage(props: PageProps<"/track/[orderNumber]">) {
  const { orderNumber: rawOrderNumber } = await props.params;
  // Next doesn't decode "#" in dynamic segments (fragment ambiguity), and
  // Shopify order numbers commonly start with one — decode defensively.
  const orderNumber = decodeURIComponent(rawOrderNumber);

  const order = await db.order.findUnique({
    where: { orderNumber },
    include: {
      driver: true,
      photos: { orderBy: { createdAt: "desc" } },
      statusEvents: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  const status = order.status as OrderStatus;
  const driverName = order.driver?.name ?? order.externalDriverName;
  const driverPhone = order.driver?.phone ?? order.externalDriverPhone;
  // Customers only ever see the florist's bouquet photo — the delivery
  // photo is proof-of-delivery for the shop's own records, not for the
  // recipient (it's often taken at the doorstep, not a flattering shot).
  // Photos are newest-first, so this is always the latest revision.
  const bouquetPhoto = order.photos.find((p) => p.type === "BOUQUET");
  const currentIndex = CUSTOMER_TIMELINE.indexOf(status);

  const needsApproval =
    status === "READY" && order.approvalDeadline !== null && effectiveApproval(order) === "PENDING";

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
                {needsApproval ? "Take a look at your bouquet 🌸" : CUSTOMER_STEP_MESSAGE[status]}
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

            {needsApproval ? (
              <div className="rounded-2xl border border-line bg-surface p-5 mb-6 flex flex-col gap-4">
                {bouquetPhoto && <ZoomablePhoto src={bouquetPhoto.url} alt="Your bouquet" />}
                <div className="flex flex-col items-center gap-3 text-center">
                  <p className="text-sm font-medium text-foreground">Does this look right to you?</p>
                  <ApprovalActions orderId={order.id} />
                  {order.approvalDeadline && (
                    <ApprovalCountdown deadline={order.approvalDeadline.toISOString()} />
                  )}
                </div>
              </div>
            ) : (
              bouquetPhoto && (
                <div className="mb-6">
                  <ZoomablePhoto src={bouquetPhoto.url} alt="Your bouquet" />
                  <p className="text-xs text-muted text-center mt-2">Your bouquet — tap the photo to zoom in</p>
                </div>
              )
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
