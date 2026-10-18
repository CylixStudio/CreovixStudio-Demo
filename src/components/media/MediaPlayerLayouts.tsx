import { memo } from "react";
import { MoreHorizontal, Pause, Play } from "lucide-react";
import { MediaSourceBadge } from "@/components/media/MediaSourceBadge";
import { paletteVars, usePlayerPalette, type PlayerLayout } from "@/lib/playerPalette";

export type TrackView = {
  title: string;
  requester: string;
  thumbnailUrl: string | null;
  progress?: number;
  paused?: boolean;
  platform?: string | null | undefined;
  artist?: string | null | undefined;
};

/** Splits "Artist - Song" titles so layouts can show two lines of text. */
export function splitTitle(title: string) {
  const parts = title.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) return { song: parts.slice(1).join(" - ").trim(), artist: (parts[0] ?? "").trim() };
  return { song: title.trim(), artist: "" };
}

const pct = (v: number | undefined) => `${Math.max(0, Math.min(100, Math.round((v ?? 0) * 100)))}%`;

/** Renders the current track in one of the three dynamically themed player layouts. */
export const MediaPlayerCard = memo(function MediaPlayerCard({ layout, track, className = "" }: { layout: PlayerLayout; track: TrackView; className?: string }) {
  const palette = usePlayerPalette(track.thumbnailUrl);
  const style = paletteVars(palette);
  const split = splitTitle(track.title);
  const song = split.song;
  const artist = track.artist?.trim() || split.artist;
  const art = track.thumbnailUrl;
  const Icon = track.paused ? Play : Pause;
  const badge = track.platform ? <MediaSourceBadge platform={track.platform} size={12} className="shrink-0 text-white/90" /> : null;

  if (layout === "COMPACT_SLIM") {
    return (
      <div style={style} className={`relative flex items-center gap-3 overflow-hidden rounded-full px-3 py-2 shadow-[0_18px_50px_rgba(0,0,0,.45)] ${className}`}>
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: "linear-gradient(90deg, var(--player-color-dark), var(--player-color-muted))" }}
        />
        <div className="relative flex w-full items-center gap-3">
          {art && <img src={art} alt="" className="size-9 shrink-0 rounded-full object-cover ring-1 ring-white/20" />}
          <div className="min-w-0 flex-1" style={{ color: "var(--player-color-light)" }}>
            <p className="flex items-center gap-1.5 truncate text-sm font-bold leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,.65)]">{badge}<span className="truncate">{song}</span></p>
            <p className="truncate text-[11px] opacity-85 drop-shadow-[0_1px_2px_rgba(0,0,0,.65)]">{artist || track.requester}</p>
          </div>
          <Icon className="size-5 shrink-0" style={{ color: "var(--player-color-vibrant)" }} />
          <MoreHorizontal className="size-5 shrink-0" style={{ color: "var(--player-color-vibrant)" }} />
        </div>
      </div>
    );
  }

  if (layout === "MINIMAL_ROW") {
    return (
      <div
        style={{ ...style, borderColor: "var(--player-color-muted)", background: "color-mix(in srgb, var(--player-color-muted) 18%, rgba(8,10,16,.88))" }}
        className={`flex items-center gap-3 rounded-2xl border p-3 shadow-[0_16px_44px_rgba(0,0,0,.45)] backdrop-blur-xl ${className}`}
      >
        {art
          ? <img src={art} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
          : <span className="size-12 shrink-0 rounded-lg" style={{ background: "var(--player-color-muted)" }} />}
        <div className="min-w-0 flex-1 text-white">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,.7)]">
            {badge}
            <span className="truncate">
              {song}
              {artist && <span className="px-1.5 font-black" style={{ color: "var(--player-color-vibrant)" }}>·</span>}
              {artist && <span className="opacity-75">{artist}</span>}
            </span>
          </p>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/12">
            <div className="h-full rounded-full" style={{ width: pct(track.progress), background: "var(--player-color-vibrant)" }} />
          </div>
        </div>
        <MoreHorizontal className="size-5 shrink-0" style={{ color: "var(--player-color-vibrant)" }} />
      </div>
    );
  }

  return (
    <div style={style} className={`relative w-full max-w-[360px] overflow-hidden rounded-3xl border border-white/12 bg-[#0b0d12]/85 shadow-[0_24px_70px_rgba(0,0,0,.5)] backdrop-blur-xl ${className}`}>
      <div className="relative h-40 w-full overflow-hidden">
        {art && (
          <>
            <img src={art} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.7))" }} />
          </>
        )}
        {!art && <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.7))" }} />}
      </div>
      <div className="space-y-0.5 p-3">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold leading-tight" style={{ color: "var(--player-color-vibrant)" }}>{badge}<span className="truncate">{song}</span></p>
        <p className="truncate text-xs font-medium leading-tight opacity-90" style={{ color: "var(--player-color-vibrant)" }}>{artist || track.requester}</p>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/12">
          <div className="h-full rounded-full" style={{ width: pct(track.progress), background: "var(--player-color-vibrant)" }} />
        </div>
        <div className="mt-2 flex items-center justify-between" style={{ color: "var(--player-color-light)" }}>
          <span className="truncate text-[11px] opacity-85">Requested by {track.requester}</span>
          <span className="grid size-7 place-items-center rounded-full border" style={{ borderColor: "var(--player-color-light)" }}>
            <Icon className="size-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
});
