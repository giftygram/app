import { db } from "@/lib/db";
import { logStatus } from "@/lib/statusLog";
import { effectiveApproval } from "@/lib/approval";
import { parseMapLink, type ParsedPin } from "@/lib/mapsLink";
import {
  createSliderDelivery,
  quoteSliderFare,
  SliderError,
  sliderPickup,
  toE164,
  type SliderFareQuote,
} from "@/lib/slider";

/**
 * Sending an order to Slider's rider network from here, rather than retyping
 * it into Slider's dashboard.
 *
 * Everything Slider needs already exists on the order — the pin lives in the
 * map link Operations pastes, the address and the recipient's number are on
 * the order itself — so dispatch is a matter of assembling it, pricing it, and
 * letting Operations confirm before any money leaves the wallet.
 */

/** What the rider ends up seeing, assembled from the order. */
export type SliderDropoff = {
  latitude: number;
  longitude: number;
  address: string;
  directions: string;
  contactNumber: string;
  pinSource: ParsedPin["source"];
};

export type DispatchableOrder = {
  id: string;
  orderNumber: string;
  status: string;
  approvalStatus: string;
  approvalDeadline: Date | null;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  deliveryArea: string | null;
  mapsLink: string | null;
  sliderOrderNumber: string | null;
};

/**
 * Turns an order into a dropoff, or explains what's missing in words
 * Operations can act on — every one of these is a thing they can go and fix.
 */
export async function buildSliderDropoff(order: DispatchableOrder): Promise<SliderDropoff> {
  if (!sliderPickup()) {
    throw new SliderError("The shop's pickup location isn't configured yet — tell your developer.");
  }
  if (!order.mapsLink) {
    throw new SliderError(
      "This order has no map link. Add the recipient's pin to the order first — Slider can't dispatch without one."
    );
  }

  const pin = await parseMapLink(order.mapsLink);
  if (!pin) {
    throw new SliderError(
      "Couldn't read a location from this order's map link. Open it, then copy the link from the pin itself (or paste the coordinates)."
    );
  }

  const contactNumber = toE164(order.recipientPhone);
  if (!contactNumber) {
    throw new SliderError("The recipient's phone number is missing or unreadable.");
  }

  // Slider shows `address` as the delivery's main line and `directions` as
  // the building/floor/unit note. Our written address is the only thing that
  // holds "Villa 7, second gate" — and a rider whose pin drops on the wrong
  // side of a compound needs to read it, so it goes in both places rather
  // than only under the map.
  const area = order.deliveryArea?.trim();
  const written = order.deliveryAddress.trim();
  const includesArea = area ? written.toLowerCase().includes(area.toLowerCase()) : true;
  const address = area && !includesArea ? `${written} — ${area}` : written;

  return {
    latitude: pin.latitude,
    longitude: pin.longitude,
    address,
    // Name first: it's what the rider says at the door, and it's how the
    // recipient knows the delivery is really theirs.
    directions: truncate(`${order.recipientName} · ${address}`, 240),
    contactNumber,
    pinSource: pin.source,
  };
}

function truncate(text: string, max: number) {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Ready for a rider at all? Mirrors assertCanDispatch in app/actions/orders.ts. */
export function assertSliderDispatchable(order: DispatchableOrder) {
  if (order.sliderOrderNumber) {
    throw new SliderError(`This order is already with Slider as #${order.sliderOrderNumber}.`);
  }
  if (order.status !== "READY" && order.status !== "ASSIGNED_DRIVER") {
    throw new Error("This order isn't ready for a driver yet.");
  }
  if (order.status === "READY" && effectiveApproval(order) !== "APPROVED") {
    throw new Error("Waiting on the customer to approve the bouquet before this can be dispatched.");
  }
}

export type SliderQuote = {
  dropoff: SliderDropoff;
  fare: SliderFareQuote;
};

export async function quoteSliderForOrder(order: DispatchableOrder): Promise<SliderQuote> {
  assertSliderDispatchable(order);
  const dropoff = await buildSliderDropoff(order);
  const fare = await quoteSliderFare(dropoff);
  return { dropoff, fare };
}

/**
 * How much the fare may drift between Operations seeing a price and pressing
 * confirm. Slider reprices with live traffic, so some movement is normal —
 * past this the price on screen is no longer the price being charged, and
 * confirming it wouldn't mean anything.
 */
const FARE_TOLERANCE_AED = 3;

export type DispatchOutcome =
  | { ok: true; sliderOrderNumber: string; fare: number; trackingUrl: string }
  | { ok: false; repriced: true; oldFare: number; newFare: number }
  | { ok: false; repriced: false; error: string };

/**
 * Dispatches, and saves the result onto the order so the existing sync takes
 * over from here.
 *
 * `expectedFare` is what Operations was looking at when they pressed the
 * button; if Slider has repriced beyond the tolerance, nothing is sent and
 * they're asked again with the new number.
 */
export async function dispatchOrderToSlider(
  order: DispatchableOrder,
  vehicleType: "bike" | "car" | "any",
  expectedFare: number,
  employeeId: string | null
): Promise<DispatchOutcome> {
  try {
    assertSliderDispatchable(order);
    const dropoff = await buildSliderDropoff(order);

    // Re-price immediately before spending: the screen may have been sitting
    // open for a while, and traffic moves the fare.
    const fare = await quoteSliderFare(dropoff);
    const option = fare.vehicles.find((vehicle) => vehicle.vehicle_type === vehicleType);
    if (vehicleType !== "any") {
      if (!option?.is_available || option.delivery_fee === null) {
        return {
          ok: false,
          repriced: false,
          error: option?.unavailable_reason ?? `Slider has no ${vehicleType} available for this trip.`,
        };
      }
      if (Math.abs(option.delivery_fee - expectedFare) > FARE_TOLERANCE_AED) {
        return { ok: false, repriced: true, oldFare: expectedFare, newFare: option.delivery_fee };
      }
    }

    const dispatch = await createSliderDelivery({
      orderNumber: order.orderNumber,
      vehicleType,
      dropoff,
    });

    await db.order.update({
      where: { id: order.id },
      data: {
        sliderOrderNumber: String(dispatch.order_number),
        sliderStatus: dispatch.status,
        sliderTrackingUrl: dispatch.tracking_url,
        sliderSyncedAt: new Date(),
        sliderSyncError: null,
        // Slider is an outside courier; the rider's own name replaces this
        // as soon as one is assigned and the sync picks it up.
        externalDriverName: "Slider",
        externalDriverPhone: null,
        driverId: null,
        status: "ASSIGNED_DRIVER",
      },
    });

    if (order.status !== "ASSIGNED_DRIVER") {
      await logStatus(order.id, order.status, "ASSIGNED_DRIVER", employeeId);
    }

    return {
      ok: true,
      sliderOrderNumber: String(dispatch.order_number),
      fare: dispatch.fare,
      trackingUrl: dispatch.tracking_url,
    };
  } catch (error) {
    if (error instanceof SliderError) {
      return { ok: false, repriced: false, error: error.message };
    }
    throw error;
  }
}
