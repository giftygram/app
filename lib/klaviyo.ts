// Pushes order-status events into Klaviyo so its flows can email the
// customer — "Order Ready" and "Order Delivered" flows are built directly
// on these metric names. Deliberately fire-and-forget: a marketing-email
// hiccup must never block or fail an order's actual status change.

const KLAVIYO_API_KEY = process.env.KLAVIYO_API_KEY;

export async function trackKlaviyoEvent(
  email: string,
  metricName: string,
  properties: Record<string, unknown>
): Promise<void> {
  if (!KLAVIYO_API_KEY) return;

  try {
    await fetch("https://a.klaviyo.com/api/events/", {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
        "content-type": "application/vnd.api+json",
        accept: "application/vnd.api+json",
        revision: "2025-07-15",
      },
      body: JSON.stringify({
        data: {
          type: "event",
          attributes: {
            properties,
            metric: { data: { type: "metric", attributes: { name: metricName } } },
            profile: { data: { type: "profile", attributes: { email } } },
          },
        },
      }),
    });
  } catch {
    // best-effort, see file comment
  }
}
