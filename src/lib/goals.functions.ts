import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";
import { readOAuthEnv } from "@/lib/oauth.server";

/**
 * Reads the creator's live follower / subscriber count straight from the
 * connected Twitch or Kick account and writes it into the goal's CURRENT
 * value, so a follower goal never has to be filled in by hand.
 */
export const syncGoalFollowers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { widgetId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/lib/supabase/client.server");
    const { getTwitchAccessToken } = await import("@/lib/platformTokens.server");

    const { data: goal } = await supabaseAdmin
      .from("goals")
      .select("id, user_id, widget_id")
      .eq("widget_id", data.widgetId)
      .maybeSingle();
    if (!goal || goal.user_id !== context.userId) throw new Error("Goal not found");

    const { data: connections } = await supabaseAdmin
      .from("platform_connections")
      .select("platform, platform_user_id, username")
      .eq("user_id", context.userId)
      .eq("is_active", true);

    let total: number | null = null;
    let source: string | null = null;

    const twitch = connections?.find((row) => row.platform === "TWITCH");
    if (twitch?.platform_user_id) {
      const accessToken = await getTwitchAccessToken(context.userId);
      const clientId = readOAuthEnv("TWITCH_CLIENT_ID");
      if (accessToken && clientId) {
        const response = await fetch(
          `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${encodeURIComponent(twitch.platform_user_id)}&first=1`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Client-Id": clientId,
            },
          },
        );
        if (response.ok) {
          const payload = (await response.json()) as { total?: number };
          if (typeof payload.total === "number") {
            total = payload.total;
            source = "TWITCH";
          }
        }
      }
    }

    if (total === null) {
      const kick = connections?.find((row) => row.platform === "KICK");
      if (kick?.username) {
        const response = await fetch(
          `https://kick.com/api/v2/channels/${encodeURIComponent(kick.username)}`,
          { headers: { accept: "application/json" } },
        );
        if (response.ok) {
          const payload = (await response.json()) as { followers_count?: number };
          if (typeof payload.followers_count === "number") {
            total = payload.followers_count;
            source = "KICK";
          }
        }
      }
    }

    if (total === null) {
      throw new Error("No connected Twitch or Kick account returned a follower count");
    }

    const { error } = await supabaseAdmin
      .from("goals")
      .update({ current_value: total })
      .eq("id", goal.id);
    if (error) throw new Error(error.message);

    return { ok: true as const, total, source };
  });
