import { useEffect, useRef } from "react";

import type { MarkVodInfo } from "@/lib/markPoints";

export function MarkVodPlayer({
  vod,
  emptyLabel,
}: {
  vod: MarkVodInfo | null;
  emptyLabel: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nativeHls = Boolean(
    vod?.hlsUrl &&
      typeof document !== "undefined" &&
      document.createElement("video").canPlayType("application/vnd.apple.mpegurl"),
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !nativeHls || vod?.seekSeconds == null) return;
    const seek = () => {
      video.currentTime = vod.seekSeconds ?? 0;
    };
    if (video.readyState >= 1) seek();
    else video.addEventListener("loadedmetadata", seek, { once: true });
    return () => video.removeEventListener("loadedmetadata", seek);
  }, [nativeHls, vod?.hlsUrl, vod?.seekSeconds]);

  if (!vod) {
    return (
      <div className="grid size-full place-items-center bg-zinc-950 text-center">
        <p className="max-w-xs px-4 text-sm text-zinc-500">{emptyLabel}</p>
      </div>
    );
  }

  if (nativeHls && vod.hlsUrl) {
    return (
      <video
        ref={videoRef}
        src={vod.hlsUrl}
        poster={vod.thumbnail ?? undefined}
        controls
        autoPlay
        playsInline
        className="size-full object-contain"
      />
    );
  }

  return (
    <iframe
      title={vod.title ?? "Kick"}
      src={vod.embedUrl}
      className="size-full border-0"
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
    />
  );
}
