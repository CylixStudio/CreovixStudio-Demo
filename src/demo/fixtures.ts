import { DEMO_USER_ID, DEMO_USERNAME } from "@/lib/demoMode";
import { defaultConfig } from "@/lib/widgetDefaults";
import { goalTypePreset } from "@/lib/goalTypes";
import { WIDGET_LABEL, type WidgetType } from "@/lib/widgets";
import type { DemoFile, DemoGoal, DemoWidget, DemoChatMessage } from "@/lib/demoState";
import type { DemoDb, DemoSnapshot, Row, RpcHandler } from "@/demo/db";

/** Deterministic, UUID-shaped ids so every page, widget and server function agrees. */
export function demoId(kind: number, n: number): string {
  return `00000000-0000-4000-b${String(kind).padStart(3, "0")}-${String(n).padStart(12, "0")}`;
}

export const DEMO_SUBATHON_ID = demoId(2, 1);
export const DEMO_MEMBER_NAMES = [
  "NovaKnight",
  "PixelFox",
  "LunaPlays",
  "ArcticWolf",
  "SaharaStar",
  "ByteBandit",
  "MangoMage",
  "NightOwl_",
  "TurboTaco",
  "OrbitOtter",
  "ZenPanda",
  "CometKid",
];

type WidgetSeed = { type: WidgetType; name?: string; goalType?: "DONATION" | "FOLLOWER" | "SUBSCRIBER" | "CUSTOM"; current?: number };

const WIDGET_SEEDS: WidgetSeed[] = [
  { type: "SUBATHON_TIMER" },
  { type: "GOAL_BAR", name: "Follower goal", goalType: "FOLLOWER", current: 850 },
  { type: "GOAL_BAR", name: "Subscriber goal", goalType: "SUBSCRIBER", current: 42 },
  { type: "GOAL_BAR", name: "Donation goal", goalType: "DONATION", current: 360 },
  { type: "KICKS_GOAL", current: 640 },
  { type: "CHAT_BOX" },
  { type: "SPIN_WHEEL" },
  { type: "EMOTE_RAIN" },
  { type: "CHAT_SPOTLIGHT" },
  { type: "STREAM_EVENTS_SCHEDULE" },
  { type: "VIEWER_COUNTER" },
  { type: "EVENT_LABELS" },
  { type: "POLL" },
  { type: "PREDICTION" },
];

export function demoWidgetToken(type: string, index = 0): string {
  return `demo-${type.toLowerCase().replace(/_/g, "-")}${index ? `-${index + 1}` : ""}`;
}

export function buildDemoWidgets(now: number): { widgets: DemoWidget[]; goals: DemoGoal[] } {
  const widgets: DemoWidget[] = [];
  const goals: DemoGoal[] = [];
  const seen = new Map<string, number>();
  WIDGET_SEEDS.forEach((seed, i) => {
    const n = seen.get(seed.type) ?? 0;
    seen.set(seed.type, n + 1);
    const id = demoId(3, i + 1);
    widgets.push({
      id,
      user_id: DEMO_USER_ID,
      name: seed.name ?? WIDGET_LABEL[seed.type],
      type: seed.type,
      config:
        seed.type === "KICKS_GOAL"
          ? { ...defaultConfig(seed.type), title: "Kicks Goal", target: 1000, current: seed.current ?? 640 }
          : defaultConfig(seed.type, seed.goalType),
      state: {},
      subathon_id: seed.type === "SUBATHON_TIMER" ? DEMO_SUBATHON_ID : null,
      public_token: demoWidgetToken(seed.type, n),
      is_enabled: true,
      created_at: new Date(now - (30 - i) * 86_400_000).toISOString(),
    });
    if (seed.type === "GOAL_BAR" || seed.type === "KICKS_GOAL") {
      const p =
        seed.type === "KICKS_GOAL"
          ? { title: "Kicks Goal", unit: "Kicks", target: 1000, previewCurrent: 640 }
          : goalTypePreset(seed.goalType);
      goals.push({
        id: demoId(4, i + 1),
        widget_id: id,
        user_id: DEMO_USER_ID,
        title: p.title,
        unit: p.unit,
        target_value: p.target,
        current_value: seed.current ?? p.previewCurrent,
      });
    }
  });
  return { widgets, goals };
}

