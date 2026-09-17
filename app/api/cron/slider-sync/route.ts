import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isSliderConfigured } from "@/lib/slider";
import { syncAllSliderOrders } from "@/lib/sliderSync";
import { promoteDispatchReadyOrders } from "@/lib/dispatchReady";

/**
 * Polls Slider for every linked order that's still moving.
 *
 * Polling rather than webhooks because orders are placed by hand in Slider's
 * dashboard: webhooks belong to a partner *application* and fire for
 * deliveries created through the API, which these aren't. Once orders are
 * created from this app, a webhook can replace most of this — the mapping and
 * photo handling in lib/sliderSync are already shared.
 *
 * Scheduled in vercel.json. Vercel sends `Authorization: Bearer $CRON_SECRET`
 * when that env var is set, which is what the check below expects.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // No secret set means anyone could trigger this, so refuse rather than run
  // openly — an unauthenticated endpoint that burns API calls is worse than a
  // sync that isn't running yet.
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSliderConfigured()) {
    return NextResponse.json({ error: "SLIDER_API_KEY is not set." }, { status: 503 });
  }

  const results = await syncAllSliderOrders();
  // Backstop for orders that reached READY with a courier already attached by
  // a route that doesn't promote them itself — an Operations status override,
  // or a re-dispatch after a failed delivery.
  const promoted = await promoteDispatchReadyOrders();

  // Only touch the cache when something actually changed — this runs every
  // few minutes and most runs find nothing new.
  const changed = results.filter((r) => r.newStatus || r.photoSaved);
  if (changed.length > 0 || promoted.length > 0) {
    revalidatePath("/ops");
    revalidatePath("/driver");
    for (const result of changed) {
      revalidatePath(`/ops/orders/${result.orderId}`);
    }
    for (const id of promoted) {
      revalidatePath(`/ops/orders/${id}`);
    }
    const orders = await db.order.findMany({
      where: { id: { in: [...changed.map((r) => r.orderId), ...promoted] } },
      select: { trackingToken: true },
    });
    for (const order of orders) {
      revalidatePath(`/track/${encodeURIComponent(order.trackingToken)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    checked: results.length,
    changed: changed.length,
    promoted: promoted.length,
    errors: results.filter((r) => r.error).length,
    results,
  });
}
