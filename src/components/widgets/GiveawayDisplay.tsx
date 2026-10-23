import { useEffect, useState, type CSSProperties } from "react";
import { CheckCircle2, Expand, Minimize2, RotateCcw, Trophy, Users } from "lucide-react";
import { OverlayStage, hexToRgba } from "@/components/widgets/overlayKit";
import { PlatformIcon } from "@/components/widgets/PlatformIcon";
import { useLanguage } from "@/lib/i18n";
import type { GiveawayLayout } from "@/lib/giveawayLayouts";
import {
  giveawayAccountKey,
  giveawayRevealCandidates,
  giveawayRevealProgress,
  giveawayRevealSlot,
  parseGiveawayPresentation,
  parseGiveawayAppearance,
  type GiveawayPresentation,
} from "@/lib/giveawayPresentation";
import "./GiveawayDisplay.css";
import "./GiveawayReveal.css";

export type DrawPhase = "idle" | "shuffling" | "revealing" | "settled";
export type ClaimState = "pending" | "confirmed" | "expired";
export type GiveawayWinner = {
  username: string;
  platform: string;
  avatarUrl?: string | null | undefined;
};
export type GiveawayParticipant = GiveawayWinner & { id: string };
export const platformLabel = (platform: string) =>
  ({ KICK: "Kick", TWITCH: "Twitch", YOUTUBE: "YouTube", TIKTOK: "TikTok" })[
    platform.toUpperCase()
  ] ?? platform;

