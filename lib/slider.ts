/**
 * Read-only client for Slider, the outsourced courier network.
 *
 * Orders are placed by hand in Slider's own dashboard, so the only thing this
 * app does is *read* a delivery we already know the number of. Creating
 * deliveries from here (POST /deliveries) is a later step and deliberately
 * not implemented yet — it needs dropoff coordinates, which our orders don't
 * carry.
 *
 * Docs: https://partners.slider-app.com/docs. The key is a partner key from
 * the partner portal (partners.slider-app.com), NOT a login for the customer
 * dashboard at ordermanager.slider-app.com — they are separate accounts, and
 * only the former has an API. The partner key can read deliveries placed by
 * hand in the customer dashboard, which is what makes this whole approach
 * work.
 */

const API_BASE = process.env.SLIDER_API_BASE ?? "https://api.slider-app.com/v1";

/** Every status Slider's webhooks and status endpoint can report. */
export const SLIDER_STATUSES = [
  "searching_rider",
  "rider_assigned",
  "heading_to_pickup",
  "at_pickup",
  "picked_up",
  "in_transit",
  "delivered",
  "return_trip_started",
  "cancelled",
] as const;

export type SliderStatus = (typeof SLIDER_STATUSES)[number];

export type SliderDelivery = {
  order_number: number;
  /** Our own reference — null for orders placed by hand in Slider's dashboard. */
  order_id: string | null;
  status: SliderStatus | string;
  order_time: string | null;
  vehicle_type: string | null;
  fare: number | null;
  distance: number | null;
  /**
   * Slider drops this the moment an order is delivered, so rider details can
   * only be captured while the delivery is still in flight.
   */
  driver: {
    name: string | null;
    phone_number: string | null;
    latitude: number | null;
    longitude: number | null;
    vehicle: string | null;
  } | null;
  tracking_url: string | null;
  /**
   * The driver's proof-of-delivery photo. Undocumented — it appears in no
   * published response schema — but it is returned, and it is a public S3 URL
   * needing no auth. Null until the driver actually uploads, which can land a
   * beat *after* the status flips to "delivered"; see syncSliderOrder.
   */
  proof_image: string | null;
};

export class SliderError extends Error {
  readonly httpStatus: number | null;

  constructor(message: string, httpStatus: number | null = null) {
    super(message);
    this.name = "SliderError";
    this.httpStatus = httpStatus;
  }
}

/**
 * How Slider's delivery statuses land on ours. Slider only ever describes the
 * delivery leg, so everything before pickup collapses onto ASSIGNED_DRIVER —
 * from the shop's point of view "a rider is coming for it" is one state.
 */
export const SLIDER_TO_ORDER_STATUS = {
  searching_rider: "ASSIGNED_DRIVER",
  rider_assigned: "ASSIGNED_DRIVER",
  heading_to_pickup: "ASSIGNED_DRIVER",
  at_pickup: "ASSIGNED_DRIVER",
  picked_up: "OUT_FOR_DELIVERY",
  in_transit: "OUT_FOR_DELIVERY",
  delivered: "DELIVERED",
  // The rider is bringing the flowers back — for us that's a failed delivery
  // needing Operations, exactly like a courier who couldn't hand it over.
  return_trip_started: "FAILED_DELIVERY",
  cancelled: "FAILED_DELIVERY",
} as const satisfies Record<SliderStatus, string>;

/** Human wording for Slider's raw status, for the ops screen. */
export const SLIDER_STATUS_LABEL: Record<SliderStatus, string> = {
  searching_rider: "Finding a rider",
  rider_assigned: "Rider assigned",
  heading_to_pickup: "Rider heading to the shop",
  at_pickup: "Rider at the shop",
  picked_up: "Picked up",
  in_transit: "On the way",
  delivered: "Delivered",
  return_trip_started: "Returning to the shop",
  cancelled: "Cancelled in Slider",
};

export function sliderStatusLabel(status: string | null): string | null {
  if (!status) return null;
  return SLIDER_STATUS_LABEL[status as SliderStatus] ?? status.replace(/_/g, " ");
}

export function isSliderConfigured() {
  return Boolean(process.env.SLIDER_API_KEY);
}

/**
 * Fetches one delivery. Throws SliderError rather than returning null so the
 * caller can tell "Slider says this order doesn't exist" (404 — almost always
 * a mistyped order number) apart from "Slider is down", and show Operations
 * the difference.
 */
export async function fetchSliderDelivery(orderNumber: string): Promise<SliderDelivery> {
  const apiKey = process.env.SLIDER_API_KEY;
  if (!apiKey) throw new SliderError("SLIDER_API_KEY is not set.");

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/deliveries/${encodeURIComponent(orderNumber)}`, {
      headers: { "X-Slider-Key": apiKey },
      // Status is the whole point of the call — a cached one is worthless.
      cache: "no-store",
    });
  } catch (error) {
    throw new SliderError(
      `Couldn't reach Slider: ${error instanceof Error ? error.message : "network error"}`
    );
  }

  if (!response.ok) {
    throw new SliderError(await failureMessage(response), response.status);
  }

  return (await response.json()) as SliderDelivery;
}

async function failureMessage(response: Response) {
  if (response.status === 404) return "Slider has no order with that number.";
  if (response.status === 401) return "Slider rejected our API key.";
  if (response.status === 403) return "That Slider order belongs to a different account.";

  // Slider's errors are {success:false, message:"…"} — but only when they come
  // from the API itself. A proxy or gateway error is HTML, which would put a
  // page of markup on the ops screen, so fall back to the bare status.
  try {
    const body = (await response.json()) as { message?: string };
    if (body?.message) return body.message;
  } catch {
    // fall through
  }
  return `Slider returned HTTP ${response.status}.`;
}
