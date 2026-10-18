import type { ReactNode } from "react";

import { PlatformAsset } from "@/components/icons/platformAssets";
import { mediaPlatformLabel, normalizeMediaPlatform, type MediaPlatform } from "@/lib/mediaRequests";

function YouTubeMark({ size }: { size: number }) {
  return <PlatformAsset key="youtube" name="youtube" size={size} />;
}

function SpotifyMark({ size }: { size: number }) {
  return <PlatformAsset key="spotify" name="spotify" size={size} />;
}

function SoundCloudMark({ size }: { size: number }) {
  return <PlatformAsset key="soundcloud" name="soundcloud" size={size} />;
}

function AnghamiMark({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <rect width="24" height="24" rx="6" fill="#7B2BFF" />
      <path fill="#fff" d="M12.2 5.2 6.4 18.2h2.2l1.2-2.8h4.5l1.2 2.8h2.2L12.2 5.2Zm.1 3.5 1.6 3.7h-3.2l1.6-3.7Z" />
    </svg>
  );
}

const MARK: Record<MediaPlatform, (props: { size: number }) => ReactNode> = {
  YOUTUBE: YouTubeMark,
  SPOTIFY: SpotifyMark,
  ANGHAMI: AnghamiMark,
  SOUNDCLOUD: SoundCloudMark,
};

/** Compact platform mark + name shown beside queued / now-playing titles. */
export function MediaSourceBadge({
  platform,
  size = 14,
  showLabel = true,
  className = "",
}: {
  platform?: string | null | undefined;
  size?: number;
  showLabel?: boolean;
  className?: string;
}) {
  const key = normalizeMediaPlatform(platform);
  const Icon = MARK[key];
  return (
    <span className={`inline-flex items-center gap-1 align-middle ${className}`}>
      <Icon size={size} />
      {showLabel && <span className="text-[11px] font-semibold tracking-wide">{mediaPlatformLabel(key)}</span>}
    </span>
  );
}
