// Read-only timings of the production public-commands query chain.
// Prints durations and counts only. Does not print secrets, user ids, or command text.
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const KEY = "creovixstudio";
const ORDER = ["KICK", "TWITCH", "YOUTUBE", "TIKTOK", "X"];
const AVATAR_KEYS = ["avatar_url", "profile_picture", "profile_pic", "image", "avatar", "thumbnail"];

function loadEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const name = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[name] = value;
  }
  return env;
}

function rank(platform) {
  const index = ORDER.indexOf(platform);
  return index === -1 ? ORDER.length : index;
}

function avatarFrom(metadata) {
  if (!metadata || typeof metadata !== "object") return "";
  for (const key of AVATAR_KEYS) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function preferredUsername(rows) {
  const ranked = [...rows].sort((a, b) => rank(a.platform) - rank(b.platform));
  for (const row of ranked) {
    const username = row.username?.trim();
    if (username) return username;
  }
  return "";
}

function avatarFromRows(rows) {
  const ranked = [...rows].sort((a, b) => rank(a.platform) - rank(b.platform));
  for (const row of ranked) {
    const url = avatarFrom(row.metadata);
    if (url) return url;
  }
  return "";
}

async function timed(run) {
  const started = performance.now();
  const result = await run();
  return { ms: Math.round((performance.now() - started) * 10) / 10, result };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
  return sorted[mid];
}

const env = loadEnv("E:/Store/Cylix/CylixStudio/.env");
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.log(JSON.stringify({ error: "missing supabase env" }));
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function currentOnce() {
  const stages = {};
  const find = await timed(() =>
    db
      .from("platform_connections")
      .select("user_id, platform, username")
      .eq("is_active", true)
      .ilike("username", KEY),
  );
  stages.findUserMs = find.ms;
  if (find.result.error) return { error: "find", stages };
  const matches = (find.result.data ?? []).filter(
    (row) => row.user_id && row.username?.trim().toLowerCase() === KEY,
  );
  matches.sort((a, b) => rank(a.platform) - rank(b.platform));
  const userId = matches[0]?.user_id ?? null;
  if (!userId) return { error: "no_user", stages, matchCount: matches.length };

  const wave2 = await timed(() =>
    Promise.all([
      db.from("platform_connections").select("platform, username, metadata").eq("user_id", userId).eq("is_active", true),
      db.from("link_in_bio_profiles").select("slug, display_name, avatar_url").eq("user_id", userId).maybeSingle(),
    ]),
  );
  stages.identityAndProfileMs = wave2.ms;
  const [identity, profile] = wave2.result;
  if (identity.error || profile.error) return { error: "identity", stages };

  const wave3 = await timed(() =>
    Promise.all([
      db.from("custom_chat_command_settings").select("default_prefix").eq("user_id", userId).maybeSingle(),
      db
        .from("custom_chat_commands")
        .select("name, prefix, response")
        .eq("user_id", userId)
        .eq("enabled", true)
        .order("name", { ascending: true }),
      db
        .from("message_timers")
        .select("message, interval_minutes, enabled")
        .eq("user_id", userId)
        .eq("enabled", true)
        .order("created_at", { ascending: true }),
    ]),
  );
  stages.commandsAndTimersMs = wave3.ms;
  const [settings, commands, timers] = wave3.result;
  if (settings.error || commands.error || timers.error) return { error: "lists", stages };

  const transform = await timed(async () => {
    const rows = identity.data ?? [];
    const username = preferredUsername(rows);
    const profileAvatar = typeof profile.data?.avatar_url === "string" ? profile.data.avatar_url.trim() : "";
    const commandCount = (commands.data ?? []).filter((row) => row.name?.trim() && row.response?.trim()).length;
    const timerCount = (timers.data ?? []).filter((row) => row.message?.trim()).length;
    return {
      displayName: username || profile.data?.display_name?.trim() || profile.data?.slug || KEY,
      hasAvatar: Boolean(avatarFromRows(rows) || profileAvatar),
      commandCount,
      timerCount,
      identityCount: rows.length,
    };
  });
  stages.transformMs = transform.ms;
  stages.totalMs = Math.round((stages.findUserMs + stages.identityAndProfileMs + stages.commandsAndTimersMs + stages.transformMs) * 10) / 10;
  return { stages, page: transform.result, matchCount: matches.length };
}

async function fewerRoundsOnce() {
  const stages = {};
  const find = await timed(() =>
    db
      .from("platform_connections")
      .select("user_id, platform, username, metadata")
      .eq("is_active", true)
      .ilike("username", KEY),
  );
  stages.findUserMs = find.ms;
  if (find.result.error) return { error: "find", stages };
  const matches = (find.result.data ?? []).filter(
    (row) => row.user_id && row.username?.trim().toLowerCase() === KEY,
  );
  matches.sort((a, b) => rank(a.platform) - rank(b.platform));
  const userId = matches[0]?.user_id ?? null;
  if (!userId) return { error: "no_user", stages };

  const username = preferredUsername(matches);
  const avatar = avatarFromRows(matches);
  let profileMs = 0;
  let profileRow = null;
  if (!username || !avatar) {
    const profile = await timed(() =>
      db.from("link_in_bio_profiles").select("slug, display_name, avatar_url").eq("user_id", userId).maybeSingle(),
    );
    profileMs = profile.ms;
    if (profile.result.error) return { error: "profile", stages };
    profileRow = profile.result.data;
  }
  stages.profileMs = profileMs;

  const wave2 = await timed(() =>
    Promise.all([
      db.from("custom_chat_command_settings").select("default_prefix").eq("user_id", userId).maybeSingle(),
      db
        .from("custom_chat_commands")
        .select("name, prefix, response")
        .eq("user_id", userId)
        .eq("enabled", true)
        .order("name", { ascending: true }),
      db
        .from("message_timers")
        .select("message, interval_minutes, enabled")
        .eq("user_id", userId)
        .eq("enabled", true)
        .order("created_at", { ascending: true }),
    ]),
  );
  stages.commandsAndTimersMs = wave2.ms;
  const [settings, commands, timers] = wave2.result;
  if (settings.error || commands.error || timers.error) return { error: "lists", stages };
  const transformStarted = performance.now();
  const profileAvatar = typeof profileRow?.avatar_url === "string" ? profileRow.avatar_url.trim() : "";
  const page = {
    displayName: username || profileRow?.display_name?.trim() || profileRow?.slug || KEY,
    hasAvatar: Boolean(avatar || profileAvatar),
    commandCount: (commands.data ?? []).filter((row) => row.name?.trim() && row.response?.trim()).length,
    timerCount: (timers.data ?? []).filter((row) => row.message?.trim()).length,
    skippedIdentity: true,
    skippedProfile: profileMs === 0,
  };
  stages.transformMs = Math.round((performance.now() - transformStarted) * 10) / 10;
  stages.totalMs = Math.round((stages.findUserMs + stages.profileMs + stages.commandsAndTimersMs + stages.transformMs) * 10) / 10;
  return { stages, page, matchCount: matches.length };
}

async function indexedControl(userId) {
  return timed(() =>
    db.from("platform_connections").select("platform").eq("user_id", userId).eq("is_active", true),
  );
}

const warmup = await currentOnce();
if (warmup.error) {
  console.log(JSON.stringify({ error: warmup.error, stages: warmup.stages }));
  process.exit(1);
}

const current = [];
const fewer = [];
for (let i = 0; i < 8; i += 1) {
  current.push(await currentOnce());
  fewer.push(await fewerRoundsOnce());
}

const controlUser = await db
  .from("platform_connections")
  .select("user_id")
  .eq("is_active", true)
  .ilike("username", KEY)
  .limit(1);
const controlId = controlUser.data?.[0]?.user_id;
const controls = [];
if (controlId) {
  for (let i = 0; i < 4; i += 1) {
    const row = await indexedControl(controlId);
    controls.push(row.ms);
  }
}

function pack(rows, key) {
  return {
    samples: rows.map((row) => row.stages?.[key] ?? null),
    median: median(rows.map((row) => row.stages?.[key] ?? 0)),
  };
}

const currentOk = current.every((row) => row.page);
const fewerOk = fewer.every((row) => row.page);
const same = fewerOk && currentOk && fewer.every((row, index) => {
  const before = current[index].page;
  return (
    row.page.commandCount === before.commandCount &&
    row.page.timerCount === before.timerCount &&
    row.page.displayName === before.displayName &&
    row.page.hasAvatar === before.hasAvatar
  );
});

console.log(
  JSON.stringify(
    {
      target: KEY,
      repeats: 8,
      queryWavesBefore: 3,
      queriesBefore: 6,
      current: {
        findUser: pack(current, "findUserMs"),
        identityAndProfile: pack(current, "identityAndProfileMs"),
        commandsAndTimers: pack(current, "commandsAndTimersMs"),
        transform: pack(current, "transformMs"),
        total: pack(current, "totalMs"),
        commandCount: current[0]?.page?.commandCount ?? null,
        timerCount: current[0]?.page?.timerCount ?? null,
        identityCount: current[0]?.page?.identityCount ?? null,
        matchCount: current[0]?.matchCount ?? null,
      },
      fewerRounds: {
        findUser: pack(fewer, "findUserMs"),
        profile: pack(fewer, "profileMs"),
        commandsAndTimers: pack(fewer, "commandsAndTimersMs"),
        transform: pack(fewer, "transformMs"),
        total: pack(fewer, "totalMs"),
        skippedProfile: fewer[0]?.page?.skippedProfile ?? null,
      },
      samePublicResult: same,
      indexedUserIdLookupMedianMs: controls.length ? median(controls) : null,
      note: "Times are from this machine to production Supabase over PostgREST. Not Worker CPU. Not the browser TTFB.",
    },
    null,
    2,
  ),
);
