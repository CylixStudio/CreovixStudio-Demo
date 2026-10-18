import type React from "react";

import { normalizePlatform, type PlatformKey } from "./PlatformIcon";

/**
 * Canonical role-badge identities shared across Twitch, Kick and TikTok.
 * Raw provider badge keys are normalized into these before rendering, so a
 * Kick "og" and a Twitch "founder" both resolve to the founder coin.
 */
export type BadgeRole =
  | "broadcaster"
  | "staff"
  | "global-admin"
  | "global-moderator"
  | "moderator"
  | "sidekick"
  | "verified"
  | "vip"
  | "founder"
  | "subscriber"
  | "gifter"
  | "turbo"
  | "bits";

/** Render order: host -> mod/admin -> sub/vip -> extras. */
const ROLE_ORDER: Record<BadgeRole, number> = {
  broadcaster: 0,
  "global-admin": 1,
  staff: 2,
  "global-moderator": 3,
  moderator: 4,
  sidekick: 5,
  verified: 6,
  founder: 7,
  subscriber: 8,
  vip: 9,
  gifter: 10,
  turbo: 11,
  bits: 12,
};

const ROLE_ALIASES: Record<string, BadgeRole> = {
  broadcaster: "broadcaster",
  streamer: "broadcaster",
  owner: "broadcaster",
  host: "broadcaster",
  "channel-host": "broadcaster",
  creator: "broadcaster",
  staff: "staff",
  "kick-staff": "staff",
  admin: "global-admin",
  "global-admin": "global-admin",
  "global-moderator": "global-moderator",
  "global-mod": "global-moderator",
  moderator: "moderator",
  mod: "moderator",
  sidekick: "sidekick",
  verified: "verified",
  partner: "verified",
  vip: "vip",
  founder: "founder",
  og: "founder",
  subscriber: "subscriber",
  sub: "subscriber",
  subgifter: "gifter",
  "sub-gifter": "gifter",
  gifter: "gifter",
  "top-gifter": "gifter",
  "fan-club": "subscriber",
  fanclub: "subscriber",
  "team-member": "subscriber",
  turbo: "turbo",
  premium: "turbo",
  prime: "turbo",
  bits: "bits",
  "bits-leader": "bits",
  cheer: "bits",
  cheerer: "bits",
};

export function normalizeBadgeRole(badge: string): BadgeRole | null {
  const key = badge.trim().toLowerCase().replace(/[_\s]+/g, "-");
  return ROLE_ALIASES[key] ?? ROLE_ALIASES[key.split("-")[0] ?? ""] ?? null;
}

/** De-duplicates and orders raw provider badge keys into renderable roles. */
export function resolveBadgeRoles(badges: string[], limit = 3): BadgeRole[] {
  const roles = new Set<BadgeRole>();
  for (const badge of badges) {
    const role = normalizeBadgeRole(badge);
    if (role) roles.add(role);
  }
  return [...roles].sort((a, b) => ROLE_ORDER[a] - ROLE_ORDER[b]).slice(0, limit);
}

const LABEL: Record<BadgeRole, string> = {
  broadcaster: "Broadcaster",
  staff: "Staff",
  "global-admin": "Global Admin",
  "global-moderator": "Global Moderator",
  moderator: "Moderator",
  sidekick: "Sidekick",
  verified: "Verified",
  vip: "VIP",
  founder: "Founder",
  subscriber: "Subscriber",
  gifter: "Gifter",
  turbo: "Turbo",
  bits: "Bits",
};

/* ------------------------------------------------------------------ *
 * Kick — pixel-art marks drawn on a 16x16 grid (no anti-aliased curves)
 * ------------------------------------------------------------------ */

/** Builds pixel rects from a string map where each non-space char is a pixel. */
function pixels(rows: string[], colors: Record<string, string>) {
  const out: React.ReactElement[] = [];
  rows.forEach((row, y) => {
    [...row].forEach((char, x) => {
      const fill = colors[char];
      if (!fill) return;
      out.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />);
    });
  });
  return out;
}

