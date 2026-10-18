import type { CSSProperties } from "react";

import { LinkInBioText } from "@/components/link-in-bio/LinkInBioText";
import type { StreamStatus } from "@/lib/linkInBio";

const PLATFORM: Record<Exclude<StreamStatus["platform"], "profile">, string> = {
  twitch: "Twitch",
  youtube: "YouTube",
  kick: "Kick",
};

function formatViewers(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k`;
  return String(count);
}

export function LinkInBioStreamCard({
  stream,
  glass,
  border,
}: {
  stream: StreamStatus | null;
  glass: boolean;
  border: string;
}) {
  if (!stream || (stream.kind === "offline" && stream.platform === "profile" && !stream.latest && !stream.channelUrl)) {
    return null;
  }

  const surface: CSSProperties = {
    border,
    background: glass ? "rgba(255,255,255,0.06)" : "color-mix(in oklab, var(--bio-fg) 7%, var(--bio-bg))",
    backdropFilter: glass ? "blur(14px)" : undefined,
  };

  if (stream.kind === "live") {
    return (
      <div className="mt-6 w-full overflow-hidden rounded-2xl px-4 py-4 text-start" style={surface}>
        <p className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-wide" style={{ color: "var(--bio-accent)" }}>
          <span className="size-1.5 animate-pulse rounded-full bg-current" />
          Live on {PLATFORM[stream.platform]}
          {typeof stream.viewers === "number" ? ` · ${formatViewers(stream.viewers)} watching` : ""}
        </p>
        {stream.title ? (
          <LinkInBioText className="mt-1.5 text-sm font-medium">{stream.title}</LinkInBioText>
        ) : null}
        <a
          href={stream.watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex rounded-full px-4 py-2 text-xs font-semibold"
          style={{ background: "var(--bio-accent)", color: "var(--bio-bg)" }}
        >
          Watch Live Now
        </a>
      </div>
    );
  }

  if (stream.latest) {
    return (
      <div className="mt-6 w-full overflow-hidden rounded-2xl text-start" style={surface}>
        {stream.latest.thumbnailUrl ? (
          <img src={stream.latest.thumbnailUrl} alt="" className="h-36 w-full object-cover" />
        ) : null}
        <div className="px-4 py-3">
          <p className="text-[0.7rem] uppercase tracking-wide" style={{ color: "var(--bio-muted)" }}>
            Latest on {stream.platform === "profile" ? "this page" : PLATFORM[stream.platform]}
          </p>
          <LinkInBioText className="mt-1 text-sm font-medium">{stream.latest.title}</LinkInBioText>
          <a
            href={stream.latest.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex text-xs font-semibold"
            style={{ color: "var(--bio-accent)" }}
          >
            Watch
          </a>
        </div>
      </div>
    );
  }

  if (stream.channelUrl) {
    const name = stream.platform === "profile" ? "channel" : PLATFORM[stream.platform];
    return (
      <div className="mt-6 w-full rounded-2xl px-4 py-4 text-start" style={surface}>
        <p className="text-sm font-medium">Currently offline</p>
        <p className="mt-1 text-xs" style={{ color: "var(--bio-muted)" }}>
          No live session right now.
        </p>
        <a
          href={stream.channelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex text-xs font-semibold"
          style={{ color: "var(--bio-accent)" }}
        >
          Open {name}
        </a>
      </div>
    );
  }

  return null;
}
