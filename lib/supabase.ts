import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const PHOTOS_BUCKET = "order-photos";

let client: SupabaseClient | null = null;

/**
 * Service-role client — server-only, bypasses row-level security. Never
 * import this from a Client Component or expose the key to the browser.
 * Built lazily so the rest of the app keeps working before these env vars
 * are set; only photo upload/download fails until they are.
 */
export function supabaseAdmin() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.");
  }

  client = createClient(url, key);
  return client;
}
