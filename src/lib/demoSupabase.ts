import "@/lib/demoGuard";

import type { SupabaseClient } from "@supabase/supabase-js";

import { DEMO_BUILD, DEMO_USER_ID, getDemoUser } from "@/lib/demoMode";
import type { Database } from "@/lib/supabase/types";

type DemoResult = { data: unknown; error: null; count: null };

function rowFor(table: string): Record<string, unknown> | null {
  if (table === "user_subscriptions") {
    return {
      user_id: DEMO_USER_ID,
      subscription_status: "active",
      expires_at: null,
      active_code: "DEMO",
      is_lifetime: true,
    };
  }
  if (table === "users") {
    return {
      id: DEMO_USER_ID,
      name: "DemoUser",
      email: "demo@cylixstudio.local",
      image: null,
      timezone: "UTC",
      default_platform: null,
    };
  }
  if (table === "studio_settings") return { key: "app_version", value: "demo" };
  return null;
}

function query(table: string) {
  const single = async (): Promise<DemoResult> => ({ data: rowFor(table), error: null, count: null });
  const many = async (): Promise<DemoResult> => ({
    data: table === "user_subscriptions" || table === "users" ? [rowFor(table)].filter(Boolean) : [],
    error: null,
    count: 0,
  });
  const builder: Record<string, unknown> = {
    then: (resolve: (value: DemoResult) => unknown, reject?: (reason: unknown) => unknown) => many().then(resolve, reject),
  };
  const chain = () => builder;
  for (const method of [
    "select",
    "insert",
    "update",
    "upsert",
    "delete",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "like",
    "ilike",
    "is",
    "in",
    "contains",
    "containedBy",
    "not",
    "or",
    "filter",
    "match",
    "order",
    "limit",
    "range",
    "abortSignal",
    "csv",
    "returns",
  ]) {
    builder[method] = chain;
  }
  builder["maybeSingle"] = single;
  builder["single"] = single;
  return builder;
}

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
    from: (table: string) => query(table),
    rpc: async () => ({ data: false, error: null }),
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
