import { demoId } from "@/demo/fixtures";
import type { DemoSnapshot, Row } from "@/demo/db";

import { CHANNEL_A_ID, CHANNEL_B_ID } from "./fixtures";

/**
 * Per-channel demo datasets. "My Channel" uses the shared base fixtures; the two other channels
 * replace the content tables below so data never mixes between channels.
 */

const iso = (ms: number) => new Date(ms).toISOString();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Builds rows shaped like the first base row, with fresh ids and the given overrides. */
function rowsLike(base: Row[], kind: number, offset: number, overrides: Row[]): Row[] {
  const shape = base[0] ?? {};
  return overrides.map((override, i) => ({ ...shape, ...override, id: demoId(kind, offset + i + 1) }));
}

type Dataset = {
  displayName: string;
  commands: Array<[string, string]>;
  timers: Array<[string, number]>;
  members: Array<[string, number]>;
  shop: Array<[string, string, number]>;
  marks: Array<[string, string]>;
  slots: Array<[string, string, number, number]>;
  links: Array<[string, string, string]>;
  bio: string;
};

const DATASETS: Record<string, Dataset> = {
  [CHANNEL_A_ID]: {
    displayName: "Streamer A",
    commands: [
      ["hype", "LET'S GOOO! Drop a 🔥 in chat!"],
      ["gear", "PC specs live on novaplays.gg/gear"],
      ["rank", "Currently Diamond II — the grind continues."],
      ["clip", "Make a clip and post it in #clips on Discord."],
    ],
    timers: [
      ["Hydrate, stretch, and take care of yourself 💧", 20],
      ["New here? Say hi and tell us your favourite game!", 30],
    ],
    members: [
      ["NovaFan_01", 9_400],
      ["QuasarQueen", 7_200],
      ["PixelPilot", 5_100],
      ["RiftRunner", 3_800],
      ["GlitchGoat", 2_600],
      ["LavaLamp", 1_900],
      ["SkyLantern", 1_250],
      ["EchoEcho", 640],
    ],
    shop: [
      ["Pick my loadout", "Choose my next loadout", 1200, null],
      ["1v1 with Nova", "Play a custom game with me", 6000, 3],
      ["Name a character", "Name my next character", 3000, 5],
    ],
    marks: [
      ["NovaFan_01", "Triple kill on stream"],
      ["QuasarQueen", "Rage quit moment"],
      ["RiftRunner", "Perfect parry"],
    ],
    slots: [
      ["Ranked Night", "Valorant", 20 * 60, 0],
      ["Chill Chat", "Just Chatting", 17 * 60, 2],
      ["Viewer Lobby", "Rocket League", 19 * 60, 4],
    ],
    links: [
      ["Twitch", "https://twitch.tv/novaplays", "twitch"],
      ["YouTube", "https://youtube.com/@novaplays", "youtube"],
      ["Discord", "https://discord.gg/nova-demo", "discord"],
    ],
    bio: "Streamer A • Competitive FPS and late-night chat (demo channel).",
  },
  [CHANNEL_B_ID]: {
    displayName: "Streamer B",
    commands: [
      ["recipe", "Today's recipe is pinned on atlastv.example/recipes"],
      ["tip", "Tip of the day: taste as you go!"],
      ["kitchen", "Camera 2 is the overhead cam."],
    ],
    timers: [
      ["Follow for daily cooking streams 🍳", 25],
      ["Vote on tomorrow's menu with !menu", 45],
      ["Grab the printable recipe: atlastv.example/recipes", 60],
    ],
    members: [
      ["SousChefSam", 6_800],
      ["BakerBee", 4_700],
      ["SpiceGirl", 3_300],
      ["WokWizard", 2_150],
      ["PastaPrince", 980],
      ["DoughDan", 450],
    ],
    shop: [
      ["Recipe request", "I cook your suggested recipe", 2500, null],
      ["Apron shoutout", "Shoutout while wearing the apron", 900, null],
      ["Taste test", "I taste what you choose", 4000, 2],
      ["Cookbook (demo)", "Signed digital cookbook", 15_000, 1],
    ],
    marks: [
      ["SousChefSam", "Perfect flambé"],
      ["BakerBee", "Kitchen fire alarm"],
      ["SpiceGirl", "Knife skills"],
      ["WokWizard", "Surprise guest"],
    ],
    slots: [
      ["Sunday Brunch", "Cooking", 11 * 60, 6],
      ["Weeknight Dinner", "Cooking", 19 * 60, 1],
      ["Baking Lab", "Cooking", 18 * 60, 3],
      ["Q&A + Prep", "Just Chatting", 16 * 60, 5],
    ],
    links: [
      ["Kick", "https://kick.com/atlastv", "kick"],
      ["Instagram", "https://instagram.com/atlastv", "instagram"],
      ["Recipes", "https://atlastv.example/recipes", "website"],
      ["X", "https://x.com/atlastv", "x"],
    ],
    bio: "Streamer B • Cooking streams on Kick (demo channel).",
  },
};

