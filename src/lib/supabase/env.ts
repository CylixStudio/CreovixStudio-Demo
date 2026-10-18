/**
 * Public Supabase credentials for the browser (and isomorphic code).
 *
 * Vite only inlines `import.meta.env.VITE_*` with **static** property access.
 * Bracket access like `import.meta.env["VITE_…"]` can prevent replacement, so
 * the client bundle ships without credentials and the login UI shows the
 * ".env.example" fallback even when the host dashboard has the vars set.
 *
 * On Vercel/Cloudflare we also accept the server-side names (`SUPABASE_URL`,
 * `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY`) via vite.config `define`
 * so either naming convention works at build time.
 */
function trimEnv(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function fromProcess(...keys: string[]): string {
  if (typeof process === "undefined" || !process.env) return "";
  for (const key of keys) {
    const value = trimEnv(process.env[key]);
    if (value) return value;
  }
  return "";
}

export function getPublicSupabaseEnv(): { url: string; key: string } | null {
  // Dot access — required for Vite static env replacement in the client bundle.
  const url =
    trimEnv(import.meta.env.VITE_SUPABASE_URL) ||
    fromProcess("VITE_SUPABASE_URL", "SUPABASE_URL");

  const key =
    trimEnv(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
    trimEnv(import.meta.env.VITE_SUPABASE_ANON_KEY) ||
    fromProcess(
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_PUBLISHABLE_KEY",
      "VITE_SUPABASE_ANON_KEY",
      "SUPABASE_ANON_KEY",
    );

  if (!url || !key) return null;
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return getPublicSupabaseEnv() !== null;
}
