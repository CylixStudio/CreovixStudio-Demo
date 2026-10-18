// Long-lived SSE connections poll the database every couple of seconds.
// The default server client reuses the runtime's HTTP cache, so repeated
// identical PostgREST GETs inside one connection can return stale rows and
// the overlay never receives new events. This client forces `no-store`.
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

function createLiveClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("Missing Supabase server environment variables.");

  return createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);
        headers.set("cache-control", "no-cache");
        if (headers.get("Authorization") === `Bearer ${key}` && !key.startsWith("ey")) {
          headers.delete("Authorization");
        }
        return fetch(input, { ...init, headers, cache: "no-store" });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

let cached: ReturnType<typeof createLiveClient> | undefined;

export function overlayLiveClient() {
  if (!cached) cached = createLiveClient();
  return cached;
}