function sampleChat(now: number): Record<string, DemoChatMessage[]> {
  const widget = demoWidgetToken("CHAT_BOX");
  const lines: Array<[string, string, "KICK" | "TWITCH"]> = [
    ["NovaKnight", "That clutch was insane!", "KICK"],
    ["LunaPlays", "Hello from Cairo 👋", "TWITCH"],
    ["PixelFox", "!points", "KICK"],
    ["SaharaStar", "مرحبا يا بطل، بث رائع", "KICK"],
    ["ByteBandit", "GG, that was clean", "TWITCH"],
  ];
  const colors = ["#bee1fc", "#f59e0b", "#22d3ee", "#a78bfa", "#34d399"];
  return {
    [widget]: lines.map(([author, text, platform], i) => ({
      id: `demo-msg-${i + 1}`,
      platform,
      author,
      color: colors[i % colors.length],
      badges: i === 0 ? ["subscriber"] : [],
      text,
      at: now - (lines.length - i) * 20_000,
    })),
  };
}

export function buildDemoFile(now = Date.now()): DemoFile {
  const { widgets, goals } = buildDemoWidgets(now);
  const frames: DemoFile["frames"] = {};
  const timer = widgets.find((w) => w.type === "SUBATHON_TIMER");
  if (timer) {
    const remainingMs = 12 * 3_600_000;
    frames[timer.id] = {
      status: "RUNNING",
      accumulatedSeconds: remainingMs / 1000,
      startedAt: new Date(now).toISOString(),
      pausedAt: null,
      expiresAt: new Date(now + remainingMs).toISOString(),
      totalAddedSeconds: 0,
      maxTimeSeconds: null,
      revision: now,
      remainingSeconds: remainingMs / 1000,
      remainingMs,
      endAtMs: now + remainingMs,
      serverTime: now,
      serverOffsetMs: 0,
    };
  }
  return { widgets, goals, messages: sampleChat(now), frames };
}

const iso = (ms: number) => new Date(ms).toISOString();

