import { useMemo, useState, type CSSProperties } from "react";
import { CheckCircle2, Expand, Minimize2, RotateCcw, Trophy } from "lucide-react";

import { OverlayStage, STAGE_H, STAGE_W } from "@/components/widgets/overlayKit";
import { PlatformIcon } from "@/components/widgets/PlatformIcon";
import { useLanguage } from "@/lib/i18n";

export type DrawPhase = "idle" | "shuffling" | "revealing" | "settled";
export type ClaimState = "pending" | "confirmed" | "expired";

export type GiveawayParticipant = {
  id: string;
  username: string;
  platform: string;
  /** Account picture when the platform provided one. */
  avatarUrl?: string | null | undefined;
};

export type GiveawayWinner = {
  username: string;
  platform: string;
  avatarUrl?: string | null | undefined;
};

export const platformLabel = (platform: string) =>
  ({ KICK: "Kick", TWITCH: "Twitch", YOUTUBE: "YouTube", TIKTOK: "TikTok" })[
    platform.toUpperCase()
  ] ?? platform;

const PLATFORM_RING: Record<string, string> = {
  KICK: "#53fc18",
  TWITCH: "#9146ff",
  YOUTUBE: "#ff4e45",
  TIKTOK: "#25f4ee",
};
const ringFor = (platform: string) => PLATFORM_RING[platform.toUpperCase()] ?? "rgba(255,255,255,0.4)";

const MAX_VISIBLE = 60;
const NAMES_UP_TO = 28;

