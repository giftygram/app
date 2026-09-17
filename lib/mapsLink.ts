/**
 * Pulls coordinates out of the map link Operations already pastes onto an
 * order.
 *
 * Slider needs a latitude and longitude to dispatch, and our orders only carry
 * a written address plus whatever link the customer sent over WhatsApp — so
 * this is what stands between "paste a pin" and a rider being sent somewhere.
 * It is deliberately strict: it would rather say "I can't read this link" than
 * hand back a plausible-looking wrong point, because a wrong pin costs a real
 * delivery fee and a bouquet at the wrong door.
 */

/** Bounding box for the UAE, generously drawn. */
const UAE_BOUNDS = { minLat: 22, maxLat: 27, minLng: 51, maxLng: 57 };

export type ParsedPin = {
  latitude: number;
  longitude: number;
  /** Which pattern matched — useful when explaining a bad pin to Operations. */
  source: "place-data" | "viewport" | "query" | "raw";
};

/**
 * Short links (maps.app.goo.gl, goo.gl/maps) carry no coordinates at all —
 * they have to be followed first, which needs a network call, hence async.
 */
export async function parseMapLink(link: string): Promise<ParsedPin | null> {
  const trimmed = link.trim();
  if (!trimmed) return null;

  const direct = parseMapLinkSync(trimmed);
  if (direct) return direct;

  if (!isShortLink(trimmed)) return null;

  const expanded = await expandShortLink(trimmed);
  return expanded ? parseMapLinkSync(expanded) : null;
}

function isShortLink(link: string) {
  return /(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)/i.test(link);
}

async function expandShortLink(link: string): Promise<string | null> {
  try {
    const response = await fetch(link, { redirect: "follow", cache: "no-store" });
    // response.url is the address we ended up at, which is the long Maps URL.
    return response.url || null;
  } catch {
    return null;
  }
}

/** The part that needs no network — exported for tests and for reuse. */
export function parseMapLinkSync(link: string): ParsedPin | null {
  // !3d<lat>!4d<lng> is the *place's* own position, and is what Google uses
  // when you share a pin. Checked first because the @lat,lng further up the
  // same URL is only where the map was centred — close, but not the place,
  // and on a long street that difference is a different building.
  const placeData = link.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (placeData) return pin(placeData[1], placeData[2], "place-data");

  const viewport = link.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (viewport) return pin(viewport[1], viewport[2], "viewport");

  // ?q=25.1,55.2 · ?q=loc:25.1,55.2 · ?ll= · ?daddr= · &destination= —
  // between Google Maps, Apple Maps and WhatsApp's own "shared location"
  // links, customers send all of these.
  const query = link.match(
    /[?&](?:q|ll|sll|daddr|destination|center)=(?:loc:)?(-?\d+\.\d+),\s*(-?\d+\.\d+)/i
  );
  if (query) return pin(query[1], query[2], "query");

  // Someone pasted bare coordinates instead of a link.
  const raw = link.match(/^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/);
  if (raw) return pin(raw[1], raw[2], "raw");

  return null;
}

function pin(latText: string, lngText: string, source: ParsedPin["source"]): ParsedPin | null {
  const latitude = Number(latText);
  const longitude = Number(lngText);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  // Rejecting anything outside the UAE catches the failure that matters most:
  // latitude and longitude the wrong way round still parses fine, and would
  // otherwise dispatch a rider to a point in the Arabian Sea.
  if (latitude < UAE_BOUNDS.minLat || latitude > UAE_BOUNDS.maxLat) return null;
  if (longitude < UAE_BOUNDS.minLng || longitude > UAE_BOUNDS.maxLng) return null;

  return { latitude, longitude, source };
}

/** A link Operations can tap to see exactly the point we're about to send. */
export function pinPreviewLink(pin: { latitude: number; longitude: number }) {
  return `https://www.google.com/maps/search/?api=1&query=${pin.latitude},${pin.longitude}`;
}
