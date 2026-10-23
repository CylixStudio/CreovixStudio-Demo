/**
 * Pro chat theme "Royal Compact". Settings live in `widgets.config` JSON
 * (`themeId` + `royalCompact`) so the public overlay and the editor share one shape.
 * Expired Pro falls back at read time; the stored object is left in place.
 */

import { parseChatConfig, type ChatLayout } from "@/lib/widgets";

export const ROYAL_COMPACT_THEME_ID = "royal-compact";

export const ROYAL_COMPACT_DEFAULTS = {
  showAvatar: true,
  density: "compact",
  fontSize: 14,
  bubbleOpacity: 88,
  messageGap: 7,
  avatarSize: 38,
} as const;

export type RoyalDensity = "compact" | "normal";

export type RoyalCompactSettings = {
  showAvatar: boolean;
  density: RoyalDensity;
  fontSize: number;
  bubbleOpacity: number;
  messageGap: number;
  avatarSize: number;
};

const AVATAR_KEYS = [
  "profile_picture",
  "profile_pic",
  "profilePic",
  "profileImageUrl",
  "profile_image_url",
  "avatar_url",
  "avatarUrl",
  "avatar",
  "image",
] as const;

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

function num(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function isRoyalCompactTheme(themeId: unknown): boolean {
  return themeId === ROYAL_COMPACT_THEME_ID;
}

/**
 * One layout decision for the editor, the preview, and the OBS renderer.
 * Speech Bubbles (`chatLayout: "bubble"`) wins over a leftover `themeId` of
 * `royal-compact`, so an old bubble save is not painted as Royal Compact.
 * Royal Compact stays on for every other saved `chatLayout` until the user
 * picks a different layout. Empty configs stay on glass.
 */
export function readChatPresentation(config: unknown): ChatLayout | typeof ROYAL_COMPACT_THEME_ID {
  const layout = parseChatConfig(config).chatLayout;
  if (layout === "bubble") return "bubble";
  if (isRoyalCompactTheme(readChatThemeId(config))) return ROYAL_COMPACT_THEME_ID;
  return layout;
}

export function chatUsesRoyalCompact(config: unknown): boolean {
  return readChatPresentation(config) === ROYAL_COMPACT_THEME_ID;
}

export function readChatThemeId(config: unknown): string {
  const themeId = asRecord(config)["themeId"];
  return typeof themeId === "string" ? themeId : "dark-glass";
}

export function parseRoyalCompactSettings(raw: unknown): RoyalCompactSettings {
  const source = asRecord(asRecord(raw)["royalCompact"]);
  const density: RoyalDensity = source["density"] === "normal" ? "normal" : "compact";
  return {
    showAvatar: bool(source["showAvatar"], ROYAL_COMPACT_DEFAULTS.showAvatar),
    density,
    fontSize: num(source["fontSize"], ROYAL_COMPACT_DEFAULTS.fontSize, 12, 28),
    bubbleOpacity: num(source["bubbleOpacity"], ROYAL_COMPACT_DEFAULTS.bubbleOpacity, 40, 100),
    messageGap: num(source["messageGap"], ROYAL_COMPACT_DEFAULTS.messageGap, 4, 20),
    avatarSize: num(source["avatarSize"], ROYAL_COMPACT_DEFAULTS.avatarSize, 24, 64),
  };
}

/** Shape written back into widget config. Defaults round-trip unchanged. */
export function royalCompactPayload(settings: RoyalCompactSettings): {
  themeId: typeof ROYAL_COMPACT_THEME_ID;
  royalCompact: RoyalCompactSettings;
} {
  return {
    themeId: ROYAL_COMPACT_THEME_ID,
    royalCompact: { ...settings },
  };
}

export type RoyalCompactLayout = {
  avatar: number;
  gap: number;
  padding: string;
  minHeight: number;
  radius: number;
  fontSize: number;
  badgeSize: number;
  messageGap: number;
  background: string;
  width: "fit-content";
  maxWidth: "100%";
  overflowX: "visible";
  whiteSpace: "normal";
  overflowWrap: "anywhere";
  animationMs: number;
  shadow: string;
  rowDirection: "ltr";
  textDirection: "auto";
  unicodeBidi: "plaintext";
};

export function royalCompactLayout(settings: RoyalCompactSettings): RoyalCompactLayout {
  const avatar = settings.showAvatar ? settings.avatarSize : 0;
  const gap = settings.showAvatar ? 10 : 0;
  const roomy = settings.density === "normal";
  return {
    avatar,
    gap,
    padding: roomy ? "9px 13px 9px 11px" : "6px 11px 6px 10px",
    minHeight: roomy ? 40 : 34,
    radius: 11,
    fontSize: settings.fontSize,
    badgeSize: Math.round(settings.fontSize * 1.12),
    messageGap: settings.messageGap,
    background: "transparent",
    width: "fit-content",
    maxWidth: "100%",
    overflowX: "visible",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    animationMs: 200,
    shadow: "none",
    rowDirection: "ltr",
    textDirection: "auto",
    unicodeBidi: "plaintext",
  };
}

/** Neutral translucent panel; user color belongs on the edge, not a glow. */
export function royalCompactFill(_userColor: string, bubbleOpacity: number): string {
  return `rgba(12, 12, 16, ${Math.min(1, Math.max(0.4, bubbleOpacity / 100))})`;
}

export function royalUserColor(
  color: string | null | undefined,
  badges: readonly string[],
): string {
  const supplied = color?.trim();
  if (supplied && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(supplied)) return supplied;
  const roles = new Set(badges.map((badge) => badge.toLowerCase().replace(/[\s-]+/g, "_")));
  if (roles.has("broadcaster") || roles.has("owner")) return "#E5C780";
  if (roles.has("moderator") || roles.has("mod")) return "#64D9B0";
  if (roles.has("vip")) return "#D9A0D4";
  if (roles.has("subscriber") || roles.has("founder") || roles.has("og")) return "#A8B6ED";
  return "#BEE1FC";
}

/** No badge row, no leftover gap, when badges are hidden or the payload has none. */
export function royalBadgeGap(showBadges: boolean, count: number): number {
  return showBadges && count > 0 ? 4 : 0;
}

export function dedupeChatBadgeKeys(badges: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const badge of badges) {
    if (typeof badge !== "string") continue;
    const trimmed = badge.trim();
    const key = trimmed.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^https:\/\//i.test(trimmed)) return null;
  return trimmed;
}

/** Real avatar URL already on a Kick, Twitch, or YouTube payload. Never invented. */
export function readChatAvatarUrl(source: unknown): string | null {
  if (!source || typeof source !== "object") return null;
  const root = source as Record<string, unknown>;
  const records = [root];
  for (const nested of ["user", "sender", "authorDetails", "identity"] as const) {
    const child = root[nested];
    if (child && typeof child === "object") records.push(child as Record<string, unknown>);
  }
  for (const record of records) {
    for (const key of AVATAR_KEYS) {
      const url = httpsUrl(record[key]);
      if (url) return url;
    }
  }
  return null;
}
