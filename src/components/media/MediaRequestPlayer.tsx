import { useEffect, useRef, type RefObject } from "react";
import { ExternalLink } from "lucide-react";
import { MediaSourceBadge } from "@/components/media/MediaSourceBadge";
import {
  mediaArtworkUrl,
  mediaEmbedSrc,
  mediaOpenUrl,
  mediaPlaybackHint,
  mediaPlaybackMode,
  normalizeMediaPlatform,
} from "@/lib/mediaRequests";

export type MediaRequestTrack = {
  id?: string;
  platform?: string | null;
  youtube_video_id?: string | null;
  youtube_url?: string | null;
  title: string;
  artist?: string | null;
  thumbnail_url?: string | null;
};

type PlayerProps = {
  track: MediaRequestTrack;
  audioOnly?: boolean;
  frameRef?: RefObject<HTMLIFrameElement | null>;
  className?: string;
};

const frameClass = "size-full border-0";

/** Official-embed surface for the now-playing track. Never loads unofficial streams. */
export function MediaRequestPlayer({ track, audioOnly = false, frameRef, className = "" }: PlayerProps) {
  const platform = normalizeMediaPlatform(track.platform);
  const mode = mediaPlaybackMode(platform);
  const embed = mediaEmbedSrc({ ...track, audioOnly });
  const openUrl = mediaOpenUrl(track);
  const art = mediaArtworkUrl(track);
  const title = track.artist ? `${track.title}` : track.title;

  if (audioOnly && (mode === "youtube" || mode === "soundcloud") && embed) {
    return (
      <iframe
        ref={frameRef}
        title={title}
        className="absolute size-px opacity-0"
        allow="autoplay; encrypted-media"
        src={embed}
      />
    );
  }

  if (mode === "youtube" && embed) {
    return (
      <div className={`overflow-hidden bg-black ${className}`}>
        <iframe ref={frameRef} title={title} className={frameClass} allow="autoplay; encrypted-media" src={embed} />
      </div>
    );
  }

  if (mode === "soundcloud" && embed) {
    return (
      <div className={`overflow-hidden bg-black ${className}`}>
        <iframe ref={frameRef} title={title} className={frameClass} allow="autoplay" src={embed} />
      </div>
    );
  }

  return (
    <div className={`relative flex size-full flex-col justify-end overflow-hidden bg-[#0b0d12] ${className}`}>
      {art && <img src={art} alt="" className="absolute inset-0 size-full object-cover opacity-40" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" />
      {embed && (
        <iframe
          ref={frameRef}
          title={title}
          className="relative z-[1] h-[152px] w-full shrink-0 border-0"
          allow="autoplay; encrypted-media; clipboard-write"
          src={embed}
        />
      )}
      <div className="relative z-[1] space-y-2 p-4">
        <MediaSourceBadge platform={platform} />
        <p className="text-sm text-white/80">{mediaPlaybackHint(platform)}</p>
        {openUrl && (
          <a
            href={openUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
          >
            Open in {platform === "SPOTIFY" ? "Spotify" : platform === "ANGHAMI" ? "Anghami" : "the app"}
            <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </div>
  );
}

/** Bridges pause/play/ended for official YouTube + SoundCloud embeds. */
export function useMediaEmbedBridge(
  frame: RefObject<HTMLIFrameElement | null>,
  current: { id: string; platform?: string | null | undefined } | null,
  onEnded: (id: string) => void,
  status?: string,
  volume?: number,
) {
  const platform = normalizeMediaPlatform(current?.platform);
  const currentId = current?.id ?? null;
  const ended = useRef(onEnded);
  ended.current = onEnded;

  useEffect(() => {
    if (!currentId) return;
    const mode = mediaPlaybackMode(platform);
    if (mode === "youtube") {
      const t = window.setTimeout(() => {
        const cmd = status === "PAUSED" ? "pauseVideo" : "playVideo";
        frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: cmd, args: [] }), "https://www.youtube.com");
      }, 300);
      return () => window.clearTimeout(t);
    }
    if (mode === "soundcloud") {
      const method = status === "PAUSED" ? "pause" : "play";
      const t = window.setTimeout(() => {
        frame.current?.contentWindow?.postMessage(JSON.stringify({ method }), "https://w.soundcloud.com");
      }, 400);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [currentId, frame, platform, status]);

  useEffect(() => {
    if (!currentId || mediaPlaybackMode(platform) !== "youtube") return;
    const t = window.setTimeout(() => {
      const win = frame.current?.contentWindow;
      win?.postMessage(JSON.stringify({ event: "command", func: "unMute", args: [] }), "https://www.youtube.com");
      win?.postMessage(JSON.stringify({ event: "command", func: "setVolume", args: [Math.max(0, Math.min(100, volume ?? 80))] }), "https://www.youtube.com");
    }, 300);
    return () => window.clearTimeout(t);
  }, [currentId, frame, platform, volume]);

  useEffect(() => {
    if (!currentId) return;
    const mode = mediaPlaybackMode(platform);
    if (mode !== "youtube" && mode !== "soundcloud") return;
    let fired = false;
    const originOk = (origin: string) =>
      mode === "youtube" ? origin.includes("youtube.com") : origin.includes("soundcloud.com");
    const handshake = window.setInterval(() => {
      if (mode === "youtube") {
        frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: currentId }), "https://www.youtube.com");
      } else {
        frame.current?.contentWindow?.postMessage(JSON.stringify({ method: "addEventListener", value: "finish" }), "https://w.soundcloud.com");
      }
    }, 1000);
    const onMessage = (event: MessageEvent) => {
      if (!originOk(String(event.origin)) || fired) return;
      let payload: { event?: string; info?: unknown; method?: string };
      try {
        payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data as { event?: string; info?: unknown; method?: string };
      } catch {
        return;
      }
      if (mode === "youtube") {
        const info = payload?.info;
        const state = typeof info === "number" ? info : (info && typeof info === "object" ? (info as { playerState?: number }).playerState : undefined);
        if (state !== 0) return;
      } else if (payload?.method !== "finish" && String(payload?.event ?? "").toLowerCase() !== "finish") {
        return;
      }
      fired = true;
      ended.current(currentId);
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.clearInterval(handshake);
      window.removeEventListener("message", onMessage);
    };
  }, [currentId, frame, platform]);
}
