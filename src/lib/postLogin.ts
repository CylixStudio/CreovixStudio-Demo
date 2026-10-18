import { isDemoBuild } from "@/lib/demoMode";
import { isGatewayCompleted } from "@/lib/plans";
import { supabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isTestMode } from "@/lib/testMode";

/** Where to send the user after a successful sign-in. */
export type PostLoginTo = "/welcome" | "/dashboard" | "/settings";

export type PostLoginDestination = {
  to: PostLoginTo;
  search?: { setup?: "connections"; connected?: string };
};

type NavigateFn = (opts: {
  to: PostLoginTo;
  search?: { setup?: string; connected?: string };
  replace?: boolean;
}) => unknown;

/**
 * Decide the post-login route (client-only, after setSession):
 * 1. Gateway (plan / redeem) not finished → `/welcome`
 * 2. No active streaming connection with a token → `/settings` (Connections)
 * 3. Otherwise → `/dashboard`
 *
 * Never throws — callers use this only after the session already exists.
 */
export async function resolvePostLoginPath(): Promise<PostLoginDestination> {
  try {
    if (isDemoBuild()) return { to: "/dashboard" };
    if (!isGatewayCompleted()) {
      return { to: "/welcome" };
    }

    if (isTestMode()) {
      return { to: "/dashboard" };
    }

    if (!isSupabaseConfigured()) {
      return { to: "/welcome" };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { to: isGatewayCompleted() ? "/dashboard" : "/welcome" };
    }

    const hasConnection = await userHasActivePlatformConnection(user.id);
    if (!hasConnection) {
      return { to: "/settings", search: { setup: "connections" } };
    }

    return { to: "/dashboard" };
  } catch (err) {
    console.warn("[postLogin] resolve failed; gateway fallback", err);
    return { to: isGatewayCompleted() ? "/dashboard" : "/welcome" };
  }
}

export async function userHasActivePlatformConnection(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("platform_connections")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .not("access_token", "is", null)
      .limit(1);
    if (error) {
      console.warn("[postLogin] connection check failed", error.message);
      return true;
    }
    return (data?.length ?? 0) > 0;
  } catch (err) {
    console.warn("[postLogin] connection check threw", err);
    return true;
  }
}

/** Navigate after session is established. Never used to signal auth failure. */
export async function navigateAfterLogin(navigate: NavigateFn): Promise<void> {
  const dest = await resolvePostLoginPath();
  if (dest.to === "/settings") {
    await navigate({
      to: "/settings",
      search: dest.search ?? { setup: "connections" },
      replace: true,
    });
    return;
  }
  await navigate({ to: dest.to, replace: true });
}
