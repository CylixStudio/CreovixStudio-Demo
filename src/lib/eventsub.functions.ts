import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

/**
 * Registers Twitch EventSub subscriptions (follow, subscribe, gift, resub message,
 * cheer, raid) against this app's verified webhook endpoint. Serverless runtimes
 * cannot hold an EventSub WebSocket open, so the webhook transport is the
 * production-correct listener; deliveries land in the same ingest pipeline.
 *
 * Also invoked automatically from the Twitch OAuth callback after connect.
 */
export const syncTwitchEventSub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { ensureTwitchEventSub } = await import("@/lib/twitchEventSub.server");

    const { data: connection } = await supabaseAdmin
      .from("platform_connections")
      .select("platform_user_id")
      .eq("user_id", context.userId)
      .eq("platform", "TWITCH")
      .eq("is_active", true)
      .maybeSingle();

    const broadcasterId = connection?.platform_user_id;
    if (!broadcasterId) return { ok: false as const, error: "twitch_not_connected" };

    const result = await ensureTwitchEventSub({
      broadcasterUserId: broadcasterId,
      request: getRequest(),
    });

    if (result.error && !result.ok) {
      return { ok: false as const, error: result.error };
    }
    return { ok: result.ok, created: result.created, results: result.results };
  });
