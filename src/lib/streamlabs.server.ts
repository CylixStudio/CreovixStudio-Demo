import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Streamlabs Socket API tokens are long opaque strings issued from
 * Streamlabs -> Settings -> API Settings -> API Tokens -> Socket API Token.
 * They cannot be validated through a REST endpoint, so we validate shape and
 * confirm connectivity when the browser opens the socket.
 */
export const isLikelySocketToken = (token: string) =>
  token.length >= 40 && token.length <= 4000 && /^[A-Za-z0-9._-]+$/.test(token);

export const saveStreamlabsSocketConnection = async (
  supabase: SupabaseClient,
  userId: string,
  token: string,
) => {
  const { error } = await supabase.from("platform_connections").upsert(
    {
      user_id: userId,
      platform: "STREAMLABS",
      platform_user_id: `socket_${userId}`,
      username: "Streamlabs (Socket API)",
      access_token: token,
      refresh_token: null,
      scopes: ["socket.token"],
      token_expires_at: null,
      is_active: true,
      metadata: { source: "socket_token" },
    },
    { onConflict: "user_id,platform,platform_user_id" },
  );
  if (error) throw new Error(error.message);
};
