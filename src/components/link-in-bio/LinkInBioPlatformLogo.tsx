import { memo, useEffect, useState, type CSSProperties } from "react";

import { PlatformAsset, type PlatformAssetName } from "@/components/icons/platformAssets";
import type { LinkPlatform } from "@/lib/linkInBio";
import { cn } from "@/lib/utils";

const ASSET: Record<LinkPlatform, PlatformAssetName> = {
  kick: "kick",
  twitch: "twitch",
  youtube: "youtube",
  tiktok: "tiktok",
  instagram: "instagram",
  snapchat: "snapchat",
  x: "x",
  discord: "discord",
  whatsapp: "whatsapp",
  custom: "link",
};

type FaviconPhase = "idle" | "loading" | "ready" | "error";

function markKey({
  platform,
  onLight,
  whiteIcons,
  monoIcons,
}: {
  platform: LinkPlatform;
  onLight: boolean;
  whiteIcons: boolean;
  monoIcons: boolean;
}) {
  const tone = onLight ? "light" : "dark";
  if (whiteIcons) return `${ASSET[platform]}-glow-${tone}`;
  if (monoIcons) return `${ASSET[platform]}-mono-${tone}`;
  return `${ASSET[platform]}-brand`;
}

function LinkFallback({
  size,
  onLight,
  whiteIcons,
  monoIcons,
  style,
}: {
  size: number;
  onLight: boolean;
  whiteIcons: boolean;
  monoIcons: boolean;
  style?: CSSProperties;
}) {
  return (
    <PlatformAsset
      name="link"
      size={size}
      fit="contain"
      onLight={onLight}
      whiteIcons={whiteIcons}
      monoIcons={monoIcons}
      style={{ overflow: "visible", ...style }}
    />
  );
}

function CustomFaviconMark({
  size,
  faviconUrl,
  onLight,
  whiteIcons,
  monoIcons,
}: {
  size: number;
  faviconUrl: string;
  onLight: boolean;
  whiteIcons: boolean;
  monoIcons: boolean;
}) {
  const [phase, setPhase] = useState<FaviconPhase>("loading");

  useEffect(() => {
    setPhase("loading");
  }, [faviconUrl]);

  if (phase === "error") {
    return (
      <LinkFallback size={size} onLight={onLight} whiteIcons={whiteIcons} monoIcons={monoIcons} />
    );
  }

  return (
    <span
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      aria-busy={phase === "loading"}
    >
      {phase === "loading" ? (
        <span
          className="absolute size-2 animate-pulse rounded-full bg-current/35"
          aria-hidden
        />
      ) : null}
      <img
        key={faviconUrl}
        src={faviconUrl}
        alt=""
        width={size}
        height={size}
        draggable={false}
        referrerPolicy="no-referrer"
        className={cn(
          "object-contain",
          phase === "ready" ? "opacity-100" : "opacity-0",
        )}
        style={{ width: size, height: size }}
        onLoad={() => setPhase("ready")}
        onError={() => setPhase("error")}
      />
    </span>
  );
}

function PlatformLogoMark({
  platform,
  size = 40,
  onLight = false,
  whiteIcons = false,
  monoIcons = false,
  faviconUrl,
}: {
  platform: LinkPlatform;
  size?: number;
  onBrand?: boolean;
  ink?: string;
  onLight?: boolean;
  whiteIcons?: boolean;
  monoIcons?: boolean;
  surface?: string | undefined;
  /** Custom-link site favicon. Empty/failed → blue Link chain mark. */
  faviconUrl?: string | null;
}) {
  const resolvedFavicon = platform === "custom" ? faviconUrl?.trim() || null : null;

  if (resolvedFavicon) {
    return (
      <CustomFaviconMark
        size={size}
        faviconUrl={resolvedFavicon}
        onLight={onLight}
        whiteIcons={whiteIcons}
        monoIcons={monoIcons}
      />
    );
  }

  return (
    <PlatformAsset
      key={markKey({ platform, onLight, whiteIcons, monoIcons })}
      name={ASSET[platform]}
      size={size}
      fit="contain"
      onLight={onLight}
      whiteIcons={whiteIcons}
      monoIcons={monoIcons}
      style={{ overflow: "visible" }}
    />
  );
}

export const LinkInBioPlatformLogo = memo(PlatformLogoMark);