const EVENT_KINDS: Array<[string, string, number]> = [
  ["KICK", "FOLLOW", 1],
  ["KICK", "SUBSCRIPTION", 1],
  ["TWITCH", "FOLLOW", 1],
  ["KICK", "GIFT_SUB", 3],
  ["TWITCH", "BITS", 300],
  ["KICK", "RAID", 22],
  ["KICK", "FOLLOW", 1],
  ["TWITCH", "SUBSCRIPTION", 1],
];

export function hasChannelDataset(channelId: string): boolean {
  return channelId in DATASETS;
}

/** Returns the base snapshot with the channel's own content tables swapped in. */
export function applyChannelDataset(base: DemoSnapshot, channelId: string, now = Date.now()): DemoSnapshot {
  const data = DATASETS[channelId];
  if (!data) return base;
  const offset = channelId === CHANNEL_A_ID ? 300 : 600;
  const out: DemoSnapshot = { ...base };

  out.users = (base.users ?? []).map((user) => ({ ...user, name: data.displayName }));
  out.custom_chat_commands = rowsLike(
    base.custom_chat_commands ?? [],
    7,
    offset,
    data.commands.map(([name, response], i) => ({ name, response, created_at: iso(now - (10 - i) * DAY), updated_at: iso(now - i * DAY) })),
  );
  out.message_timers = rowsLike(
    base.message_timers ?? [],
    8,
    offset,
    data.timers.map(([message, interval], i) => ({ message, interval_minutes: interval, created_at: iso(now - (8 - i) * DAY) })),
  );
  out.loyalty_members = rowsLike(
    base.loyalty_members ?? [],
    12,
    offset,
    data.members.map(([display_name, points], i) => ({
      display_name,
      points,
      level: Math.max(1, 9 - i),
      watch_seconds: Math.round(points * 18),
      created_at: iso(now - (40 - i * 3) * DAY),
    })),
  );
  out.loyalty_shop_items = rowsLike(
    base.loyalty_shop_items ?? [],
    13,
    offset,
    data.shop.map(([name, description, cost, stock]) => ({ name, description, cost, stock, enabled: true, is_active: true })),
  );
  out.loyalty_sales = rowsLike(
    base.loyalty_sales ?? [],
    14,
    offset,
    data.shop.slice(0, 3).map(([name, , cost], i) => ({
      item_name: name,
      points: cost,
      member_id: demoId(12, offset + i + 1),
      created_at: iso(now - (6 + i * 9) * HOUR),
    })),
  );
  out.stream_marks = rowsLike(
    base.stream_marks ?? [],
    15,
    offset,
    data.marks.map(([author, note], i) => ({
      author,
      note,
      status: i % 2 === 0 ? "approved" : "pending",
      started_at: iso(now - (4 + i * 20) * HOUR),
      ended_at: iso(now - (4 + i * 20) * HOUR + 45_000),
      created_at: iso(now - (4 + i * 20) * HOUR),
    })),
  );
  out.stream_schedule_slots = rowsLike(
    base.stream_schedule_slots ?? [],
    17,
    offset,
    data.slots.map(([title, game, start, weekday]) => ({ title, game, start_minutes: start, weekday })),
  );
  out.stream_schedule_settings = (base.stream_schedule_settings ?? []).map((row) => ({
    ...row,
    title: `${data.displayName}'s Schedule`,
  }));
  out.link_in_bio_profiles = (base.link_in_bio_profiles ?? []).map((row) => ({
    ...row,
    slug: channelId === CHANNEL_A_ID ? "novaplays" : "atlastv",
    display_name: data.displayName,
    bio: data.bio,
  }));
  out.link_in_bio_links = rowsLike(
    base.link_in_bio_links ?? [],
    18,
    offset,
    data.links.map(([title, url, platform], i) => ({ title, url, platform, featured: i === 0, sort_order: i, col_span: i === 0 ? 2 : 1 })),
  );
  out.mark_point_allowlist = [];
  out.events = rowsLike(
    base.events ?? [],
    5,
    offset,
    EVENT_KINDS.map(([platform, event_type, quantity], i) => ({
      platform,
      event_type,
      quantity,
      amount: quantity,
      actor_name: data.members[i % data.members.length]?.[0] ?? "Viewer",
      provider_event_id: `demo-${channelId}-${i + 1}`,
      created_at: iso(now - (i * 35 + 6) * 60_000),
      processed_at: iso(now - (i * 35 + 6) * 60_000),
    })),
  );
  out.goals = (base.goals ?? []).map((goal) => ({
    ...goal,
    current_value: Math.round(Number(goal.target_value ?? 100) * (channelId === CHANNEL_A_ID ? 0.82 : 0.35)),
  }));
  return out;
}
