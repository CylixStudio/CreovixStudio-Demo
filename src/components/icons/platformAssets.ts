import type { CSSProperties } from "react";
import { createElement } from "react";

import discordPrimary from "@/assets/icons/Discord/Primary.svg";
import discordWhite from "@/assets/icons/Discord/White.svg";
import discordBlack from "@/assets/icons/Discord/Black.svg";
import instagramPrimary from "@/assets/icons/Instagram/Primary.svg";
import instagramWhite from "@/assets/icons/Instagram/White.svg";
import instagramBlack from "@/assets/icons/Instagram/Black.svg";
import kickPrimary from "@/assets/icons/Kick/Primary.svg";
import kickWhite from "@/assets/icons/Kick/White.svg";
import kickBlack from "@/assets/icons/Kick/Black.svg";
import linkPrimary from "@/assets/icons/Link/Primary.svg";
import linkWhite from "@/assets/icons/Link/White.svg";
import linkBlack from "@/assets/icons/Link/Black.svg";
import snapchatPrimary from "@/assets/icons/SnapChat/Primary.svg";
import snapchatWhite from "@/assets/icons/SnapChat/White.svg";
import snapchatBlack from "@/assets/icons/SnapChat/Black.svg";
import soundCloudPrimary from "@/assets/icons/SoundCloud/Primary.svg";
import spotifyPrimary from "@/assets/icons/Spotify/Primary.svg";
import streamElementsPrimary from "@/assets/icons/StreamElements/Primary.svg";
import streamlabsPrimary from "@/assets/icons/Streamlabs/Primary.svg";
import tiktokPrimary from "@/assets/icons/TikTok/Primary.svg";
import tiktokWhite from "@/assets/icons/TikTok/White.svg";
import tiktokBlack from "@/assets/icons/TikTok/Black.svg";
import twitchPrimary from "@/assets/icons/Twitch/Primary.svg";
import twitchWhite from "@/assets/icons/Twitch/White.svg";
import twitchBlack from "@/assets/icons/Twitch/Black.svg";
import websitePrimary from "@/assets/icons/Website/Primary.svg";
import websiteWhite from "@/assets/icons/Website/White.svg";
import websiteBlack from "@/assets/icons/Website/Black.svg";
import whatsAppPrimary from "@/assets/icons/WhatsApp/Primary.svg";
import whatsAppWhite from "@/assets/icons/WhatsApp/White.svg";
import whatsAppBlack from "@/assets/icons/WhatsApp/Black.svg";
import xBlack from "@/assets/icons/X/Black.svg";
import xWhite from "@/assets/icons/X/White.svg";
import youTubePrimary from "@/assets/icons/YouTube/Primary.svg";
import youTubeWhite from "@/assets/icons/YouTube/White.svg";
import youTubeBlack from "@/assets/icons/YouTube/Black.svg";

/** Git index folder names (Linux/Vercel). SnapChat has a capital C. X has no Primary.svg. */
export const PLATFORM_FOLDER = {
  discord: "Discord",
  instagram: "Instagram",
  kick: "Kick",
  link: "Link",
  snapchat: "SnapChat",
  soundcloud: "SoundCloud",
  spotify: "Spotify",
  streamelements: "StreamElements",
  streamlabs: "Streamlabs",
  tiktok: "TikTok",
  twitch: "Twitch",
  website: "Website",
  whatsapp: "WhatsApp",
  x: "X",
  youtube: "YouTube",
} as const;

/** Folder names on disk under `src/assets/icons`. */
export type PlatformBrand =
  | "discord"
  | "instagram"
  | "kick"
  | "link"
  | "snapchat"
  | "soundcloud"
  | "spotify"
  | "streamelements"
  | "streamlabs"
  | "tiktok"
  | "twitch"
  | "website"
  | "whatsapp"
  | "x"
  | "youtube";

/** Code keys including aliases used by existing callers. */
export type PlatformAssetName = PlatformBrand | "other" | "custom" | "youtube-play";

/** Kept for callers; every tone resolves to the single Primary file. */
export type IconVariant = "Primary" | "White" | "Black" | "Primary2";

/** One existing file per brand. X aliases White.svg as Primary. */
export const PLATFORM_ASSET_URLS: Record<PlatformBrand, string> = {
  discord: discordPrimary,
  instagram: instagramPrimary,
  kick: kickPrimary,
  link: linkPrimary,
  snapchat: snapchatPrimary,
  soundcloud: soundCloudPrimary,
  spotify: spotifyPrimary,
  streamelements: streamElementsPrimary,
  streamlabs: streamlabsPrimary,
  tiktok: tiktokPrimary,
  twitch: twitchPrimary,
  website: websitePrimary,
  whatsapp: whatsAppPrimary,
  x: xWhite,
  youtube: youTubePrimary,
};

const ALIAS: Record<string, PlatformBrand> = {
  other: "link",
  custom: "link",
  "youtube-play": "youtube",
};

