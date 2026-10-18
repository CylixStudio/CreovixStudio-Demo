import type { SupabaseClient } from "@supabase/supabase-js";

export type StreamElementsChannel = {
  id: string;
  username: string;
  avatar: string | null;
};

/** Removes an accidental `Bearer ` prefix and surrounding noise from a pasted token. */
export const normalizeJwt = (raw: string) =>
  raw.trim().replace(/^bearer\s+/i, "").replace(/^["']|["']$/g, "").trim();

const SE_ENDPOINTS = [
  "https://api.streamelements.com/kappa/v2/channels/me",
  "https://api.streamelements.com/v2/channels/me",
];

/** Validates a StreamElements account JWT against the live API. */
export const verifyStreamElementsToken = async (
  token: string,
): Promise<StreamElementsChannel | null> => {
  const jwt = normalizeJwt(token);
  if (!jwt) return null;

  for (const url of SE_ENDPOINTS) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: "application/json" },
    });
    if (!res.ok) continue;
    const json = (await res.json().catch(() => null)) as {
      _id?: string;
      username?: string;
      displayName?: string;
      avatar?: string;
      profile?: { avatar?: string };
    } | null;
    if (!json?._id) continue;
    return {
      id: json._id,
      username: json.displayName || json.username || `se_${json._id}`,
      avatar: json.avatar ?? json.profile?.avatar ?? null,
    };
  }
  return null;
};

export const saveStreamElementsConnection = async (
  supabase: SupabaseClient,
  userId: string,
  token: string,
  channel: StreamElementsChannel,
) => {
  const { error } = await supabase.from("platform_connections").upsert(
    {
      user_id: userId,
      platform: "STREAMELEMENTS",
      platform_user_id: channel.id,
      username: channel.username,
      access_token: token,
      refresh_token: null,
      scopes: ["channel:read", "tips:read", "activities:read"],
      token_expires_at: null,
      is_active: true,
      metadata: { source: "jwt_token", avatar_url: channel.avatar },
    },
    { onConflict: "user_id,platform,platform_user_id" },
  );
  if (error) throw new Error(error.message);
};
