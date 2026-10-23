import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import {
  GiveawayDisplay,
  type ClaimState,
  type DrawPhase,
} from "@/components/widgets/GiveawayDisplay";
import type { GiveawayPresentation } from "@/lib/giveawayPresentation";

type Payload = {
  keyword: string;
  draw: {
    phase: DrawPhase;
    winner: { username: string; platform: string; avatarUrl?: string | null } | null;
    claimState: ClaimState;
    claimUntil: string | null;
    presentation?: GiveawayPresentation;
    revealStartedAt?: string | null;
    revealDuration?: number;
  } | null;
  lastWinner: { username: string; platform: string } | null;
  participants: Array<{
    id: string;
    platform: string;
    username: string;
    avatarUrl?: string | null;
  }>;
};

export const Route = createFileRoute("/overlay/giveaway")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
  }),
  head: () => ({
    meta: [
      { title: "CylixStudio — Giveaway (OBS)" },
      {
        name: "description",
        content: "Transparent giveaway winner reveal for OBS.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GiveawayOverlay,
});

function GiveawayOverlay() {
  const { token } = Route.useSearch();
  const [data, setData] = useState<Payload | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    document.body.classList.add("overlay-transparent");
    document.documentElement.style.background = "transparent";
    return () => document.body.classList.remove("overlay-transparent");
  }, []);

  useEffect(() => {
    if (!token) return;
    let stopped = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/public/giveaway/${encodeURIComponent(token)}/live`, {
          cache: "no-store",
        });
        if (stopped) return;
        if (response.ok) setData(await response.json());
        else if (response.status === 404 || response.status === 403) setData(null);
        else console.warn("[giveaway-overlay] Snapshot request failed", response.status);
      } catch (error) {
        console.warn(
          "[giveaway-overlay] Snapshot unavailable",
          error instanceof Error ? error.name : "network_error",
        );
      }
    };
    void load();
    const poll = setInterval(() => void load(), 2000);
    return () => {
      stopped = true;
      clearInterval(poll);
    };
  }, [token]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const draw = data?.draw ?? null;
  const claimUntil = draw?.claimUntil ? Date.parse(draw.claimUntil) : 0;
  const claimLeft = claimUntil ? Math.max(0, Math.round((claimUntil - now) / 1000)) : 0;
  const claimState: ClaimState =
    draw?.claimState === "confirmed"
      ? "confirmed"
      : claimUntil && claimLeft <= 0
        ? "expired"
        : (draw?.claimState ?? "pending");

  return (
    <main className="fixed inset-0 overflow-hidden bg-transparent">
      <GiveawayDisplay
        participants={data?.participants ?? []}
        winner={draw?.winner ?? null}
        phase={draw?.phase ?? "idle"}
        claimState={claimState}
        claimLeft={claimLeft}
        keyword={data?.keyword ?? "+1"}
        lastWinner={data?.lastWinner ?? null}
        expanded
        transparent
        presentation={draw?.presentation}
        revealStartedAt={draw?.revealStartedAt}
        duration={draw?.revealDuration}
      />
    </main>
  );
}
