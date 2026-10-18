import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

export type ChatSources = {
  twitchChannel: string | null;
  kickChatroomId: string | null;
  /** Kick channel slug, used for channel-specific subscriber badge artwork. */
  kickSlug: string | null;
};

/**
 * Public chat coordinates for a creator's Chat Box overlay: the Twitch login
 * used to join IRC, and the Kick chatroom id used by the Pusher gateway.
 * Only public identifiers are returned — never tokens.
 */
export async function resolveChatSources(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<ChatSources> {
  const { data } = await admin
    .from("platform_connections")
    .select("platform, username, metadata")
    .eq("user_id", userId)
    .eq("is_active", true);

  let twitchChannel: string | null = null;
  let kickChatroomId: string | null = null;
  let kickSlug: string | null = null;

  for (const row of data ?? []) {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    if (row.platform === "TWITCH") {
      // IRC JOIN requires the lowercase login; display names break channel joins.
      const loginCandidate =
        (typeof metadata["twitch_login"] === "string" && metadata["twitch_login"]) ||
        (typeof metadata["login"] === "string" && metadata["login"]) ||
        row.username;
      if (loginCandidate) {
        twitchChannel = loginCandidate.trim().replace(/^@/, "").toLowerCase();
      }
    }
    if (row.platform === "KICK") {
      const id = metadata["chatroom_id"];
      if (typeof id === "number" || typeof id === "string") kickChatroomId = String(id);
      if (row.username) kickSlug = row.username;
    }
  }

  // Kick doesn't hand out the chatroom id during OAuth, so resolve it once
  // from the public channel endpoint when it isn't cached in metadata.
  if (!kickChatroomId && kickSlug) {
    try {
      const response = await fetch(
        `https://kick.com/api/v2/channels/${encodeURIComponent(kickSlug.toLowerCase())}`,
        { headers: { accept: "application/json" } },
      );
      if (response.ok) {
        const payload = (await response.json()) as { chatroom?: { id?: number } };
        if (payload.chatroom?.id) kickChatroomId = String(payload.chatroom.id);
      }
    } catch {
      /* Kick blocks some edge egress; the overlay simply stays Twitch-only */
    }
  }

  return { twitchChannel, kickChatroomId, kickSlug };
}
