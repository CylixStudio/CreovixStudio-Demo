import "@/lib/demoGuard";

import type { SupabaseClient } from "@supabase/supabase-js";

import { DEMO_BUILD, DEMO_USER_ID, getDemoUser } from "@/lib/demoMode";
import { getDemoDb } from "@/demo/context";
import type { Database } from "@/lib/supabase/types";

function channel() {
  const api = {
    on: () => api,
    subscribe: () => api,
    unsubscribe: async () => "ok",
  };
  return api;
}

/** In-memory stand-in. It never calls the network. */
export function createDemoSupabase(): SupabaseClient<Database> {
  const user = getDemoUser();
  const client = {
    from: (table: string) => getDemoDb().from(table),
    rpc: (name: string, args?: Record<string, unknown>) => getDemoDb().rpc(name, args ?? {}),
    channel,
    removeChannel: async () => "ok",
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      getClaims: async () => ({ data: { claims: { sub: DEMO_USER_ID, role: "demo" } }, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      admin: {
        getUserById: async () => ({ data: { user }, error: null }),
      },
    },
  };
  return client as unknown as SupabaseClient<Database>;
}

export const demoSupabaseEnabled = DEMO_BUILD;
