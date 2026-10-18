import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Loader2, Play, ShieldCheck, SkipForward, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DarkSelect } from "@/components/ui/dark-select";
import { MediaSourceBadge } from "@/components/media/MediaSourceBadge";
import { mediaArtworkUrl } from "@/lib/mediaRequests";

type ModRequest = {
  id: string; title: string; status: string; requester_username: string;
  platform?: string | null; artist?: string | null;
  youtube_video_id: string; youtube_url?: string | null; thumbnail_url: string | null; duration_seconds: number;
};
type Snapshot = {
  requests: ModRequest[];
  playback: { current_request_id: string | null; playback_status: string } | null;
  requestMode: "AUTO" | "MANUAL" | "PAUSED";
};

export const Route = createFileRoute("/mod-queue")({
  head: () => ({
    meta: [
      { title: "CylixStudio — Mod Queue" },
      { name: "description", content: "Moderator controls for the CylixStudio media request queue: approve, skip, reject and pause incoming requests." },
      { property: "og:title", content: "CylixStudio — Mod Queue" },
      { property: "og:description", content: "Approve, skip, reject and pause incoming media requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ModQueuePage,
});

const glass = "rounded-2xl border border-white/10 bg-[#10131b]/85 shadow-[0_18px_60px_rgba(0,0,0,.35)] backdrop-blur-xl";
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function ModQueuePage() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") ?? "");
  }, []);

  const load = useCallback(async (value: string) => {
    if (!value) return;
    try {
      const res = await fetch(`/api/public/mod-queue/${value}/queue`, { cache: "no-store" });
      if (!res.ok) { setError("This moderator link is not valid."); setData(null); return; }
      setError(null);
      setData((await res.json()) as Snapshot);
    } catch { setError("Connection lost — retrying."); }
  }, []);

  useEffect(() => {
    if (!token) return;
    void load(token);
    const timer = window.setInterval(() => void load(token), 3000);
    return () => window.clearInterval(timer);
  }, [token, load]);

  const act = async (body: { action: string; requestId?: string; mode?: string }) => {
    setBusy(true);
    try {
      await fetch(`/api/public/mod-queue/${token}/action`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      await load(token);
    } finally { setBusy(false); }
  };

  if (!token) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0a0a0a] p-6 text-white">
        <div className={`${glass} w-full max-w-md space-y-3 p-6 text-center`}>
          <h1 className="text-lg font-bold">Moderator queue</h1>
          <p className="text-sm text-muted-foreground">Paste the moderator link the streamer shared with you.</p>
          <input
            onChange={(e) => setToken(e.target.value.trim().split("token=").pop() ?? "")}
            placeholder="Moderator token"
            className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm"
          />
        </div>
      </main>
    );
  }

  const pending = (data?.requests ?? []).filter((r) => r.status === "PENDING");
  const queue = (data?.requests ?? []).filter((r) => r.status === "QUEUED");
  const playing = (data?.requests ?? []).find((r) => r.status === "PLAYING") ?? null;

  return (
    <main className="min-h-screen bg-[#0a0a0a] p-4 text-white sm:p-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className={`${glass} flex flex-wrap items-center justify-between gap-4 p-5`}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <div>
              <h1 className="font-bold">Mod controls</h1>
              <p className="text-xs text-muted-foreground">{queue.length} approved · {pending.length} awaiting review</p>
            </div>
          </div>
          <div className="w-56">
            <DarkSelect
              value={data?.requestMode ?? "MANUAL"}
              onValueChange={(v) => void act({ action: "SET_MODE", mode: v })}
              options={[
                { value: "AUTO", label: "Auto approve" },
                { value: "MANUAL", label: "Manual review" },
                { value: "PAUSED", label: "Pause requests" },
              ]}
            />
          </div>
        </header>

        {error && <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">{error}</p>}

        {playing && (
          <section className={`${glass} flex items-center gap-3 p-4`}>
            <span className="text-xs font-bold uppercase tracking-[.2em] text-[#53fc18]">Now playing</span>
            <MediaSourceBadge platform={playing.platform} className="shrink-0 text-white/80" />
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">{playing.title}</p>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void act({ action: "SKIP", requestId: playing.id })}><SkipForward />Skip</Button>
          </section>
        )}

        <section className={`${glass} space-y-2 p-5`}>
          <h2 className="mb-2 font-bold">Up Next</h2>
          {[...pending, ...queue].map((r, i) => (
            <div key={r.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/15 p-3">
              <span className="w-5 text-center font-mono text-xs text-muted-foreground">{i + 1}</span>
              {mediaArtworkUrl(r)
                ? <img src={mediaArtworkUrl(r) ?? ""} alt="" className="h-12 w-20 rounded-lg object-cover" />
                : <span className="grid h-12 w-20 place-items-center rounded-lg bg-white/5"><MediaSourceBadge platform={r.platform} showLabel={false} size={20} /></span>}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                  <MediaSourceBadge platform={r.platform} size={13} className="shrink-0 text-white/80" />
                  <span className="truncate">{r.title}</span>
                </p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{r.requester_username}</span>
                  {r.artist && <><span>·</span><span className="truncate">{r.artist}</span></>}
                  {r.duration_seconds > 0 && <><span>·</span><span>{fmt(r.duration_seconds)}</span></>}
                  {r.status === "PENDING" && <span className="text-amber-300">Pending</span>}
                </div>
              </div>
              <div className="flex gap-1">
                {r.status === "PENDING" && <Button size="icon" disabled={busy} onClick={() => void act({ action: "APPROVE", requestId: r.id })}><Check /></Button>}
                <Button size="icon" variant="outline" disabled={busy} onClick={() => void act({ action: "PLAY", requestId: r.id })}><Play /></Button>
                <Button size="icon" variant="outline" disabled={busy} onClick={() => void act({ action: "REJECT", requestId: r.id })}><X /></Button>
                <Button size="icon" variant="ghost" disabled={busy} onClick={() => void act({ action: "DELETE", requestId: r.id })}><Trash2 /></Button>
              </div>
            </div>
          ))}
          {!pending.length && !queue.length && (
            <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
              {data ? "No media requests yet." : <Loader2 className="mx-auto size-4 animate-spin" />}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
