/**
 * Overlay theme contract shared by the customization panel, the live preview
 * and the public OBS browser-source page. Themes are persisted as JSON in
 * `overlays.theme`, so every read goes through `parseOverlayTheme` which
 * tolerates missing/legacy keys and always returns a complete theme.
 */

export type OverlayLayout = "island" | "cute_heart" | "circular_pomodoro" | "multi_ring_countdown" | "raw_digits";
export type OverlayAnimation = "none" | "pulse" | "flash" | "bounce";
export type OverlayTimeFormat = "dhms" | "hms" | "ms";

export type OverlayTheme = {
  layout: OverlayLayout;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  /** Background alpha in percent (0 = fully transparent panel). */
  backgroundOpacity: number;
  accentColor: string;
  animation: OverlayAnimation;
  label: string;
  showLabel: boolean;
  showStatus: boolean;
  showAddedPopups: boolean;
  /** Subscription/gift milestone used by the integrated goal-bar layout. */
  milestoneTarget: number;
  /** Digit grouping used by every layout. */
  timeFormat: OverlayTimeFormat;
  /** Strips the card/capsule background + borders for transparent OBS layering. */
  hideBackground: boolean;
};

export const DEFAULT_OVERLAY_THEME: OverlayTheme = {
  layout: "cute_heart",
  fontFamily: "'Space Grotesk', system-ui, sans-serif",
  fontSize: 72,
  textColor: "#FFFFFF",
  backgroundColor: "#0a0a0a",
  backgroundOpacity: 70,
  accentColor: "#7C3AED",
  animation: "pulse",
  label: "SUBATHON",
  showLabel: true,
  showStatus: false,
  showAddedPopups: true,
  milestoneTarget: 50,
  timeFormat: "hms",
  hideBackground: false,
};

export const OVERLAY_TIME_FORMATS: {
  value: OverlayTimeFormat;
  label: string;
  }[] = [
  { value: "dhms", label: "Days, Hours, Minutes, Seconds" },
  { value: "hms", label: "Hours, Minutes, Seconds" },
  { value: "ms", label: "Minutes, Seconds" },
];

/** Formats remaining seconds according to the overlay's selected time format. */
export function formatOverlayTime(totalSeconds: number, format: OverlayTimeFormat): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (format === "ms") {
    return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  }
  if (format === "dhms") {
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    return `${pad(days)}:${pad(hours)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export const OVERLAY_LAYOUTS: {
  value: OverlayLayout;
  label: string;
    hint: string;
}[] = [
  {
    value: "island",
    label: "Dynamic Island",
    hint: "Glossy black live capsule",
  },
  {
    value: "cute_heart",
    label: "Cute Heart",
    hint: "Dark capsule with a pink heart badge",
  },
  {
    value: "circular_pomodoro",
    label: "Circular Pomodoro",
    hint: "Circular progress ring with status accents",
  },
  {
    value: "multi_ring_countdown",
    label: "Multi-Ring Countdown",
    hint: "Four circular rings for days, hours, minutes and seconds",
  },
  {
    value: "raw_digits",
    label: "Raw Digits",
    hint: "Borderless transparent digits only",
  },
];

export const OVERLAY_ANIMATIONS: { value: OverlayAnimation; label: string }[] = [
  { value: "none", label: "None" },
  { value: "pulse", label: "Pulse" },
  { value: "flash", label: "Flash" },
  { value: "bounce", label: "Bounce" },
];

export const OVERLAY_FONTS: { label: string; value: string }[] = [
  { label: "Space Grotesk", value: "'Space Grotesk', system-ui, sans-serif" },
  { label: "Inter", value: "'Inter', system-ui, sans-serif" },
  { label: "Bebas Neue", value: "'Bebas Neue', Impact, sans-serif" },
  { label: "Orbitron", value: "'Orbitron', 'Space Grotesk', sans-serif" },
  { label: "JetBrains Mono", value: "'JetBrains Mono', ui-monospace, monospace" },
  { label: "System UI", value: "system-ui, -apple-system, sans-serif" },
];

/** Google Fonts stylesheet backing every option in `OVERLAY_FONTS`. */
export const OVERLAY_FONT_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@500;800&family=Press+Start+2P&family=Space+Grotesk:wght@500;700&display=swap";

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function hex(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX.test(value.trim()) ? value.trim() : fallback;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function parseOverlayTheme(raw: unknown): OverlayTheme {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_OVERLAY_THEME;
  const allowedLayouts = OVERLAY_LAYOUTS.map((entry) => entry.value);
  const rawLayout = source['layout'];
  const layout: OverlayLayout =
    typeof rawLayout === "string" && allowedLayouts.includes(rawLayout as OverlayLayout)
      ? (rawLayout as OverlayLayout)
      : d.layout;
  const fontFamily =
    typeof source['fontFamily'] === "string" && source['fontFamily'].trim().length > 0
      ? source['fontFamily']
      : // legacy seed shape: { font: "Space Grotesk" }
        (OVERLAY_FONTS.find((entry) => entry.label === source['font'])?.value ?? d.fontFamily);

  return {
    layout,
    fontFamily,
    fontSize: num(source['fontSize'], d.fontSize, 16, 220),
    textColor: hex(source['textColor'], d.textColor),
    backgroundColor: hex(source['backgroundColor'], d.backgroundColor),
    backgroundOpacity: num(source['backgroundOpacity'], d.backgroundOpacity, 0, 100),
    accentColor: hex(source['accent'] ?? source['accentColor'], d.accentColor),
    animation: oneOf(
      source['animation'],
      OVERLAY_ANIMATIONS.map((entry) => entry.value),
      d.animation,
    ),
    label: typeof source['label'] === "string" ? source['label'].slice(0, 40) : d.label,
    showLabel: bool(source['showLabel'], d.showLabel),
    showStatus: bool(source['showStatus'], d.showStatus),
    showAddedPopups: bool(source['showAddedPopups'], d.showAddedPopups),
    milestoneTarget: num(source['milestoneTarget'], d.milestoneTarget, 1, 100_000),
    timeFormat: oneOf(
      source['timeFormat'],
      OVERLAY_TIME_FORMATS.map((entry) => entry.value),
      d.timeFormat,
    ),
    hideBackground: bool(source['hideBackground'], d.hideBackground),
  };
}

/** `#RRGGBB` + percent alpha -> `rgba(...)`, usable directly in inline styles. */
export function withAlpha(hexColor: string, opacityPercent: number): string {
  const raw = hexColor.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((char) => char + char)
          .join("")
      : raw;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${Math.min(100, Math.max(0, opacityPercent)) / 100})`;
}
