/**
 * Built-in visual presets shared by every widget renderer and the editor's
 * "Choose theme" selector. The selected id is persisted inside the widget's
 * JSON config (`config.themeId`) so the OBS overlay picks it up live.
 */

import type { CSSProperties } from "react";

export type WidgetThemeId = "dark-glass" | "minimal" | "neon" | "retro";

export type WidgetThemePreset = {
  id: WidgetThemeId;
  emoji: string;
  label: string;
    hint: string;
    /** Swatch shown inside the selector card. */
  swatch: CSSProperties;
};

export const WIDGET_THEMES: WidgetThemePreset[] = [
  {
    id: "dark-glass",
    emoji: "🌌",
    label: "Dark Glass",
    hint: "Frosted dark panel, glowing border",
    swatch: {
      background: "rgba(15, 23, 42, 0.85)",
      border: "1px solid rgba(148, 163, 184, 0.35)",
      backdropFilter: "blur(12px)",
      color: "#FFFFFF",
    },
  },
  {
    id: "minimal",
    emoji: "👻",
    label: "Clean Minimalist",
    hint: "Fully transparent, bold text with shadow",
    swatch: {
      background: "transparent",
      border: "1px dashed rgba(255,255,255,0.25)",
      color: "#FFFFFF",
      textShadow: "0 2px 6px rgba(0,0,0,0.9)",
    },
  },
  {
    id: "neon",
    emoji: "⚡",
    label: "Neon Cyberpunk",
    hint: "Cyan & pink dual glow",
    swatch: {
      background: "rgba(8, 10, 24, 0.9)",
      border: "1px solid rgba(0,242,254,0.8)",
      boxShadow: "0 0 15px rgba(0,242,254,0.4), 0 0 22px rgba(255,0,168,0.25)",
      color: "#00F2FE",
    },
  },
  {
    id: "retro",
    emoji: "👾",
    label: "Retro 8-Bit Arcade",
    hint: "Pixel borders, blocky arcade look",
    swatch: {
      background: "#1A1030",
      border: "4px solid #F5D90A",
      color: "#F5D90A",
      fontFamily: "'Press Start 2P', monospace",
      imageRendering: "pixelated",
    },
  },
];

export function parseWidgetThemeId(_raw: unknown): WidgetThemeId {
  // CylixStudio Modern Dark Glass is the permanent, enforced overlay aesthetic.
  return "dark-glass";
}

export type ThemeSkin = {
  id: WidgetThemeId;
  /** Container decoration merged after the user's own colours. */
  surface: CSSProperties;
  /** Applied to text elements (usernames, values). */
  text: CSSProperties;
  /** Applied to badges / pills. */
  badge: CSSProperties;
  /** Font override, `null` keeps the widget's own font. */
  fontFamily: string | null;
  /** Panel alpha override in percent, `null` keeps the widget's own value. */
  backgroundOpacity: number | null;
  accentColor: string | null;
};

/** Google font backing the retro preset. */
export const WIDGET_THEME_FONT_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap";

export function widgetThemeSkin(id: WidgetThemeId): ThemeSkin {
  switch (id) {
    case "minimal":
      return {
        id,
        surface: { border: "none", boxShadow: "none", backdropFilter: "none" },
        text: { textShadow: "0 2px 6px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.9)" },
        badge: { background: "rgba(0,0,0,0.45)" },
        fontFamily: null,
        backgroundOpacity: 0,
        accentColor: null,
      };
    case "neon":
      return {
        id,
        surface: {
          border: "1px solid rgba(0,242,254,0.85)",
          boxShadow: "0 0 15px rgba(0,242,254,0.4), 0 0 28px rgba(255,0,168,0.28) inset",
          backdropFilter: "blur(10px)",
        },
        text: { textShadow: "0 0 10px rgba(0,242,254,0.65)" },
        badge: {
          background: "linear-gradient(90deg, rgba(0,242,254,0.9), rgba(255,0,168,0.9))",
          color: "#05060F",
        },
        fontFamily: null,
        backgroundOpacity: null,
        accentColor: "#00F2FE",
      };
    case "retro":
      return {
        id,
        surface: {
          border: "4px solid #F5D90A",
          borderRadius: 0,
          boxShadow: "6px 6px 0 rgba(0,0,0,0.85)",
          backdropFilter: "none",
        },
        text: { letterSpacing: "0.04em" },
        badge: { background: "#F5D90A", color: "#1A1030", borderRadius: 0 },
        fontFamily: "'Press Start 2P', 'JetBrains Mono', monospace",
        backgroundOpacity: 100,
        accentColor: null,
      };
    case "dark-glass":
    default:
      return {
        id: "dark-glass",
        surface: {
          border: "1px solid rgba(148,163,184,0.28)",
          boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
          backdropFilter: "blur(12px)",
        },
        text: {},
        badge: {},
        fontFamily: null,
        backgroundOpacity: null,
        accentColor: null,
      };
  }
}