export function resolvePlatformBrand(name: PlatformAssetName | string): PlatformBrand | null {
  const key = name.trim().toLowerCase();
  if (key in ALIAS) return ALIAS[key] ?? null;
  if (key in PLATFORM_ASSET_URLS) return key as PlatformBrand;
  return null;
}

const WHITE_ASSET_URLS: Partial<Record<PlatformBrand, string>> = {
  discord: discordWhite,
  instagram: instagramWhite,
  kick: kickWhite,
  link: linkWhite,
  snapchat: snapchatWhite,
  tiktok: tiktokWhite,
  twitch: twitchWhite,
  website: websiteWhite,
  whatsapp: whatsAppWhite,
  x: xWhite,
  youtube: youTubeWhite,
};

const BLACK_ASSET_URLS: Partial<Record<PlatformBrand, string>> = {
  discord: discordBlack,
  instagram: instagramBlack,
  kick: kickBlack,
  link: linkBlack,
  snapchat: snapchatBlack,
  tiktok: tiktokBlack,
  twitch: twitchBlack,
  website: websiteBlack,
  whatsapp: whatsAppBlack,
  x: xBlack,
  youtube: youTubeBlack,
};

const ICON_GLOW_DARK =
  "drop-shadow(0 0 6px rgba(255,255,255,0.9)) drop-shadow(0 0 14px rgba(255,255,255,0.45))";
const ICON_GLOW_LIGHT =
  "drop-shadow(0 0 6px rgba(0,0,0,0.28)) drop-shadow(0 0 12px rgba(0,0,0,0.16))";

/** Glow: White on dark, Black on light. Mono: same tones, no glow. Never White-on-light. */
export function resolveIconVariant(
  brand: PlatformBrand,
  options: {
    variant?: IconVariant | undefined;
    onLight?: boolean;
    whiteIcons?: boolean;
    monoIcons?: boolean;
    onBrand?: boolean;
    surface?: string | undefined;
  } = {},
): IconVariant {
  if (options.whiteIcons || options.monoIcons) return options.onLight === true ? "Black" : "White";
  if (options.variant) return options.variant;
  if (brand === "x") return options.onLight ? "Black" : "White";
  return "Primary";
}

export function platformAssetUrl(
  name: PlatformAssetName | string,
  options: {
    variant?: IconVariant | undefined;
    onLight?: boolean;
    whiteIcons?: boolean;
    monoIcons?: boolean;
    onBrand?: boolean;
    surface?: string | undefined;
  } = {},
): string | null {
  const brand = resolvePlatformBrand(name);
  if (!brand) return null;
  const tone = resolveIconVariant(brand, options);
  if (tone === "White") return WHITE_ASSET_URLS[brand] ?? PLATFORM_ASSET_URLS[brand];
  if (tone === "Black") return BLACK_ASSET_URLS[brand] ?? PLATFORM_ASSET_URLS[brand];
  if (brand === "x") return options.onLight === true ? xBlack : xWhite;
  return PLATFORM_ASSET_URLS[brand];
}

export function PlatformAsset({
  name,
  size,
  className,
  style,
  label,
  onLight,
  whiteIcons,
  monoIcons,
  variant,
}: {
  name: PlatformAssetName | string;
  size: number;
  fit?: "contain" | "auto";
  onLight?: boolean;
  whiteIcons?: boolean;
  monoIcons?: boolean;
  onBrand?: boolean;
  surface?: string | undefined;
  variant?: IconVariant | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  label?: string | undefined;
}) {
  const brand = resolvePlatformBrand(name);
  if (!brand) return null;
  const src = platformAssetUrl(name, { onLight, whiteIcons, monoIcons, variant });
  if (!src) return null;
  const tone = resolveIconVariant(brand, { onLight, whiteIcons, monoIcons, variant });
  const contrastTone = Boolean(whiteIcons || monoIcons);
  const toneFilter = [
    whiteIcons ? (onLight === true ? ICON_GLOW_LIGHT : ICON_GLOW_DARK) : null,
    contrastTone && tone === "White" && !WHITE_ASSET_URLS[brand] ? "brightness(0) invert(1)" : null,
    contrastTone && tone === "Black" && !BLACK_ASSET_URLS[brand] ? "brightness(0)" : null,
    style?.filter,
  ]
    .filter(Boolean)
    .join(" ");
  const box: CSSProperties = {
    height: size,
    width: size,
    display: "block",
    flex: "0 0 auto",
    overflow: "visible",
    objectFit: "contain",
    ...style,
    ...(toneFilter ? { filter: toneFilter } : {}),
  };
  const modeKey = whiteIcons ? "glow" : monoIcons ? "mono" : "brand";

  return createElement("img", {
    key: `${PLATFORM_FOLDER[brand]}/${tone}-${modeKey}`,
    className,
    src,
    alt: label ?? "",
    draggable: false,
    style: box,
  });
}
