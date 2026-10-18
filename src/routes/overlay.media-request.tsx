import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MediaPlayerCard } from "@/components/media/MediaPlayerLayouts";
import { MediaRequestPlayer, useMediaEmbedBridge } from "@/components/media/MediaRequestPlayer";
import { mediaArtworkUrl, normalizeMediaPlatform } from "@/lib/mediaRequests";
import { isPlayerLayout } from "@/lib/playerPalette";

type Current = {
  id?: string;
  platform?: string | null;
  artist?: string | null;
  youtube_video_id: string;
  youtube_url?: string | null;
  title: string;
  requester_username: string;
  requester_avatar_url: string | null;
  thumbnail_url?: string | null;
};
type Payload = {
  settings?: { display_mode: string; player_layout?: string; volume: number };
  playback: null | { playback_status: string; revision: number; volume: number };
  current: null | Current;
};

export const Route = createFileRoute("/overlay/media-request")({
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s["token"] === "string" ? s["token"] : "" }),
  head: () => ({ meta: [{ title: "CylixStudio — Media Request (OBS)" }, { name: "robots", content: "noindex" }] }),
  component: MediaOverlay,
});

function MediaOverlay() {
  const { token } = Route.useSearch();
  const [data, setData] = useState<Payload | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const current = data?.current ?? null;
  const currentId = current?.id ?? null;
  const advancing = useRef(false);

  useEffect(() => {
    document.body.classList.add("overlay-transparent");
    document.documentElement.style.background = "transparent";
    return () => document.body.classList.remove("overlay-transparent");
  }, []);

  useEffect(() => {
    if (!token) return;
    let source: EventSource | null = null;
    let stopped = false;
    const load = async () => {
      const r = await fetch(`/api/public/media-request/${encodeURIComponent(token)}/live`, { cache: "no-store" });
      if (r.ok) setData(await r.json());
    };
    void load();
    source = new EventSource(`/api/public/media-request/${encodeURIComponent(token)}/stream`);
    source.addEventListener("playback", (e) => setData((old) => ({ ...old, ...JSON.parse((e as MessageEvent).data) })));
    const poll = setInterval(() => void load(), 5000);
    return () => {
      stopped = true;
      source?.close();
      clearInterval(poll);
      void stopped;
    };
  }, [token]);

  const onEnded = useCallback((id: string) => {
    if (advancing.current) return;
    advancing.current = true;
    void fetch(`/api/public/media-request/${encodeURIComponent(token)}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: id }),
    }).catch(() => undefined);
  }, [token]);

  useEffect(() => {
    advancing.current = false;
  }, [currentId]);

  useMediaEmbedBridge(
    frame,
    currentId ? { id: currentId, platform: current?.platform } : null,
    onEnded,
    data?.playback?.playback_status,
    data?.playback?.volume,
  );

  if (!current) return <main className="min-h-screen bg-transparent" />;
  const audio = data?.settings?.display_mode === "AUDIO_ONLY";
  const platform = normalizeMediaPlatform(current.platform);
  return (
    <main className="flex min-h-screen items-center justify-center bg-transparent p-6">
      <div className={audio ? "w-[760px]" : "w-[960px]"}>
        {!audio && (
          <div className="aspect-video overflow-hidden rounded-3xl border border-white/15 bg-black shadow-2xl">
            <MediaRequestPlayer track={current} frameRef={frame} className="size-full" />
          </div>
        )}
        {audio && <MediaRequestPlayer track={current} audioOnly frameRef={frame} />}
        <div className="mx-auto -mt-5 w-[92%]">
          <MediaPlayerCard
            layout={audio ? "COMPACT_SLIM" : (isPlayerLayout(data?.settings?.player_layout) ? data.settings.player_layout : "VERTICAL_CARD")}
            track={{
              title: current.title,
              artist: current.artist,
              platform,
              requester: current.requester_username,
              thumbnailUrl: mediaArtworkUrl(current),
              paused: data?.playback?.playback_status === "PAUSED",
            }}
          />
        </div>
      </div>
    </main>
  );
}