function hash(seed: string) {
  let h = 2166136261;
  for (const char of seed) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rand(h: number, salt: number) {
  let x = (h + Math.imul(salt, 0x9e3779b1)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

const sameAccount = (
  a: { username: string; platform: string },
  b: { username: string; platform: string } | null,
) =>
  Boolean(b) &&
  a.username.toLowerCase() === b?.username.toLowerCase() &&
  a.platform.toUpperCase() === b?.platform.toUpperCase();

function initialOf(name: string) {
  const trimmed = name.trim();
  const clean = trimmed.replace(/^[^\p{L}\p{N}]+/u, "");
  return (Array.from(clean || trimmed)[0] ?? "?").toLocaleUpperCase();
}

/** Round account picture, or the first letter of the username when there is none. */
export function ParticipantAvatar({
  username,
  platform,
  avatarUrl,
  size,
  ringWidth = 4,
  badge = true,
}: {
  username: string;
  platform: string;
  avatarUrl?: string | null | undefined;
  size: number;
  ringWidth?: number;
  badge?: boolean;
}) {
  const usable = typeof avatarUrl === "string" && /^https?:\/\//i.test(avatarUrl) ? avatarUrl : null;
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = usable !== null && failedUrl !== usable;
  const style = {
    "--size": `${size}px`,
    "--ring": ringFor(platform),
    "--ring-w": `${ringWidth}px`,
  } as CSSProperties;
  return (
    <div className="giveaway-avatar" style={style}>
      {showImage ? (
        <img
          src={usable}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(usable)}
        />
      ) : (
        <span className="giveaway-initial" style={{ fontSize: size * 0.42 }} dir="auto">
          {initialOf(username)}
        </span>
      )}
      {badge ? (
        <span className="giveaway-platform-badge" style={{ width: size * 0.32, height: size * 0.32 }}>
          <PlatformIcon platform={platform} size={Math.max(10, size * 0.2)} />
        </span>
      ) : null}
    </div>
  );
}

type Placed = { participant: GiveawayParticipant; x: number; y: number; index: number };

/** Spreads avatars over rows without overlap; positions depend only on the participant ids. */
function layoutAvatars(list: GiveawayParticipant[], showNames: boolean) {
  const count = list.length;
  if (count === 0) return { size: 0, placed: [] as Placed[] };
  const left = 150;
  const top = 170;
  const width = STAGE_W - left * 2;
  const height = STAGE_H - top - 130;
  const cols = Math.max(1, Math.ceil(Math.sqrt((count * width) / height)));
  const rows = Math.ceil(count / cols);
  const perRow = Math.ceil(count / rows);
  const cellW = width / perRow;
  const cellH = height / rows;
  const labelH = showNames ? 40 : 0;
  const size = Math.round(Math.min(132, Math.max(52, Math.min(cellW * 0.74, (cellH - labelH) * 0.74))));
  const jitterX = Math.max(0, (cellW - size) * 0.26);
  const jitterY = Math.max(0, (cellH - size - labelH) * 0.26);

  const ordered = list
    .map((participant) => ({ participant, key: hash(participant.id) }))
    .sort((a, b) => a.key - b.key || a.participant.id.localeCompare(b.participant.id));
  const base = Math.floor(count / rows);
  const extra = count % rows;
  const placed: Placed[] = [];
  let cursor = 0;
  for (let row = 0; row < rows; row += 1) {
    const inRow = base + (row < extra ? 1 : 0);
    const slotW = width / inRow;
    for (let column = 0; column < inRow; column += 1) {
      const entry = ordered[cursor];
      if (!entry) break;
      placed.push({
        participant: entry.participant,
        index: cursor,
        x: left + (column + 0.5) * slotW + (rand(entry.key, 1) - 0.5) * 2 * jitterX,
        y: top + (row + 0.5) * cellH + (rand(entry.key, 2) - 0.5) * 2 * jitterY,
      });
      cursor += 1;
    }
  }
  return { size, placed };
}

export function GiveawayDisplay({
  participants,
  winner,
  phase,
  claimState,
  claimLeft,
  keyword,
  lastWinner,
  expanded,
  layout = "glass",
  transparent = false,
  onToggleExpand,
  onReroll,
}: {
  participants: GiveawayParticipant[];
  winner: GiveawayWinner | null;
  phase: DrawPhase;
  claimState: ClaimState;
  claimLeft: number;
  keyword: string;
  lastWinner?: { username: string; platform: string } | null | undefined;
  expanded: boolean;
  layout?: "glass" | "direct" | "bold";
  /** OBS browser source: drop the frame/controls and render on transparency. */
  transparent?: boolean;
  onToggleExpand?: (() => void) | undefined;
  onReroll?: (() => void) | undefined;
}) {
  const { t, dir } = useLanguage();
  const keywordLabel = keyword || "+1";

  const phaseLabel =
    phase === "shuffling"
      ? t("giveaway.shuffling")
      : phase === "revealing"
        ? t("giveaway.revealing")
        : winner
          ? t("giveaway.winnerSelected")
          : t("giveaway.liveEntries");

  const showNames = participants.length <= NAMES_UP_TO;
  const { visible, hidden } = useMemo(() => {
    let list = participants.slice(0, MAX_VISIBLE);
    if (winner && !list.some((p) => sameAccount(p, winner))) {
      const found = participants.find((p) => sameAccount(p, winner));
      if (found) list = [...list.slice(0, MAX_VISIBLE - 1), found];
    }
    return { visible: list, hidden: participants.length - list.length };
  }, [participants, winner]);
  const { size, placed } = useMemo(() => layoutAvatars(visible, showNames), [visible, showNames]);

  const revealing = Boolean(winner) && (phase === "revealing" || phase === "settled");
  const winnerAvatar =
    winner?.avatarUrl ?? participants.find((p) => sameAccount(p, winner))?.avatarUrl ?? null;
  const ringWidth = layout === "bold" ? 6 : 4;
  const live = phase === "shuffling" || phase === "revealing";

  return (
    <section
      className={
        transparent
          ? "flex h-full w-full flex-col bg-transparent"
          : `flex h-full w-full flex-col ${layout === "direct" ? "bg-zinc-950" : expanded ? "bg-background" : ""}`
      }
    >
      {!transparent ? (
        <div className="mb-3 flex items-center gap-2">
          <span className={`size-1.5 rounded-full ${live ? "bg-kick animate-pulse" : "bg-primary"}`} />
          <p className="text-[0.68rem] uppercase tracking-wide text-muted-foreground">{phaseLabel}</p>
          {onToggleExpand ? (
            <button
              type="button"
              onClick={onToggleExpand}
              className="ms-auto text-muted-foreground hover:text-foreground"
              aria-label={expanded ? t("giveaway.collapse") : t("giveaway.expand")}
              title={expanded ? t("giveaway.collapse") : t("giveaway.expand")}
            >
              {expanded ? <Minimize2 className="size-4" aria-hidden /> : <Expand className="size-4" aria-hidden />}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className={transparent || expanded ? "relative min-h-0 flex-1" : "relative w-full"}>
        <OverlayStage
          mode="box"
          dir={dir}
          className={transparent || expanded ? "h-full w-full" : "aspect-video w-full rounded-xl"}
        >
          {transparent && participants.length > 0 && !revealing ? (
            <div className="giveaway-status" data-live={live || undefined}>
              <span className="giveaway-status-dot" />
              <span>{phaseLabel}</span>
              <span className="giveaway-status-count" dir="ltr">
                {t("overlay.giveaway.count", { n: participants.length })}
              </span>
            </div>
          ) : null}

          {participants.length === 0 ? (
            transparent ? null : (
              <div className="giveaway-empty">{t("giveaway.joinHint", { keyword: keywordLabel })}</div>
            )
          ) : (
            <div
              className={`giveaway-entries ${phase === "shuffling" ? "is-shuffling" : ""} ${revealing ? "is-revealing" : ""}`}
              aria-label={t("giveaway.liveEntries")}
            >
              {placed.map(({ participant, x, y, index }) => {
                const isWinner = sameAccount(participant, winner);
                const style = {
                  left: x,
                  top: y,
                  "--size": `${size}px`,
                  "--drift-x": `${index % 2 === 0 ? 7 : -7}px`,
                  "--drift-y": `${index % 3 === 0 ? -9 : 9}px`,
                  "--float-duration": `${7 + (index % 5)}s`,
                  "--entry-i": Math.min(index, 14),
                  "--float-delay": `${(index % 9) * -0.9}s`,
                } as CSSProperties;
                return (
                  <div
                    key={participant.id}
                    className={`giveaway-entry-slot ${isWinner ? "is-winner" : "is-other"}`}
                    style={style}
                  >
                    <div className="giveaway-entry" title={participant.username}>
                      <ParticipantAvatar
                        username={participant.username}
                        platform={participant.platform}
                        avatarUrl={participant.avatarUrl}
                        size={size}
                        ringWidth={ringWidth}
                      />
                      {showNames ? (
                        <span
                          className={`giveaway-name ${layout === "direct" ? "is-plain" : ""}`}
                          style={{ maxWidth: Math.max(size * 1.6, 160) }}
                          dir="auto"
                        >
                          {participant.username}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hidden > 0 && !revealing ? (
            <div className="giveaway-more">{t("overlay.giveaway.more", { n: hidden })}</div>
          ) : null}

          {winner && revealing ? (
            <div className="giveaway-winner-reveal">
              <div className="giveaway-winner-badge">
                <Trophy aria-hidden style={{ width: 30, height: 30 }} />
                {t("overlay.giveaway.winner")}
              </div>
              <div className="giveaway-winner-stage">
                <span className="giveaway-halo" aria-hidden />
                <span className="giveaway-pulse" aria-hidden />
                <span className="giveaway-pulse is-late" aria-hidden />
                <ParticipantAvatar
                  username={winner.username}
                  platform={winner.platform}
                  avatarUrl={winnerAvatar}
                  size={300}
                  ringWidth={8}
                />
              </div>
              <p className="giveaway-winner-name" dir="auto">
                {winner.username}
              </p>
              <p className="giveaway-winner-from">
                <PlatformIcon platform={winner.platform} size={30} />
                {t("giveaway.from")}: {platformLabel(winner.platform)}
              </p>

              {phase === "settled" && claimState === "pending" ? (
                <div className="giveaway-claim">
                  <p className="giveaway-claim-title">{t("giveaway.pendingConfirm")}</p>
                  <p className="giveaway-claim-time" dir="ltr">
                    {Math.floor(claimLeft / 60)}:{String(claimLeft % 60).padStart(2, "0")}
                  </p>
                  <p className="giveaway-claim-hint">{t("giveaway.claimHint", { keyword: keywordLabel })}</p>
                </div>
              ) : phase === "settled" && claimState === "confirmed" ? (
                <p className="giveaway-claim is-confirmed">
                  <CheckCircle2 aria-hidden style={{ width: 34, height: 34 }} />
                  {t("giveaway.confirmed")}
                </p>
              ) : phase === "settled" && claimState === "expired" && onReroll && !transparent ? (
                <button type="button" onClick={onReroll} className="giveaway-reroll">
                  <RotateCcw aria-hidden style={{ width: 30, height: 30 }} />
                  {t("giveaway.reroll")}
                </button>
              ) : null}
            </div>
          ) : null}
        </OverlayStage>

        {lastWinner && !winner && !transparent ? (
          <p className="absolute bottom-2 start-3 z-30 flex items-center gap-2 text-xs text-muted-foreground">
            <Trophy className="size-3.5" aria-hidden />
            {t("giveaway.lastWinner")}: <span dir="auto">{lastWinner.username}</span> ({lastWinner.platform})
          </p>
        ) : null}
      </div>
    </section>
  );
}