const KICK_MIC = [
  "      ####      ",
  "     ######     ",
  "     ##..##     ",
  "     ##..##     ",
  "     ##..##     ",
  "     ##..##     ",
  "    ########    ",
  "   ##..##..##   ",
  "   ##......##   ",
  "    ########    ",
  "     ######     ",
  "       ##       ",
  "       ##       ",
  "    ########    ",
  "    ########    ",
  "                ",
];

const KICK_SWORD = [
  "           #### ",
  "          ##### ",
  "         ###### ",
  "        #####   ",
  "       #####    ",
  "      #####     ",
  "     #####      ",
  "    #####       ",
  "   #####        ",
  "  #### ###      ",
  " ###    ###     ",
  " ##  ##  ###    ",
  " #  ####  ##    ",
  "   ######       ",
  "    ####        ",
  "                ",
];

const KICK_K = [
  "                ",
  "  ##       ##   ",
  "  ##      ##    ",
  "  ##     ##     ",
  "  ##    ##      ",
  "  ##   ##       ",
  "  ##  ##        ",
  "  #####         ",
  "  #####         ",
  "  ##  ##        ",
  "  ##   ##       ",
  "  ##    ##      ",
  "  ##     ##     ",
  "  ##      ##    ",
  "  ##       ##   ",
  "                ",
];

const KICK_STAR = [
  "       ##       ",
  "       ##       ",
  "      ####      ",
  "      ####      ",
  "     ######     ",
  "  ############  ",
  " ############## ",
  "  ############  ",
  "     ######     ",
  "      ####      ",
  "      ####      ",
  "       ##       ",
  "       ##       ",
  "                ",
  "                ",
  "                ",
];

const KICK_CROWN = [
  "                ",
  " #           #  ",
  " ##         ##  ",
  " ##   ###   ##  ",
  " ##  #####  ##  ",
  " ## ####### ##  ",
  " ###########    ",
  " ############   ",
  " ############   ",
  " ############   ",
  " ############   ",
  " ############   ",
  "                ",
  " ############   ",
  " ############   ",
  "                ",
];

const KICK_CHECK = [
  "                ",
  "              # ",
  "             ## ",
  "            ### ",
  "           ###  ",
  "  #       ###   ",
  "  ##     ###    ",
  "   ##   ###     ",
  "    ## ###      ",
  "     #####      ",
  "      ###       ",
  "       #        ",
  "                ",
  "                ",
  "                ",
  "                ",
];

const KICK_ONE = [
  "                ",
  "       ###      ",
  "      ####      ",
  "     #####      ",
  "    ## ###      ",
  "       ###      ",
  "       ###      ",
  "       ###      ",
  "       ###      ",
  "       ###      ",
  "       ###      ",
  "    #########   ",
  "    #########   ",
  "                ",
  "                ",
  "                ",
];

const KICK_MASK = [
  "                ",
  "  ############  ",
  " ############## ",
  " ##..####..#### ",
  " #....##....### ",
  " ##..####..#### ",
  " ############## ",
  "  ############  ",
  "   ##########   ",
  "    ########    ",
  "     ######     ",
  "      ####      ",
  "       ##       ",
  "                ",
  "                ",
  "                ",
];

type KickArt = { rows: string[]; colors: Record<string, string> };

/** Kick pixel artwork per role, using Kick's official palette. */
function kickArt(role: BadgeRole): KickArt | null {
  switch (role) {
    case "broadcaster":
      return { rows: KICK_MIC, colors: { "#": "#C74BF7", ".": "#7B1FA2" } };
    case "moderator":
      return { rows: KICK_SWORD, colors: { "#": "#4FC3F7" } };
    case "global-moderator":
      return { rows: KICK_SWORD, colors: { "#": "#FF9425" } };
    case "global-admin":
      return { rows: KICK_K, colors: { "#": "#FF7A00" } };
    case "staff":
      return { rows: KICK_K, colors: { "#": "#53FC18" } };
    case "subscriber":
      return { rows: KICK_STAR, colors: { "#": "#53FC18" } };
    case "vip":
      return { rows: KICK_CROWN, colors: { "#": "#F5C518" } };
    case "verified":
      return { rows: KICK_CHECK, colors: { "#": "#0B0D12" } };
    case "founder":
      return { rows: KICK_ONE, colors: { "#": "#F5C518" } };
    case "sidekick":
      return { rows: KICK_MASK, colors: { "#": "#F2214B", ".": "#0B0D12" } };
    default:
      return null;
  }
}

