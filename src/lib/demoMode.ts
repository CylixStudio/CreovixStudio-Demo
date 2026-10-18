import type { User } from "@supabase/supabase-js";

/**
 * Hardcoded on in the CylixStudio-Demo folder only.
 * This is not an environment flag. The original app does not include this
 * constant, so deploying the original cannot turn demo mode on.
 */
export const DEMO_BUILD = true;

export const DEMO_USER_ID = "00000000-0000-4000-a000-0000000000d1";

export const DEMO_USERNAME = "DemoUser";

export const DEMO_PLAN = "Pro";

export const DEMO_ROLE = "Demo";

export function isDemoBuild(): boolean {
  return DEMO_BUILD;
}

export function isDemoToken(token: string | null | undefined): boolean {
  return typeof token === "string" && token.startsWith("demo-");
}

export function getDemoUser(): User {
  const now = new Date().toISOString();
  return {
    id: DEMO_USER_ID,
    aud: "authenticated",
    role: "demo",
    email: "demo@cylixstudio.local",
    email_confirmed_at: now,
    phone: "",
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: { provider: "demo", providers: ["demo"], role: DEMO_ROLE },
    user_metadata: {
      name: DEMO_USERNAME,
      full_name: DEMO_USERNAME,
      preferred_username: DEMO_USERNAME,
      role: DEMO_ROLE,
      plan: DEMO_PLAN,
    },
    identities: [],
    created_at: now,
    updated_at: now,
    is_anonymous: false,
  };
}
