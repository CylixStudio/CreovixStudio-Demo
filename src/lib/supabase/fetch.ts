export function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

/**
 * Shared fetch wrapper so API keys are always sent as `apikey`.
 *
 * - Legacy JWT `service_role` / `anon`: also keep `Authorization: Bearer <jwt>`
 *   (GoTrue Admin verifies the JWT).
 * - New `sb_secret_` / `sb_publishable_`: send `apikey` only. Putting opaque
 *   secrets on `Authorization: Bearer` makes GoTrue try to parse them as JWTs
 *   (`bad_jwt` / `Unregistered API key` on admin routes).
 */
export function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    headers.set("apikey", supabaseKey);

    if (isNewSupabaseApiKey(supabaseKey)) {
      // Opaque keys must not ride on Authorization — strip any Bearer copy the SDK added.
      const auth = headers.get("Authorization");
      if (auth && (auth === `Bearer ${supabaseKey}` || auth.startsWith("Bearer sb_"))) {
        headers.delete("Authorization");
      }
    } else {
      // Legacy JWT service_role: ensure Bearer is present for Auth Admin.
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${supabaseKey}`);
      }
    }

    return fetch(input, { ...init, headers });
  };
}