/** Kick verified sits on a filled green plate; the rest are bare pixel marks. */
const KICK_PLATE: Partial<Record<BadgeRole, string>> = {
  verified: "#00E701",
};

function KickBadge({ role, box }: { role: BadgeRole; box: React.CSSProperties }) {
  const art = kickArt(role);
  if (!art) return null;
  const plate = KICK_PLATE[role];
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges" style={box} role="img" aria-label={LABEL[role]}>
      <title>{LABEL[role]}</title>
      {plate ? <rect x="0" y="0" width="16" height="16" rx="4" fill={plate} /> : null}
      {pixels(art.rows, art.colors)}
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Twitch — official badge plates (rounded square + white glyph)
 * ------------------------------------------------------------------ */

const TWITCH_PLATE: Partial<Record<BadgeRole, string>> = {
  broadcaster: "#E91916",
  moderator: "#00AD03",
  vip: "#E005B9",
  staff: "#6441A5",
  "global-admin": "#FAAF19",
  "global-moderator": "#006441",
  subscriber: "#6441A5",
  founder: "#AB6F1C",
  verified: "#1F69FF",
  turbo: "#6441A5",
  bits: "#8205B4",
  gifter: "#6441A5",
  sidekick: "#6441A5",
};

function twitchGlyph(role: BadgeRole) {
  const white = "#ffffff";
  switch (role) {
    case "broadcaster":
      // Camera
      return (
        <g fill={white}>
          <rect x="3.5" y="7" width="10" height="10" rx="2" />
          <path d="M14.8 10.6l4.2-2.6c.6-.4 1.3.05 1.3.75v6.5c0 .7-.7 1.15-1.3.75l-4.2-2.6v-2.8z" />
        </g>
      );
    case "moderator":
      // Sword
      return (
        <g fill={white}>
          <path d="M17.6 3.6l2.8 2.8-8.9 8.9-2.8-2.8 8.9-8.9z" />
          <path d="M7.5 13.7l2.8 2.8-1.4 1.4-2.8-2.8 1.4-1.4z" />
          <path d="M3.6 17.6l2.5-2.5 2.8 2.8-2.5 2.5-2.8-2.8z" />
        </g>
      );
    case "vip":
    case "bits":
      // Diamond / gemstone
      return (
        <g fill={white}>
          <path d="M12 3.6l8 6.2L12 20.4 4 9.8l8-6.2z" />
          <path d="M4 9.8h16" stroke="#ffffff" strokeOpacity="0" />
        </g>
      );
    case "subscriber":
      // Star
      return (
        <path
          fill={white}
          d="M12 3.4l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 17.2 6.7 20l1.1-6L3.4 9.8l6-.8L12 3.4z"
        />
      );
    case "turbo":
      // Lightning battery
      return <path fill={white} d="M13.2 3.2L6.4 13.4h4.3l-1 7.4 7.9-10.6h-4.5l1.1-7z" />;
    case "verified":
      return <path fill={white} d="M10.3 16.8l-4.2-4.2 1.8-1.8 2.4 2.4 5.8-5.8 1.8 1.8-7.6 7.6z" />;
    case "founder":
      return (
        <g fill={white}>
          <circle cx="12" cy="12" r="7.6" fillOpacity="0.28" />
          <path d="M13 6.4v11.2h-2.3V9.4l-2.1.9V7.8L11.8 6.4H13z" />
        </g>
      );
    case "gifter":
      return (
        <g fill={white}>
          <rect x="4.5" y="10" width="15" height="9.4" rx="1.2" />
          <rect x="3.6" y="6.6" width="16.8" height="3.6" rx="1.2" />
          <rect x="11" y="6.6" width="2" height="12.8" fillOpacity="0.5" />
        </g>
      );
    case "staff":
    case "global-admin":
    case "global-moderator":
    default:
      // Shield
      return <path fill={white} d="M12 3.2l7 2.6v6c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9v-6l7-2.6z" />;
  }
}

function TwitchBadge({ role, box }: { role: BadgeRole; box: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" style={box} role="img" aria-label={LABEL[role]}>
      <title>{LABEL[role]}</title>
      <rect x="0" y="0" width="24" height="24" rx="5" fill={TWITCH_PLATE[role] ?? "#9146FF"} />
      {twitchGlyph(role)}
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * TikTok — live host / moderator / gifter marks
 * ------------------------------------------------------------------ */

function TikTokBadge({ role, box }: { role: BadgeRole; box: React.CSSProperties }) {
  const gradientId = `tt-${role}`;
  return (
    <svg viewBox="0 0 24 24" style={box} role="img" aria-label={LABEL[role]}>
      <title>{LABEL[role]}</title>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#25F4EE" />
          <stop offset="100%" stopColor="#FE2C55" />
        </linearGradient>
      </defs>
      {role === "broadcaster" ? (
        <>
          <rect width="24" height="24" rx="5" fill="#FE2C55" />
          <g fill="#ffffff">
            <rect x="3.6" y="7" width="10" height="10" rx="2.2" />
            <path d="M14.8 10.6l4.2-2.6c.6-.4 1.4.05 1.4.75v6.5c0 .7-.8 1.15-1.4.75l-4.2-2.6v-2.8z" />
          </g>
        </>
      ) : role === "moderator" ? (
        <>
          <rect width="24" height="24" rx="5" fill="#0F8B8D" />
          <path
            fill="#25F4EE"
            d="M12 3.4l6.8 2.5v5.9c0 4.2-2.8 7.4-6.8 8.8-4-1.4-6.8-4.6-6.8-8.8V5.9L12 3.4z"
          />
          <path fill="#0B0D12" d="M11.1 15.1l-3-3 1.5-1.5 1.5 1.5 3.9-3.9 1.5 1.5-5.4 5.4z" />
        </>
      ) : (
        <>
          <rect width="24" height="24" rx="5" fill={`url(#${gradientId})`} />
          <g fill="#ffffff">
            <rect x="4.6" y="10" width="14.8" height="9.2" rx="1.4" />
            <rect x="3.7" y="6.6" width="16.6" height="3.6" rx="1.4" />
            <rect x="11" y="6.6" width="2" height="12.6" fillOpacity="0.5" />
            <path d="M8.5 6.4a2.1 2.1 0 1 1 3.2-2.5l.6.9-1.9.9c-.7.3-1.4.2-1.9-.7z" />
            <path d="M15.5 6.4a2.1 2.1 0 1 0-3.2-2.5l-.6.9 1.9.9c.7.3 1.4.2 1.9-.7z" />
          </g>
        </>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Platform-native role badge rendered as inline SVG artwork (never an emoji).
 * When a provider supplies real badge artwork — e.g. a Twitch channel
 * subscriber badge URL — it is rendered as an <img> at the same 18px box.
 */
export function RoleBadgeIcon({
  role,
  platform,
  size = 18,
  imageUrl,
  style,
}: {
  role: BadgeRole;
  platform: string;
  size?: number;
  /** Real provider badge artwork (e.g. Twitch subscriber badge image URL). */
  imageUrl?: string | null;
  style?: React.CSSProperties;
}) {
  const box: React.CSSProperties = {
    width: size,
    height: size,
    objectFit: "contain",
    display: "inline-block",
    verticalAlign: "middle",
    flexShrink: 0,
    marginInlineEnd: 4,
    ...style,
  };

  if (imageUrl) {
    return <img src={imageUrl} alt={LABEL[role]} title={LABEL[role]} style={box} />;
  }

  const key: PlatformKey | null = normalizePlatform(platform);
  if (key === "KICK") {
    const kick = <KickBadge role={role} box={box} />;
    if (kickArt(role)) return kick;
    return <TwitchBadge role={role} box={box} />;
  }
  if (key === "TIKTOK") return <TikTokBadge role={role} box={box} />;
  return <TwitchBadge role={role} box={box} />;
}
