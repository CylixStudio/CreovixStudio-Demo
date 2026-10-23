import { DEFAULT_STYLE, parseStyle, type BaseStyle } from "@/lib/widgets";

export const GIVEAWAY_ANIMATIONS = [
  { id: "carousel", en: "Avatar Carousel", ar: "شريط صور المشاركين" },
] as const;
export type GiveawayAnimation = (typeof GIVEAWAY_ANIMATIONS)[number]["id"];
export type GiveawayPresentation = {
  animation: GiveawayAnimation;
  speed: number;
  appearance?: BaseStyle;
};

export function parseGiveawayAppearance(raw: unknown): BaseStyle {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const style = parseStyle(source, {
    ...DEFAULT_STYLE,
    fontSize: 56,
    textColor: "#f4f4f5",
    backgroundColor: "#0c0e12",
    backgroundOpacity: 96,
    accentColor: "#bee1fc",
  });
  return { ...style, fontSize: Math.max(24, Math.min(80, style.fontSize)) };
}
export const DEFAULT_GIVEAWAY_PRESENTATION: GiveawayPresentation = {
  animation: "carousel",
  speed: 1,
};

export function parseGiveawayPresentation(raw: unknown): GiveawayPresentation {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    animation:
      GIVEAWAY_ANIMATIONS.find((entry) => entry.id === value["animation"])?.id ?? "carousel",
    speed:
      typeof value["speed"] === "number" && Number.isFinite(value["speed"])
        ? Math.min(2, Math.max(0.5, value["speed"]))
        : 1,
    ...(value["appearance"] &&
    typeof value["appearance"] === "object" &&
    !Array.isArray(value["appearance"])
      ? { appearance: parseGiveawayAppearance(value["appearance"]) }
      : {}),
  };
}

/** A persisted clock drives presentation only. Loading a completed draw never starts a new one. */
export function giveawayRevealProgress(
  startedAt: string | null | undefined,
  duration: number,
  now: number,
) {
  const start = startedAt ? Date.parse(startedAt) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) return 1;
  return Math.max(0, Math.min(1, (now - start) / (Math.max(1, duration) * 1000)));
}

export function giveawayAccountKey(account: { platform: string; username: string }) {
  return `${account.platform.toUpperCase()}:${account.username.toLowerCase()}`;
}

export function giveawayRevealSlot(
  count: number,
  selectedIndex: number,
  progress: number,
  speed: number,
) {
  if (!Number.isInteger(count) || count <= 0) return 0;
  const end = Math.max(1, Math.round(speed * 3)) * count + selectedIndex;
  return end * (1 - (1 - progress) ** 3);
}

/** Stable presentation order; the selected result is never inferred from an animation frame. */
export function giveawayRevealCandidates<T extends { platform: string; username: string }>(
  participants: T[],
  winner: T | null,
  limit = 12,
): T[] {
  const unique = [...new Map(participants.map((p) => [giveawayAccountKey(p), p])).values()];
  const result = unique.slice(0, limit);
  if (winner && !result.some((p) => giveawayAccountKey(p) === giveawayAccountKey(winner))) {
    return [...result.slice(0, limit - 1), winner];
  }
  return result;
}
