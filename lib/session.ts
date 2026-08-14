import { createHmac, timingSafeEqual } from "crypto";

export type SessionPayload = {
  employeeId: string;
  name: string;
  role: "OPERATIONS" | "FLORIST" | "DRIVER";
};

const SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret";

function sign(value: string) {
  return createHmac("sha256", SECRET).update(value).digest("base64url");
}

export function createSessionToken(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readSessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
