// Server-side Supabase client with the service role / secret key — bypasses RLS.
// Use only in server functions and server routes. For user-authenticated
// queries (with RLS), use the auth middleware instead.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createDemoSupabase } from "@/lib/demoSupabase";
import { DEMO_BUILD } from "@/lib/demoMode";
import type { Database } from "./types";
import { createSupabaseFetch, isNewSupabaseApiKey } from "./fetch";

type AdminKeyKind = "jwt_service_role" | "sb_secret" | "sb_publishable" | "jwt_anon" | "unknown";

/** Trim, strip wrapping quotes, and collapse whitespace from dashboard-pasted secrets. */
function readServerEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const trimmed = raw
    .trim()
    .replace(/^["']|["']$/g, "")
    // Dashboards / secret managers sometimes insert newlines mid-paste.
    .replace(/[\r\n\s]+/g, "");
  return trimmed || undefined;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (part.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function projectRefFromSupabaseUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const match = /^([a-z0-9]+)\.supabase\.co$/i.exec(host);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function keyKind(key: string): AdminKeyKind {
  if (key.startsWith("sb_secret_")) return "sb_secret";
  if (key.startsWith("sb_publishable_")) return "sb_publishable";
  if (key.startsWith("eyJ")) {
    const payload = decodeJwtPayload(key);
    const role = typeof payload?.["role"] === "string" ? payload["role"] : undefined;
    if (role === "service_role") return "jwt_service_role";
    if (role === "anon" || role === "authenticated") return "jwt_anon";
    return "unknown";
  }
  return "unknown";
}

function resolveAdminCredentials(): { url: string; key: string; kind: AdminKeyKind } {
  const url = readServerEnv("SUPABASE_URL") ?? readServerEnv("VITE_SUPABASE_URL");
  const key =
    readServerEnv("SUPABASE_SERVICE_ROLE_KEY") ??
    // New Dashboard naming (Settings → API Keys → secret).
    readServerEnv("SUPABASE_SECRET_KEY");

  const publishable =
    readServerEnv("SUPABASE_PUBLISHABLE_KEY") ??
    readServerEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ??
    readServerEnv("SUPABASE_ANON_KEY") ??
    readServerEnv("VITE_SUPABASE_ANON_KEY");

  if (!url || !key) {
    const missing = [
      ...(!url ? ["SUPABASE_URL"] : []),
      ...(!key ? ["SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)"] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Set them in .env (see .env.example).`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  const kind = keyKind(key);

  if (kind === "sb_publishable") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is a publishable key (sb_publishable_…). Use the service_role JWT or sb_secret_ key from Settings → API Keys.",
    );
  }

  if (kind === "jwt_anon") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is an anon/authenticated JWT. Paste the service_role key (role: service_role) or sb_secret_ from the Supabase dashboard.",
    );
  }

  if (kind === "unknown") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not a recognized admin credential. Expected a service_role JWT (eyJ…, role service_role) or sb_secret_… matching SUPABASE_URL.",
    );
  }

  if (publishable && key === publishable) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY matches the publishable/anon key. Admin Auth (createUser) requires the service_role / secret key.",
    );
  }

  // Legacy JWTs embed the project ref — reject cross-project URL/key pairs early
  // (GoTrue surfaces this as AuthApiError: Unregistered API key).
  if (kind === "jwt_service_role") {
    const urlRef = projectRefFromSupabaseUrl(url);
    const payload = decodeJwtPayload(key);
    const keyRef = typeof payload?.["ref"] === "string" ? payload["ref"] : null;
    if (urlRef && keyRef && urlRef !== keyRef) {
      throw new Error(
        `SUPABASE_SERVICE_ROLE_KEY is for project "${keyRef}" but SUPABASE_URL points at "${urlRef}". Copy the service_role key from the same project as SUPABASE_URL.`,
      );
    }
  }

  return { url, key, kind };
}

async function verifyAdminKeyAgainstAuth(url: string, key: string): Promise<void> {
  const base = url.replace(/\/$/, "");
  const headers: Record<string, string> = {
    apikey: key,
    Accept: "application/json",
  };
  // Mirror createSupabaseFetch: JWT service_role needs Bearer; opaque sb_secret_ must not.
  if (!isNewSupabaseApiKey(key)) {
    headers.Authorization = `Bearer ${key}`;
  }

  let res: Response;
  try {
    res = await fetch(`${base}/auth/v1/admin/users?page=1&per_page=1`, {
      method: "GET",
      headers,
    });
  } catch (error) {
    throw new Error(
      `Could not reach Supabase Auth Admin at ${new URL(url).host}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (res.ok || res.status === 404) {
    // 404 can occur on some GoTrue builds for empty lists; key was accepted.
    return;
  }

  if (res.status === 401 || res.status === 403) {
    const body = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(
      `Supabase Auth Admin rejected SUPABASE_SERVICE_ROLE_KEY (${res.status} Unregistered/unauthorized). ` +
        `Use Dashboard → Settings → API Keys → service_role (eyJ…) or secret (sb_secret_…) from the same project as SUPABASE_URL (${new URL(url).host}). ` +
        `Do not use the anon/publishable key.${body ? ` Response: ${body}` : ""}`,
    );
  }

  // Other statuses (5xx, etc.) — don't block OAuth; createUser will surface the real error.
  console.warn("[Supabase] Auth Admin probe unexpected status", {
    status: res.status,
    host: new URL(url).host,
  });
}

function createSupabaseAdminClient(): SupabaseClient<Database> {
  if (DEMO_BUILD) return createDemoSupabase();
  const { url, key, kind } = resolveAdminCredentials();

  console.info("[Supabase] admin client init", {
    urlHost: new URL(url).host,
    keyKind: kind,
    keyLength: key.length,
    // Never log the key — only enough to confirm the right env var was read.
    keyHint: `${key.slice(0, 8)}…${key.slice(-4)}`,
    urlRef: projectRefFromSupabaseUrl(url),
  });

  return createClient<Database>(url, key, {
    global: {
      // Auth Admin needs the service credential on `apikey` (and Bearer for legacy JWTs).
      fetch: createSupabaseFetch(key),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

let _supabaseAdmin: SupabaseClient<Database> | undefined;
let _adminKeyVerified = false;

// SECURITY: never expose this client to browser code.
// Load inside server handlers: const { supabaseAdmin } = await import("@/lib/supabase/client.server");
// Top-level import is safe only in other *.server.ts modules — route files and *.functions.ts ship to the client bundle.
export const supabaseAdmin = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});

/**
 * Fail closed when the admin key is missing, publishable/anon, or from another project.
 * Probes Auth Admin once so Kick/Twitch OAuth get a clear error before createUser.
 */
export async function assertSupabaseAdminConfigured(): Promise<void> {
  if (DEMO_BUILD) return;
  const { url, key } = resolveAdminCredentials();
  if (_adminKeyVerified) return;
  await verifyAdminKeyAgainstAuth(url, key);
  _adminKeyVerified = true;
}
