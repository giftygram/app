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

/* ------------------------------------------------------------------ *
 * Dispatching a delivery
 * ------------------------------------------------------------------ */

/**
 * The shop. Every delivery leaves from here, so it's configuration rather
 * than anything Operations types per order.
 *
 * The coordinates have no default on purpose: a guessed pickup pin sends a
 * paid rider to the wrong street, so the app refuses to dispatch until the
 * real one is set.
 */
export function sliderPickup() {
  const latitude = Number(process.env.SLIDER_PICKUP_LAT);
  const longitude = Number(process.env.SLIDER_PICKUP_LNG);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    address:
      process.env.SLIDER_PICKUP_ADDRESS ??
      "GiftyGram Flowers - JVC - Lolow road - Dubai",
    latitude,
    longitude,
    directions: process.env.SLIDER_PICKUP_DIRECTIONS ?? "R03, Ground Floor",
    contact_number: process.env.SLIDER_PICKUP_PHONE ?? "+971509192833",
  };
}

export function sliderAccountId() {
  return process.env.SLIDER_ACCOUNT_ID ?? null;
}

/** Whether this app can dispatch at all — used to hide the button rather than
 *  show Operations one that can only fail. */
export function sliderAccountConfigured() {
  return Boolean(sliderPickup() && sliderAccountId() && isSliderConfigured());
}

export type SliderVehicleOption = {
  vehicle_type: "bike" | "car";
  is_available: boolean;
  unavailable_reason: string | null;
  delivery_fee: number | null;
};

export type SliderFareQuote = {
  distance_km: number;
  duration_minutes: number;
  vehicles: SliderVehicleOption[];
};

/**
 * Prices a delivery before anyone commits to it. Free to call, and the fare
 * moves with traffic — so a quote is only good for a few minutes, which is
 * why dispatch re-checks it rather than trusting what the screen shows.
 */
export async function quoteSliderFare(dropoff: {
  latitude: number;
  longitude: number;
}): Promise<SliderFareQuote> {
  const pickup = sliderPickup();
  if (!pickup) throw new SliderError("The shop's pickup coordinates aren't configured yet.");

  const accountId = sliderAccountId();
  if (!accountId) throw new SliderError("SLIDER_ACCOUNT_ID is not set.");

  const body = {
    account_id: accountId,
    pickup: { latitude: pickup.latitude, longitude: pickup.longitude },
    // Note the asymmetry in Slider's own API: the fare endpoint calls it
    // "delivery", the create endpoint calls the same thing "dropoff".
    delivery: { latitude: dropoff.latitude, longitude: dropoff.longitude },
  };

  return (await sliderPost("/deliveries/fare", body)) as SliderFareQuote;
}

export type SliderDispatch = {
  order_number: number;
  order_id: string;
  status: string;
  vehicle_type: string;
  fare: number;
  currency: string;
  distance_km: number;
  tracking_url: string;
  created_at: string;
};

/**
 * Sends the order to Slider's rider network. The fare is taken from the
 * prepaid wallet at this moment — this is the call that spends money.
 */
export async function createSliderDelivery(input: {
  orderNumber: string;
  vehicleType: "bike" | "car" | "any";
  dropoff: {
    latitude: number;
    longitude: number;
    /** The written address, for a rider who'd rather read than follow a pin. */
    address: string;
    /** Building, floor, flat — what they need at the door. */
    directions: string;
    contactNumber: string;
  };
}): Promise<SliderDispatch> {
  const pickup = sliderPickup();
  if (!pickup) throw new SliderError("The shop's pickup coordinates aren't configured yet.");

  const accountId = sliderAccountId();
  if (!accountId) throw new SliderError("SLIDER_ACCOUNT_ID is not set.");

  const body = {
    // Our own reference. Slider echoes it back on every status read and
    // webhook, which is what makes a dispatched order self-linking — no
    // pasting a Slider number, unlike orders placed by hand in their
    // dashboard.
    order_id: input.orderNumber,
    account_id: accountId,
    // What the rider sees on their screen at pickup and at the door, so the
    // number on our paperwork and the number on their phone are the same one.
    display_order_id: input.orderNumber,
    vehicle_type: input.vehicleType,
    driver_tip: 0,
    pickup,
    dropoff: {
      address: input.dropoff.address,
      latitude: input.dropoff.latitude,
      longitude: input.dropoff.longitude,
      directions: input.dropoff.directions,
      contact_number: input.dropoff.contactNumber,
    },
    // No payment_on_delivery: customers pay us online, and the delivery fee
    // comes out of the Slider wallet. Sending this object would make the
    // rider ask the recipient for money.
  };

  return (await sliderPost("/deliveries", body)) as SliderDispatch;
}

async function sliderPost(path: string, body: unknown) {
  const apiKey = process.env.SLIDER_API_KEY;
  if (!apiKey) throw new SliderError("SLIDER_API_KEY is not set.");

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "X-Slider-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    throw new SliderError(
      `Couldn't reach Slider: ${error instanceof Error ? error.message : "network error"}`
    );
  }

  if (!response.ok) {
    throw new SliderError(await dispatchFailureMessage(response), response.status);
  }

  return response.json();
}

async function dispatchFailureMessage(response: Response) {
  // The one Operations will actually hit, and "402" tells them nothing.
  if (response.status === 402) {
    return "Slider's wallet is out of balance — top it up in the Slider dashboard, then try again.";
  }
  if (response.status === 401) return "Slider rejected our API key.";

  try {
    const body = (await response.json()) as { message?: string };
    if (body?.message) return body.message;
  } catch {
    // fall through
  }
  return `Slider returned HTTP ${response.status}.`;
}

/**
 * Slider wants E.164. Our numbers are typed by hand and arrive as "05…",
 * "9715…", "+971 5…" — this settles them into one shape.
 */
export function toE164(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("0")) return `+971${digits.slice(1)}`;
  if (digits.startsWith("971")) return `+${digits}`;
  // A bare local number with no country code at all ("509192833").
  if (digits.length === 9) return `+971${digits}`;
  return `+${digits}`;
}