export function buildDemoSnapshot(now = Date.now()): DemoSnapshot {
  const DAY = 86_400_000;
  const HOUR = 3_600_000;
  const uid = DEMO_USER_ID;
  const { widgets, goals } = buildDemoWidgets(now);

  const activity: Array<[string, string, string, number, number | null, string | null, number]> = [
    ["KICK", "FOLLOW", "NovaKnight", 1, null, null, 4],
    ["TWITCH", "SUBSCRIPTION", "LunaPlays", 1, null, null, 12],
    ["KICK", "GIFT_SUB", "ArcticWolf", 5, null, null, 25],
    ["TWITCH", "BITS", "PixelFox", 500, null, "BITS", 40],
    ["KICK", "DONATION", "SaharaStar", 25, 25, "KICKS", 55],
    ["TWITCH", "RAID", "ByteBandit", 48, null, null, 80],
    ["KICK", "FOLLOW", "MangoMage", 1, null, null, 130],
    ["KICK", "SUBSCRIPTION", "NightOwl_", 1, null, null, 190],
    ["TWITCH", "FOLLOW", "TurboTaco", 1, null, null, 260],
    ["KICK", "GIFT_SUB", "OrbitOtter", 10, null, null, 340],
    ["TWITCH", "BITS", "ZenPanda", 100, null, "BITS", 420],
    ["KICK", "RAID", "CometKid", 31, null, null, 600],
  ];
  const events: Row[] = [];
  const targetEvents: Row[] = [];
  activity.forEach(([platform, type, actor, qty, amount, currency, minsAgo], i) => {
    const at = iso(now - minsAgo * 60_000);
    events.push({
      id: demoId(5, i + 1),
      subathon_id: DEMO_SUBATHON_ID,
      platform,
      event_type: type,
      actor_name: actor,
      actor_platform_id: `demo-${actor.toLowerCase()}`,
      amount: amount ?? qty,
      currency,
      quantity: qty,
      seconds_added: type === "FOLLOW" ? 30 : type === "SUBSCRIPTION" ? 300 : type === "GIFT_SUB" ? 300 * qty : 60,
      provider_event_id: `demo-event-${i + 1}`,
      raw_payload: { source: "demo-fixture" },
      processed_at: at,
      created_at: at,
    });
    targetEvents.push({
      id: demoId(6, i + 1),
      user_id: uid,
      platform,
      event_type: type,
      actor_name: actor,
      actor_platform_id: `demo-${actor.toLowerCase()}`,
      amount: amount ?? qty,
      currency,
      quantity: qty,
      provider_event_id: `demo-target-${i + 1}`,
      created_at: at,
    });
  });

  const slotTitles = [
    ["Morning Warmup", "Just Chatting", 10 * 60],
    ["Ranked Grind", "Valorant", 18 * 60],
    ["Community Night", "Mario Kart", 20 * 60],
    ["Late Night Co-op", "It Takes Two", 21 * 60],
    ["Viewer Games", "Fall Guys", 19 * 60],
    ["Chill & Chat", "Just Chatting", 17 * 60],
    ["Weekend Marathon", "Elden Ring", 15 * 60],
  ] as const;

  const commands: Array<[string, string, string]> = [
    ["discord", "Join the community: https://discord.gg/demo", "Everyone"],
    ["socials", "Find me everywhere: link.cylix.demo/demouser", "Everyone"],
    ["schedule", "Streams Mon–Sun, check the schedule page!", "Everyone"],
    ["lurk", "$(user) is now lurking. Enjoy the stream! 🌙", "Everyone"],
    ["so", "Go follow $(1) — they're awesome!", "Mod"],
    ["uptime", "$(channel) has been live for $(uptime).", "Everyone"],
  ];

  const links: Array<[string, string, string, boolean]> = [
    ["Watch on Kick", "https://kick.com/demouser", "kick", true],
    ["Twitch Channel", "https://twitch.tv/demouser", "twitch", false],
    ["YouTube Highlights", "https://youtube.com/@demouser", "youtube", false],
    ["Join the Discord", "https://discord.gg/demo", "discord", false],
    ["Follow on X", "https://x.com/demouser", "x", false],
    ["Instagram", "https://instagram.com/demouser", "instagram", false],
  ];

  return {
    users: [
      {
        id: uid,
        name: DEMO_USERNAME,
        email: "demo@cylixstudio.demo",
        image: null,
        timezone: "Africa/Cairo",
        default_platform: "KICK",
        created_at: iso(now - 90 * DAY),
        updated_at: iso(now),
      },
    ],
    user_subscriptions: [
      {
        user_id: uid,
        subscription_status: "active",
        expires_at: null,
        active_code: "DEMO",
        is_lifetime: true,
        created_at: iso(now - 90 * DAY),
        updated_at: iso(now),
      },
    ],
    studio_settings: [{ key: "app_version", value: "demo", created_at: iso(now), updated_at: iso(now) }],
    platform_connections: [
      {
        id: demoId(1, 1),
        user_id: uid,
        platform: "KICK",
        platform_user_id: "demo-kick-1001",
        username: "DemoUser",
        is_active: true,
        access_token: null,
        refresh_token: null,
        scopes: ["chat:read", "events:subscribe"],
        token_expires_at: null,
        metadata: { simulated: true },
        created_at: iso(now - 60 * DAY),
        updated_at: iso(now),
      },
      {
        id: demoId(1, 2),
        user_id: uid,
        platform: "TWITCH",
        platform_user_id: "demo-twitch-2002",
        username: "demouser_tv",
        is_active: true,
        access_token: null,
        refresh_token: null,
        scopes: ["chat:read", "channel:read:subscriptions"],
        token_expires_at: null,
        metadata: { simulated: true },
        created_at: iso(now - 55 * DAY),
        updated_at: iso(now),
      },
    ],
    custom_chat_commands: commands.map(([name, response, role], i) => ({
      id: demoId(7, i + 1),
      user_id: uid,
      name,
      prefix: "!",
      response,
      platforms: ["KICK", "TWITCH"],
      roles: role === "Mod" ? ["moderator", "broadcaster"] : ["everyone"],
      cooldown_seconds: 10,
      enabled: true,
      created_at: iso(now - (20 - i) * DAY),
      updated_at: iso(now - i * DAY),
    })),
    custom_chat_command_settings: [
      { user_id: uid, default_prefix: "!", created_at: iso(now - 20 * DAY), updated_at: iso(now) },
    ],
    default_chat_commands: [],
    chat_text_alerts: [
      {
        user_id: uid,
        alert_id: "follow",
        enabled: true,
        minimum: 1,
        template: "Thanks for the follow, {user}! 💙",
        created_at: iso(now - DAY),
        updated_at: iso(now - DAY),
      },
      {
        user_id: uid,
        alert_id: "subscription",
        enabled: true,
        minimum: 1,
        template: "{user} just subscribed! Welcome to the family 🎉",
        created_at: iso(now - DAY),
        updated_at: iso(now - DAY),
      },
    ],
    message_timers: [
      ["Don't forget to follow and join the Discord: discord.gg/demo", 15],
      ["Type !commands to see everything you can do in chat.", 25],
      ["Check the stream schedule at link.cylix.demo/demouser", 40],
    ].map(([message, mins], i) => ({
      id: demoId(8, i + 1),
      user_id: uid,
      message,
      interval_minutes: mins,
      platforms: ["KICK", "TWITCH"],
      enabled: true,
      last_sent_at: null,
      last_sent_slot: null,
      created_at: iso(now - 10 * DAY),
      updated_at: iso(now - DAY),
    })),
    widgets: widgets.map((w) => ({ ...w, updated_at: w.created_at })),
    goals,
    subathons: [
      {
        id: DEMO_SUBATHON_ID,
        user_id: uid,
        title: "Demo Subathon",
        slug: "demo-subathon",
        description: "A simulated subathon to try timers, rules and overlays.",
        initial_seconds: 7200,
        max_duration_seconds: 86_400,
        is_active: true,
        starts_at: iso(now - 2 * HOUR),
        ends_at: null,
        settings: {},
        created_at: iso(now - 3 * DAY),
        updated_at: iso(now),
      },
    ],
    timer_states: [
      {
        id: demoId(9, 1),
        subathon_id: DEMO_SUBATHON_ID,
        status: "PAUSED",
        remaining_seconds: 7200,
        total_added_seconds: 0,
        started_at: null,
        paused_at: iso(now),
        expires_at: null,
        last_tick_at: iso(now),
        created_at: iso(now - 3 * DAY),
        updated_at: iso(now),
      },
    ],
    rules: (
      [
        ["KICK", "FOLLOW", 30, 1],
        ["KICK", "SUBSCRIPTION", 300, 1],
        ["KICK", "GIFT_SUB", 300, 1],
        ["TWITCH", "FOLLOW", 30, 1],
        ["TWITCH", "SUBSCRIPTION", 300, 1],
        ["TWITCH", "BITS", 60, 100],
        ["TWITCH", "RAID", 120, 10],
      ] as const
    ).map(([platform, type, secs, unit], i) => ({
      id: demoId(10, i + 1),
      subathon_id: DEMO_SUBATHON_ID,
      widget_id: null,
      platform,
      event_type: type,
      seconds_per_unit: secs,
      unit_amount: unit,
      min_amount: 0,
      max_seconds_per_event: null,
      goal_increment: 1,
      priority: i,
      is_enabled: true,
      created_at: iso(now - 3 * DAY),
      updated_at: iso(now - 3 * DAY),
    })),
    overlays: [
      {
        id: demoId(11, 1),
        subathon_id: DEMO_SUBATHON_ID,
        name: "Main overlay",
        public_token: demoWidgetToken("SUBATHON_TIMER"),
        is_public: true,
        theme: {},
        created_at: iso(now - 3 * DAY),
        updated_at: iso(now - 3 * DAY),
      },
    ],
    events,
    target_events: [],
    loyalty_members: DEMO_MEMBER_NAMES.map((name, i) => ({
      id: demoId(12, i + 1),
      user_id: uid,
      display_name: name,
      points: Math.round(12_000 / (i + 1) + 150),
      level: Math.max(1, 12 - i),
      watch_seconds: Math.round(180_000 / (i + 1)) + 3_600,
      created_at: iso(now - (60 - i * 3) * DAY),
      updated_at: iso(now - i * HOUR),
    })),
    loyalty_shop_items: [
      ["Song Request", "Pick the next song on stream", 500, null],
      ["Shoutout", "Get a personal shoutout", 800, null],
      ["VIP Badge", "A shiny badge for a week", 2500, 10],
      ["Choose the Game", "Decide what we play next", 5000, 3],
      ["Cylix Hoodie", "Limited merch drop (demo item)", 20_000, 2],
    ].map(([name, description, cost, stock], i) => ({
      id: demoId(13, i + 1),
      user_id: uid,
      name,
      description,
      cost,
      stock,
      image_url: null,
      enabled: true,
      is_active: true,
      created_at: iso(now - 14 * DAY),
      updated_at: iso(now - 14 * DAY),
    })),
    loyalty_sales: [
      [0, "Song Request", 500, 3],
      [2, "Shoutout", 800, 9],
      [4, "VIP Badge", 2500, 26],
      [1, "Song Request", 500, 48],
    ].map(([m, item, points, hrs], i) => ({
      id: demoId(14, i + 1),
      user_id: uid,
      member_id: demoId(12, (m as number) + 1),
      item_name: item,
      points,
      created_at: iso(now - (hrs as number) * HOUR),
      updated_at: iso(now - (hrs as number) * HOUR),
    })),
    stream_marks: [
      ["NovaKnight", "Insane 1v4 clutch", 3],
      ["LunaPlays", "Funny chat moment", 5],
      ["ArcticWolf", "Boss fight win", 30],
      ["PixelFox", "Giveaway winner reaction", 52],
      ["SaharaStar", "Best play of the night", 75],
      ["ByteBandit", "Raid welcome", 99],
    ].map(([author, note, hrs], i) => ({
      id: demoId(15, i + 1),
      user_id: uid,
      author,
      note,
      offline: false,
      status: i % 3 === 0 ? "approved" : i % 3 === 1 ? "pending" : "approved",
      source: "chat",
      started_at: iso(now - (hrs as number) * HOUR),
      ended_at: iso(now - (hrs as number) * HOUR + 45_000),
      stream_started_at: iso(now - (hrs as number) * HOUR - 2 * HOUR),
      duration_seconds: 45,
      uptime_start_seconds: 7000 + i * 600,
      uptime_end_seconds: 7045 + i * 600,
      viewer_is_mod: i % 2 === 0,
      created_at: iso(now - (hrs as number) * HOUR),
      updated_at: iso(now - (hrs as number) * HOUR),
    })),
    mark_point_settings: [
      {
        user_id: uid,
        kick_username: "DemoUser",
        share_token: "demo-marks-share",
        cached_staff: ["ModMaya", "ModOmar"],
        created_at: iso(now - 20 * DAY),
        updated_at: iso(now),
      },
    ],
    mark_point_allowlist: ["ModMaya", "ModOmar"].map((username, i) => ({
      id: demoId(16, i + 1),
      user_id: uid,
      username,
      created_at: iso(now - 20 * DAY),
      updated_at: iso(now - 20 * DAY),
    })),
    stream_schedule_settings: [
      {
        user_id: uid,
        title: "DemoUser's Weekly Schedule",
        timezone: "Africa/Cairo",
        reminder_note: "All times shown in your local time. Subscribe so you never miss a stream!",
        share_token: "demo-schedule-share",
        created_at: iso(now - 20 * DAY),
        updated_at: iso(now),
      },
    ],
    stream_schedule_slots: slotTitles.map(([title, game, start], i) => ({
      id: demoId(17, i + 1),
      user_id: uid,
      title,
      game,
      notes: null,
      cover_url: null,
      weekday: i,
      start_minutes: start,
      duration_minutes: 180,
      occurs_on: null,
      enabled: true,
      created_at: iso(now - 20 * DAY),
      updated_at: iso(now - 20 * DAY),
    })),
    link_in_bio_profiles: [
      {
        user_id: uid,
        slug: "demouser",
        display_name: "DemoUser",
        bio: "Variety streamer • Kick & Twitch • Try every CylixStudio feature right here.",
        avatar_url: null,
        header_url: null,
        published: true,
        published_at: iso(now - 15 * DAY),
        setup_completed: true,
        username_changed_at: null,
        created_at: iso(now - 15 * DAY),
        updated_at: iso(now),
      },
    ],
    link_in_bio_links: links.map(([title, url, platform, featured], i) => ({
      id: demoId(18, i + 1),
      user_id: uid,
      title,
      url,
      platform,
      kind: "link",
      enabled: true,
      featured,
      sort_order: i,
      card_size: "inherit",
      col_span: featured ? 2 : 1,
      row_span: 1,
      grid_x: null,
      grid_y: null,
      gallery_images: [],
      created_at: iso(now - 15 * DAY),
      updated_at: iso(now - 15 * DAY),
    })),
    link_in_bio_themes: [
      {
        user_id: uid,
        glass_intensity: 45,
        hairline_borders: true,
        glow_strength: 35,
        gradient_style: "none",
        font_family: "manrope",
        font_custom_name: "",
        font_custom_href: "",
        palette_bg: "#0a0a0a",
        palette_fg: "#f5f5f5",
        palette_accent: "#bee1fc",
        palette_muted: "#a3a3a3",
        surface_style: "glass",
        layout: "bento",
        default_card_size: "m",
        ambient_enabled: false,
        ambient_preset: "none",
        schedule_enabled: true,
        widget_banner_url: "",
        countdown_enabled: false,
        countdown_label: "Going live",
        countdown_ends_at: null,
        bento_color_mode: "brand",
        bento_custom_fill: "#171717",
        bento_custom_accent: "#bee1fc",
        youtube_latest_enabled: true,
      },
    ],
    media_request_settings: [
      {
        id: demoId(19, 1),
        user_id: uid,
        overlay_token: "demo-media-request",
        mod_token: "demo-media-mod",
        display_mode: "VIDEO",
        player_layout: "VERTICAL_CARD",
        request_mode: "AUTO",
        require_approval: false,
        max_duration_seconds: 600,
        min_view_count: 0,
        volume: 60,
        keyword_blacklist: [],
        user_blacklist: [],
        kick_reward_id: null,
        created_at: iso(now - 10 * DAY),
        updated_at: iso(now),
      },
    ],
    media_requests: [
      ["Lofi Hip Hop Radio", "Lofi Girl", "dQw4w9WgXcQ", 215, "played", "NovaKnight", 90],
      ["Blinding Lights", "The Weeknd", "4NRXx6U8ABQ", 200, "queued", "LunaPlays", 8],
      ["Levitating", "Dua Lipa", "TUVcZfQe-Kw", 203, "queued", "PixelFox", 5],
      ["Sunflower", "Post Malone", "ApXoWvfEYVU", 158, "pending", "SaharaStar", 2],
    ].map(([title, artist, vid, dur, status, who, mins], i) => ({
      id: demoId(20, i + 1),
      user_id: uid,
      title,
      artist,
      youtube_url: `https://www.youtube.com/watch?v=${vid}`,
      youtube_video_id: vid,
      thumbnail_url: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
      duration_seconds: dur,
      status: status === "queued" && i === 1 ? "PLAYING" : String(status).toUpperCase(),
      requester_username: who,
      requester_platform_id: `demo-${String(who).toLowerCase()}`,
      requester_avatar_url: null,
      view_count: 1_000_000 * (i + 1),
      position: status === "queued" || status === "pending" ? i : null,
      approved_at: status === "pending" ? null : iso(now - (mins as number) * 60_000),
      played_at: status === "played" ? iso(now - (mins as number) * 60_000) : null,
      refunded_at: null,
      rejection_reason: null,
      reward_id: null,
      reward_redemption_id: null,
      provider_event_id: `demo-media-${i + 1}`,
      created_at: iso(now - (mins as number) * 60_000),
      updated_at: iso(now - (mins as number) * 60_000),
    })),
    media_playback_state: [
      {
        user_id: uid,
        current_request_id: demoId(20, 2),
        playback_status: "PLAYING",
        position_seconds: 0,
        revision: 1,
        started_at: iso(now),
        volume: 60,
        created_at: iso(now),
        updated_at: iso(now),
      },
    ],
    giveaway_settings: [
      {
        user_id: uid,
        keyword: "!join",
        is_open: true,
        overlay_token: "demo-giveaway",
        claim_seconds: 60,
        spin_duration: 8,
        sub_multiplier: 2,
        subs_only: false,
        draw_state: null,
        last_winner: null,
        created_at: iso(now - DAY),
        updated_at: iso(now),
      },
    ],
    giveaway_participants: DEMO_MEMBER_NAMES.slice(0, 8).map((username, i) => ({
      id: demoId(21, i + 1),
      user_id: uid,
      username,
      platform: i % 2 ? "TWITCH" : "KICK",
      entries: i % 3 === 0 ? 2 : 1,
      is_subscriber: i % 3 === 0,
      created_at: iso(now - (i + 1) * 5 * 60_000),
      updated_at: iso(now - (i + 1) * 5 * 60_000),
    })),
    audit_logs: [],
    user_roles: [],
  };
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

/** RPC stand-ins for the Postgres functions the app calls. */
export const DEMO_RPC: Record<string, RpcHandler> = {
  is_admin: () => false,
  generate_activation_code: () => "DEMO-CODE",
  redeem_activation_code: () => ({ ok: true }),
  revoke_activation_code: () => true,
  overlay_tiktok_tap_total: () => 0,
  overlay_tiktok_tappers: () => [],
  apply_goal_increment: (db: DemoDb, args: Row) => {
    const goal = db.rows("goals").find((g) => g.id === args.p_goal_id || g.widget_id === args.p_widget_id);
    if (!goal) return null;
    const next = { ...goal, current_value: num(goal.current_value) + num(args.p_amount ?? args.p_increment ?? 1) };
    db.put("goals", next, goal);
    return next.current_value;
  },
  apply_timer_seconds: (db: DemoDb, args: Row) => {
    const t = db.rows("timer_states").find((r) => r.subathon_id === args.p_subathon_id);
    if (!t) return null;
    const delta = num(args.p_seconds ?? args.p_delta);
    const next = {
      ...t,
      remaining_seconds: Math.max(0, num(t.remaining_seconds) + delta),
      total_added_seconds: num(t.total_added_seconds) + Math.max(0, delta),
    };
    db.put("timer_states", next, t);
    return next;
  },
  purchase_loyalty_item: (db: DemoDb, args: Row) => {
    const item = db.rows("loyalty_shop_items").find((r) => r.id === args.p_item_id);
    const member = db.rows("loyalty_members").find((r) => r.id === args.p_member_id);
    if (!item || !member) return { ok: false, error: "not_found" };
    if (num(member.points) < num(item.cost)) return { ok: false, error: "insufficient_points" };
    db.put("loyalty_members", { ...member, points: num(member.points) - num(item.cost) }, member);
    db.put("loyalty_sales", {
      user_id: item.user_id,
      member_id: member.id,
      item_name: item.name,
      points: item.cost,
    });
    return { ok: true };
  },
};
