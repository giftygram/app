import { randomBytes } from "crypto";
import { db } from "@/lib/db";

// Lowercase letters + digits, no separators — short enough to read out over
// the phone or retype from a screenshot, long enough (36^10 ≈ 3.7×10^15
// combinations) that guessing one is not a realistic attack.
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const LENGTH = 10;

function randomToken(): string {
  const bytes = randomBytes(LENGTH);
  let token = "";
  for (let i = 0; i < LENGTH; i++) {
    token += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return token;
}

// Collisions are astronomically unlikely at this volume, but the column is
// unique — check first rather than let order creation fail on the rare clash.
export async function createUniqueTrackingToken(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = randomToken();
    const existing = await db.order.findUnique({ where: { trackingToken: token }, select: { id: true } });
    if (!existing) return token;
  }
  throw new Error("Could not generate a unique tracking token after 5 attempts");
}
