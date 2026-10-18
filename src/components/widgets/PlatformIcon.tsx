import type React from "react";

import {
  PlatformAsset,
  resolvePlatformBrand,
  type PlatformAssetName,
} from "@/components/icons/platformAssets";

export type PlatformKey = "TWITCH" | "KICK" | "YOUTUBE" | "TIKTOK" | "X";

const ASSET: Record<PlatformKey, PlatformAssetName> = {
  TWITCH: "twitch",
  KICK: "kick",
  YOUTUBE: "youtube",
  TIKTOK: "tiktok",
  X: "x",
};

const LABEL: Record<PlatformKey, string> = {
  TWITCH: "Twitch",
  KICK: "Kick",
  YOUTUBE: "YouTube",
  TIKTOK: "TikTok",
  X: "X",
};

export function normalizePlatform(value: string): PlatformKey | null {
  const key = value.trim().toUpperCase();
  if (key === "TWITCH") return "TWITCH";
  if (key === "KICK") return "KICK";
  if (key === "YOUTUBE" || key === "YT") return "YOUTUBE";
  if (key === "TIKTOK") return "TIKTOK";
  if (key === "X" || key === "TWITTER") return "X";
  return null;
}

/**
 * Official-style vector marks used as the default (fallback) platform badge in
 * the Chat Box overlay. Rendered at a fixed height with auto width so wordless
 * marks stay crisp at any overlay scale.
 */
export function PlatformIcon({
  platform,
  size = 18,
  style,
}: {
  platform: string;
  size?: number;
  style?: React.CSSProperties;
}) {
  const key = normalizePlatform(platform);
  const name = key ? ASSET[key] : resolvePlatformBrand(platform);
  if (!name) return null;

  return (
    <PlatformAsset
      key={`${name}-overlay`}
      name={name}
      size={size}
      fit="auto"
      label={key ? LABEL[key] : undefined}
      style={style}
    />
  );
}
