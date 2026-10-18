import { createHmac, timingSafeEqual } from "crypto";

import { base64Url, cookie, linkSecret, readCookie, readOAuthEnv } from "@/lib/oauth.server";
import {
  isGateUsernameAllowed,
  isMarkStatus,
  kickChannelUrl,
  markGateCookieName,
  sanitizeKickUsername,
  type MarkPlaybackPayload,
  type StreamMark,
} from "@/lib/markPoints";
import { supabaseAdmin } from "@/lib/supabase/client.server";

export type SharedMarksPayload = {
  channelName: string;
  channelUrl: string | null;
  marks: StreamMark[];
};

type SettingsRow = {
  user_id: string;
  share_token: string;
  kick_username: string;
  cached_staff: string[] | null;
};

const GATE_TTL_SECONDS = 60 * 60 * 24 * 7;

/** Prefer dedicated secret; fall back to OAuth link / service role — never a public URL. */
function markGateSecret(): string {
  const secret =
    readOAuthEnv("MARK_SHARE_GATE_SECRET") ??
    readOAuthEnv("OAUTH_LINK_SECRET") ??
    readOAuthEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) {
    // linkSecret() throws with a clear message if both are missing.
    return linkSecret();
  }
  return secret;
}

/** Cookie value: v1.{username}.{exp}.{mac} — mac binds share_token so cookies are not portable. */
function signMarkGateValue(shareToken: string, username: string, ttlSeconds: number): string {
  const exp = Date.now() + ttlSeconds * 1000;
  const payload = `${shareToken}.${username}.${exp}`;
  const mac = base64Url(createHmac("sha256", markGateSecret()).update(payload).digest());
  return `v1.${username}.${exp}.${mac}`;
}

