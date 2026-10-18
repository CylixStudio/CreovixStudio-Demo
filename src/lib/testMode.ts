import type { User } from "@supabase/supabase-js";

export const TEST_MODE_KEY = "creovix:test-mode";

export const TEST_USER_ID = "00000000-0000-4000-a000-000000000001";

export function isTestMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(TEST_MODE_KEY) === "1";
}

export function enableTestMode(): void {
  window.localStorage.setItem(TEST_MODE_KEY, "1");
}

export function disableTestMode(): void {
  window.localStorage.removeItem(TEST_MODE_KEY);
}

export function getTestUser(): User {
  const now = new Date().toISOString();
  return {
    id: TEST_USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: "test@creovixstudio.local",
    email_confirmed_at: now,
    phone: "",
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: { provider: "test", providers: ["test"] },
    user_metadata: { name: "Test User", full_name: "Test User" },
    identities: [],
    created_at: now,
    updated_at: now,
    is_anonymous: false,
  };
}