export function ParticipantAvatar({
  username,
  platform,
  avatarUrl,
  size,
  ringWidth = 2,
  badge = true,
}: GiveawayWinner & { size: number; ringWidth?: number; badge?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const usable =
    avatarUrl && /^https?:\/\//i.test(avatarUrl) && avatarUrl !== failedUrl ? avatarUrl : null;
  const color =
    { KICK: "#53fc18", TWITCH: "#a78bfa", YOUTUBE: "#fb7185", TIKTOK: "#67e8f9" }[
      platform.toUpperCase()
    ] ?? "#bee1fc";
  return (
    <span
      className="gw-account"
      style={{
        width: size,
        height: size,
        border: `${ringWidth}px solid ${color}`,
        fontSize: size * 0.4,
      }}
    >
      {usable ? (
        <img
          src={usable}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(usable)}
        />
      ) : (
        <bdi>{Array.from(username.trim().replace(/^[^\p{L}\p{N}]+/u, ""))[0] ?? "?"}</bdi>
      )}
      {badge ? (
        <span className="gw-account-platform">
          <PlatformIcon platform={platform} size={Math.max(12, size * 0.23)} />
        </span>
      ) : null}
    </span>
  );
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
  transparent = false,
  onToggleExpand,
  onReroll,
  presentation,
  revealStartedAt = null,
  duration = 5,
}: {
  participants: GiveawayParticipant[];
  winner: GiveawayWinner | null;
  phase: DrawPhase;
  claimState: ClaimState;
  claimLeft: number;
  keyword: string;
  lastWinner?: GiveawayWinner | null | undefined;
  expanded: boolean;
  /** Retained for old callers/imports; all saved layouts now use the single base face. */
  layout?: GiveawayLayout;
  transparent?: boolean;
  onToggleExpand?: (() => void) | undefined;
  onReroll?: (() => void) | undefined;
  presentation?: GiveawayPresentation | undefined;
  revealStartedAt?: string | null | undefined;
  duration?: number | undefined;
}) {
  const { lang, dir, t } = useLanguage();
  const settings = parseGiveawayPresentation(presentation);
  const appearance = parseGiveawayAppearance(settings.appearance);
  const [now, setNow] = useState(() => Date.now());
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const progress = giveawayRevealProgress(revealStartedAt, duration, now);
  const animating = Boolean(winner) && progress < 1;
  const winnerKey = winner ? giveawayAccountKey(winner) : "";
  useEffect(() => {
    if (
      !winnerKey ||
      !revealStartedAt ||
      giveawayRevealProgress(revealStartedAt, duration, Date.now()) >= 1
    )
      return;
    const tick = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (giveawayRevealProgress(revealStartedAt, duration, time) >= 1) window.clearInterval(tick);
    }, 40);
    return () => window.clearInterval(tick);
  }, [winnerKey, revealStartedAt, duration]);
  const found = participants.find(
    (p) => winner && giveawayAccountKey(p) === giveawayAccountKey(winner),
  );
  const chosen = winner
    ? {
        ...winner,
        id: found?.id ?? "selected-winner",
        avatarUrl: winner.avatarUrl ?? found?.avatarUrl,
      }
    : null;
  const candidates = giveawayRevealCandidates(participants, chosen);
  const selectedIndex = Math.max(
    0,
    candidates.findIndex((p) => chosen && giveawayAccountKey(p) === giveawayAccountKey(chosen)),
  );
  const stripSlot = giveawayRevealSlot(
    candidates.length,
    selectedIndex,
    reducedMotion && progress < 1 ? 0 : progress,
    settings.speed,
  );
  const lastSlot = giveawayRevealSlot(candidates.length, selectedIndex, 1, settings.speed);
  const focusedSlot = Math.round(stripSlot);
  const strip = candidates.length
    ? Array.from({ length: lastSlot + 2 }, (_, index) => candidates[index % candidates.length]!)
    : [];
  const focus = focusedSlot % Math.max(1, candidates.length);
  const focusAccount = candidates[focus];
  const showWinner = Boolean(chosen) && !animating && phase !== "idle" && phase !== "shuffling";
  const title = lang === "ar" ? "السحب المباشر" : "LIVE GIVEAWAY";
  const status =
    phase === "shuffling" || animating
      ? t("giveaway.shuffling")
      : showWinner
        ? t("giveaway.winnerSelected")
        : t("giveaway.liveEntries");

  return (
    <section
      className="gw-display flex h-full w-full min-w-0 flex-col"
      data-giveaway-animation={settings.animation}
      style={
        {
          fontFamily: appearance.fontFamily,
          "--gw-accent": appearance.accentColor,
          "--gw-text": appearance.textColor,
          "--gw-background": hexToRgba(
            appearance.backgroundColor,
            appearance.backgroundOpacity / 100,
          ),
          "--gw-name-size": `${appearance.fontSize}px`,
        } as CSSProperties
      }
    >
      {!transparent ? (
        <header className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          {status}
          {onToggleExpand ? (
            <button
              className="ms-auto"
              type="button"
              onClick={onToggleExpand}
              aria-label={expanded ? t("giveaway.collapse") : t("giveaway.expand")}
            >
              {expanded ? <Minimize2 size={16} /> : <Expand size={16} />}
            </button>
          ) : null}
        </header>
      ) : null}
      <div
        className={
          expanded || transparent ? "relative min-h-0 flex-1" : "relative aspect-video w-full"
        }
      >
        <OverlayStage mode="box" dir={dir} className="h-full w-full">
          <div className="gw-stage">
            <article
              className={`gw-panel ${showWinner ? "gw-is-winner" : ""}`}
              data-layout-content
              style={{ "--gw-progress": progress } as CSSProperties}
            >
              <header className="gw-heading">
                <span>{title}</span>
                <span>
                  <Users size={20} />
                  {participants.length.toLocaleString("en-US")}
                </span>
              </header>
              {showWinner && chosen ? (
                <div
                  className="gw-result"
                  role="status"
                  data-giveaway-winner={giveawayAccountKey(chosen)}
                >
                  <span className="gw-eyebrow">
                    <Trophy size={22} />
                    {t("overlay.giveaway.winner")}
                  </span>
                  <ParticipantAvatar {...chosen} size={124} />
                  <h2 dir="auto">{chosen.username}</h2>
                  <p className="gw-from">{platformLabel(chosen.platform)}</p>
                  {claimState === "pending" ? (
                    <div className="gw-claim">
                      <strong dir="ltr">
                        {Math.floor(Math.max(0, claimLeft) / 60)}:
                        {String(Math.max(0, claimLeft) % 60).padStart(2, "0")}
                      </strong>
                      <span>{t("giveaway.claimHint", { keyword })}</span>
                    </div>
                  ) : claimState === "confirmed" ? (
                    <p className="gw-confirmed">
                      <CheckCircle2 size={22} />
                      {t("giveaway.confirmed")}
                    </p>
                  ) : (
                    <div className="gw-claim">
                      <span>{lang === "ar" ? "انتهت مهلة التأكيد" : "Claim window expired"}</span>
                      {!transparent && onReroll ? (
                        <button type="button" onClick={onReroll}>
                          <RotateCcw size={20} />
                          {t("giveaway.reroll")}
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : animating && chosen ? (
                <div
                  className={`gw-animation gw-animation-${settings.animation}`}
                  aria-label={status}
                  data-reveal-progress={progress.toFixed(2)}
                >
                  <p className="gw-eyebrow">
                    {lang === "ar" ? "لحظة واحدة…" : "THE MOMENT IS YOURS"}
                  </p>
                  <div className="gw-carousel-window">
                    <div
                      className="gw-carousel-track"
                      style={{ transform: `translateX(${-stripSlot * 154}px)` }}
                      dir="ltr"
                    >
                      {strip.map((p, i) => (
                        <div key={i} className={focusedSlot === i ? "gw-focus" : ""}>
                          <ParticipantAvatar {...p} size={108} />
                          <bdi>{p.username}</bdi>
                        </div>
                      ))}
                    </div>
                    <span className="gw-carousel-cursor" />
                  </div>
                  <div className="gw-progress">
                    <span style={{ width: reducedMotion ? "0%" : `${progress * 100}%` }} />
                  </div>
                  <span className="gw-sr-only">{focusAccount?.username}</span>
                </div>
              ) : (
                <div className="gw-lobby">
                  <div className="gw-lobby-title">
                    <span className="gw-eyebrow">{status}</span>
                    <h2>{lang === "ar" ? "فرصتك تبدأ بكلمة" : "One word. Your chance."}</h2>
                    <p>{t("giveaway.joinHint", { keyword: keyword || "+1" })}</p>
                  </div>
                  <div className="gw-lobby-people">
                    {participants.slice(0, 12).map((p) => (
                      <div key={p.id}>
                        <ParticipantAvatar {...p} size={66} />
                        <bdi>{p.username}</bdi>
                      </div>
                    ))}
                  </div>
                  {participants.length > 12 ? (
                    <p className="gw-from">+{participants.length - 12}</p>
                  ) : null}
                </div>
              )}
              <footer className="gw-footer">
                <span>
                  {lang === "ar" ? "كلمة المشاركة" : "ENTRY KEYWORD"} <bdi>{keyword || "+1"}</bdi>
                </span>
                {lastWinner && !chosen ? (
                  <span>
                    {t("overlay.giveaway.winner")} <bdi>{lastWinner.username}</bdi>
                  </span>
                ) : (
                  <span>CYLIXSTUDIO</span>
                )}
              </footer>
            </article>
          </div>
        </OverlayStage>
      </div>
    </section>
  );
}