function verifyMarkGateValue(shareToken: string, raw: string | null): string | null {
  if (!raw) return null;
  const value = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();
  const parts = value.split(".");
  // Reject legacy unsigned username-only cookies (pre-HMAC).
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const [, username, expRaw, mac] = parts;
  if (!username || !expRaw || !mac) return null;
  if (Number(expRaw) < Date.now()) return null;
  let expected: string;
  try {
    expected = base64Url(
      createHmac("sha256", markGateSecret())
        .update(`${shareToken}.${username}.${expRaw}`)
        .digest(),
    );
  } catch {
    return null;
  }
  if (mac.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  return username;
}

async function loadSettings(token: string): Promise<SettingsRow | null> {
  if (!token) return null;
  const { data } = await supabaseAdmin
    .from("mark_point_settings")
    .select("user_id, share_token, kick_username, cached_staff")
    .eq("share_token", token)
    .maybeSingle();
  return data;
}

async function loadAllowlist(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("mark_point_allowlist")
    .select("username")
    .eq("user_id", userId);
  return (data ?? []).map((row) => row.username);
}

async function gateNames(settings: SettingsRow) {
  return {
    owner: settings.kick_username,
    allowlist: await loadAllowlist(settings.user_id),
    cachedStaff: settings.cached_staff ?? [],
  };
}

async function userIdFromBearer(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user?.id ?? null;
}

export async function authorizeMarkShare(
  request: Request,
  token: string,
): Promise<
  | { ok: true; userId: string; via: "owner" | "username" }
  | { ok: false; reason: "not_found" | "gate" }
> {
  const settings = await loadSettings(token);
  if (!settings) return { ok: false, reason: "not_found" };
  const ownerId = await userIdFromBearer(request);
  if (ownerId && ownerId === settings.user_id) {
    return { ok: true, userId: settings.user_id, via: "owner" };
  }
  const cookieName = markGateCookieName(token);
  const username = verifyMarkGateValue(token, readCookie(request, cookieName));
  if (username && isGateUsernameAllowed(username, await gateNames(settings))) {
    return { ok: true, userId: settings.user_id, via: "username" };
  }
  return { ok: false, reason: "gate" };
}

export async function unlockMarkShare(
  request: Request,
  token: string,
  rawUsername: string,
): Promise<{ ok: true; setCookie: string } | { ok: false; reason: "not_found" | "denied" }> {
  const settings = await loadSettings(token);
  if (!settings) return { ok: false, reason: "not_found" };
  const username = sanitizeKickUsername(rawUsername);
  if (!isGateUsernameAllowed(username, await gateNames(settings))) {
    return { ok: false, reason: "denied" };
  }
  const signed = encodeURIComponent(signMarkGateValue(token, username, GATE_TTL_SECONDS));
  return {
    ok: true,
    setCookie: cookie(request, markGateCookieName(token), signed, GATE_TTL_SECONDS),
  };
}

function mapSharedMark(row: {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  uptime_start_seconds: number | null;
  uptime_end_seconds: number | null;
  stream_started_at: string | null;
  offline: boolean;
  status: string;
  author: string;
  source: string;
  note: string;
  viewer_is_mod: boolean;
  created_at: string;
  updated_at: string;
}): StreamMark {
  const source =
    row.source === "TWITCH" || row.source === "STUDIO" || row.source === "KICK" ? row.source : "KICK";
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    uptimeStartSeconds: row.uptime_start_seconds,
    uptimeEndSeconds: row.uptime_end_seconds,
    streamStartedAt: row.stream_started_at,
    offline: row.offline,
    status: isMarkStatus(row.status) ? row.status : "pending",
    author: row.author,
    source,
    note: row.note,
    viewerIsMod: row.viewer_is_mod,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSharedMarks(userId: string, kickUsername: string): Promise<SharedMarksPayload> {
  const { data } = await supabaseAdmin
    .from("stream_marks")
    .select(
      "id, started_at, ended_at, duration_seconds, uptime_start_seconds, uptime_end_seconds, stream_started_at, offline, status, author, source, note, viewer_is_mod, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  return {
    channelName: kickUsername,
    channelUrl: kickChannelUrl(kickUsername),
    marks: (data ?? []).map(mapSharedMark),
  };
}

export async function sharedMarksForRequest(
  request: Request,
  token: string,
): Promise<SharedMarksPayload | { error: "not_found" | "gate" }> {
  const auth = await authorizeMarkShare(request, token);
  if (!auth.ok) return { error: auth.reason };
  const settings = await loadSettings(token);
  if (!settings) return { error: "not_found" };
  return listSharedMarks(settings.user_id, settings.kick_username);
}

export async function sharedMarkPlaybackForRequest(
  request: Request,
  token: string,
  markId: string,
): Promise<MarkPlaybackPayload | { error: "not_found" | "gate" }> {
  const auth = await authorizeMarkShare(request, token);
  if (!auth.ok) return { error: auth.reason };
  const settings = await loadSettings(token);
  if (!settings) return { error: "not_found" };
  const { data } = await supabaseAdmin
    .from("stream_marks")
    .select(
      "id, started_at, ended_at, duration_seconds, uptime_start_seconds, uptime_end_seconds, stream_started_at, offline, status, author, source, note, viewer_is_mod, created_at, updated_at",
    )
    .eq("user_id", settings.user_id)
    .eq("id", markId)
    .maybeSingle();
  if (!data) return { error: "not_found" };
  const mark = mapSharedMark(data);
  const { resolveKickMarkVod } = await import("@/lib/markPoints.server");
  const vod = await resolveKickMarkVod(settings.kick_username, mark);
  return {
    channelName: settings.kick_username,
    channelUrl: kickChannelUrl(settings.kick_username),
    mark,
    vod,
  };
}

export async function setSharedMarkStatus(
  request: Request,
  token: string,
  id: string,
  status: string,
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "gate" | "bad_status" }> {
  if (!isMarkStatus(status)) return { ok: false, reason: "bad_status" };
  const auth = await authorizeMarkShare(request, token);
  if (!auth.ok) return { ok: false, reason: auth.reason };
  const { error } = await supabaseAdmin
    .from("stream_marks")
    .update({ status })
    .eq("id", id)
    .eq("user_id", auth.userId);
  if (error) return { ok: false, reason: "not_found" };
  return { ok: true };
}

export async function rememberMarkStaff(userId: string, username: string) {
  const name = sanitizeKickUsername(username);
  if (!name) return;
  const { data } = await supabaseAdmin
    .from("mark_point_settings")
    .select("cached_staff")
    .eq("user_id", userId)
    .maybeSingle();
  const current = data?.cached_staff ?? [];
  if (current.some((row) => row.toLowerCase() === name.toLowerCase())) return;
  if (!data) {
    await supabaseAdmin.from("mark_point_settings").insert({
      user_id: userId,
      cached_staff: [name],
    });
    return;
  }
  await supabaseAdmin
    .from("mark_point_settings")
    .update({ cached_staff: [...current, name] })
    .eq("user_id", userId);
}

export { loadSettings as loadMarkShareSettingsRow };
