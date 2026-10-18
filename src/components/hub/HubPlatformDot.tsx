import type { PlatformId } from "@/components/hub/platforms";

const SOLID: Record<Exclude<PlatformId, "TIKTOK">, string> = {
  KICK: "#53FC18",
  TWITCH: "#9146FF",
  YOUTUBE: "#FF0000",
};

const DOT = "inline-block h-1.5 w-1.5 shrink-0 rounded-full";

export function HubPlatformDot({ id, title }: { id: PlatformId; title?: string | undefined }) {
  if (id === "TIKTOK") {
    return <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" title={title} aria-hidden />;
  }
  return <span className={DOT} title={title} aria-hidden style={{ background: SOLID[id] }} />;
}
