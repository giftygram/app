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
  if (!KLAVIYO_API_KEY) {
    console.error("Klaviyo: KLAVIYO_API_KEY is not set — no customer status emails will send");
    return;
  }

  try {
    const res = await fetch("https://a.klaviyo.com/api/events/", {
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
      // Without this, a hanging Klaviyo request hangs the staff action that
      // triggered it — the florist's "mark ready" would spin until the
      // platform timeout on work the database already committed.
      signal: AbortSignal.timeout(5000),
    });
    // A rotated key, a 429, or a dropped API revision all fail silently
    // otherwise: no emails, no symptom anywhere in the app.
    if (!res.ok) {
      console.error("Klaviyo event rejected", {
        metricName,
        status: res.status,
        body: (await res.text().catch(() => "")).slice(0, 500),
      });
    }
  } catch (err) {
    console.error("Klaviyo event failed", { metricName, err });
  }
}
