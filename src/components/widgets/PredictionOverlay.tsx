import { useEffect, useRef, useState, type CSSProperties } from "react";

import {
  OverlayMotionStyles,
  OverlayStage,
  fontScale,
  formatClock,
  formatCount,
  hexToRgba,
  usePresence,
  useTween,
  wholePercents,
} from "@/components/widgets/overlayKit";
import { useLiveChat, type ChatSources } from "@/hooks/useLiveChat";
import {
  predictionCardVisible,
  preferNewer,
  sharePercents,
  type PredictionRuntime,
} from "@/lib/interactiveWidgets";
import { useLanguage } from "@/lib/i18n";
import { parsePredictionConfig } from "@/lib/widgets";
import { ParticleClashOverlay } from "@/components/widgets/ParticleClashOverlay";

const GREEN = "#00c70f";
const RED = "#ff2b2b";
const AMBER = "#fbbf24";
const DOT_SLOTS = 5;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

function Percent({ value }: { value: number }) {
  const shown = useTween(value, 800);
  return <span dir="ltr">{Math.round(shown)}%</span>;
}

/** Kick-style strength dots: one lit dot per 20% share, never fewer than one. */
function Dots({ share, color, size }: { share: number; color: string; size: number }) {
  const lit = Math.max(1, Math.min(DOT_SLOTS, Math.ceil(share / 20)));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.7 }} dir="ltr">
      {Array.from({ length: DOT_SLOTS }, (_, index) => {
        const on = index < lit;
        return (
          <span
            key={index}
            style={{
              width: size,
              height: size,
              borderRadius: 999,
              background: on ? color : hexToRgba(color, 0.16),
              boxShadow: on ? `0 0 ${size}px ${hexToRgba(color, 0.7)}` : "none",
              transform: on ? "scale(1)" : "scale(0.78)",
              transition: `background 500ms ${EASE}, box-shadow 500ms ${EASE}, transform 500ms ${EASE}`,
              transitionDelay: `${index * 45}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

export function PredictionOverlay({
  config,
  runtime,
  chat = null,
  demo = false,
}: {
  config: unknown;
  runtime: PredictionRuntime | null;
  chat?: ChatSources | null;
  demo?: boolean;
}) {
  const { t, dir } = useLanguage();
  const parsed = parsePredictionConfig(config);
  const { kickPrediction } = useLiveChat(chat, 1);
  const live = preferNewer(runtime, kickPrediction);
  const [now, setNow] = useState(() => Date.now());
  const visible = predictionCardVisible(live, now);
  const lastLive = useRef<PredictionRuntime | null>(null);
  if (visible && live) lastLive.current = live;
  const { mounted, leaving } = usePresence(visible && Boolean(live));
  const shown = visible && live ? live : lastLive.current;

  useEffect(() => {
    if (parsed.layout === "particle-clash" || (!live?.endsAt && !live?.hideAt)) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [live?.endsAt, live?.hideAt, live?.status, parsed.layout]);

  const stageProps = {
    mode: demo ? ("box" as const) : ("viewport" as const),
    dir,
    className: demo ? "w-full aspect-video" : "",
  };

  if (parsed.layout === "particle-clash") {
    return <ParticleClashOverlay config={parsed} runtime={live} preview={demo} />;
  }

  if (!mounted || !shown) {
    if (!demo) return null;
    return (
      <OverlayStage {...stageProps}>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <p
            style={{
              padding: "20px 36px",
              borderRadius: 999,
              fontSize: 30,
              color: "#bee1fc",
              background: "rgba(0,0,0,0.55)",
              border: "2px solid rgba(255,255,255,0.14)",
              fontFamily: parsed.fontFamily,
            }}
          >
            {t("widget.prediction.idle")}
          </p>
        </div>
      </OverlayStage>
    );
  }

  const open = shown.status === "open";
  const locked = shown.status === "locked";
  const resolved = shown.status === "resolved";
  const outcomes = shown.outcomes.slice(0, 2);
  const points = outcomes.map((outcome) => outcome.points);
  const totalPoints = points.reduce((sum, value) => sum + value, 0);
  const strength = sharePercents(points);
  const whole = wholePercents(points);
  const winnerIndex =
    resolved && shown.winnerId != null
      ? outcomes.findIndex((outcome) => outcome.id === shown.winnerId)
      : -1;
  const remaining =
    open && shown.endsAt ? Math.max(0, Math.ceil((Date.parse(shown.endsAt) - now) / 1000)) : 0;

  const scale = fontScale(parsed.fontSize);
  const px = (n: number) => Math.round(n * scale);
  const text = parsed.textColor;
  const muted = hexToRgba(text, 0.62);
  const accent = parsed.accentColor;
  const sides = [
    { color: GREEN, outcome: outcomes[0] },
    { color: RED, outcome: outcomes[1] },
  ] as const;

  const statusColor = open ? GREEN : locked ? AMBER : accent;
  const statusLabel = open
    ? t("widget.prediction.open")
    : locked
      ? t("widget.prediction.locked")
      : t("widget.prediction.resolved");

  const card: CSSProperties = {
    width: 1480,
    boxSizing: "border-box",
    padding: `${px(28)}px ${px(40)}px ${px(30)}px`,
    borderRadius: 32,
    color: text,
    fontFamily: parsed.fontFamily,
    background: hexToRgba(parsed.backgroundColor, Math.max(parsed.backgroundOpacity, 55) / 100),
    border: "2px solid rgba(255,255,255,0.12)",
    boxShadow: "0 28px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
    backdropFilter: "blur(22px)",
  };

  return (
    <OverlayStage {...stageProps}>
      <OverlayMotionStyles />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 56,
        }}
      >
        <div className={leaving ? "cxo-out" : "cxo-in"} style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <div style={{ minWidth: 0, flex: 1, display: "flex", alignItems: "baseline", gap: 24 }}>
              <span
                style={{
                  flexShrink: 0,
                  fontSize: px(20),
                  fontWeight: 800,
                  letterSpacing: "0.18em",
                  color: accent,
                  textTransform: "uppercase",
                }}
              >
                {t("overlay.prediction.badge")}
              </span>
              <h2
                style={{
                  minWidth: 0,
                  fontSize: px(38),
                  lineHeight: 1.2,
                  fontWeight: 800,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <bdi>{shown.title || t("widget.prediction.heading")}</bdi>
              </h2>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                flexShrink: 0,
                padding: `${px(8)}px ${px(22)}px`,
                borderRadius: 999,
                fontSize: px(24),
                fontWeight: 700,
                color: statusColor,
                background: hexToRgba(statusColor, 0.14),
                border: `2px solid ${hexToRgba(statusColor, 0.45)}`,
                transition: `background 400ms ${EASE}, border-color 400ms ${EASE}, color 400ms ${EASE}`,
              }}
            >
              <span
                className={open ? "cxo-dot" : undefined}
                style={{
                  width: px(14),
                  height: px(14),
                  borderRadius: 999,
                  background: statusColor,
                  boxShadow: `0 0 14px ${hexToRgba(statusColor, 0.8)}`,
                }}
              />
              <span>{statusLabel}</span>
              {open && shown.endsAt ? (
                <span dir="ltr" style={{ fontVariantNumeric: "tabular-nums", color: text }}>
                  {formatClock(remaining)}
                </span>
              ) : null}
            </div>
          </div>

          <div style={{ marginTop: px(22), display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
            {sides.map(({ color, outcome }, index) => {
              const won = winnerIndex === index;
              const lost = winnerIndex >= 0 && !won;
              return (
                <div
                  key={index}
                  className={won ? "cxo-pop" : undefined}
                  style={{
                    padding: `${px(18)}px ${px(26)}px ${px(20)}px`,
                    borderRadius: 24,
                    background: hexToRgba(color, won ? 0.2 : 0.09),
                    border: `2px solid ${hexToRgba(color, won ? 0.75 : 0.28)}`,
                    boxShadow: won ? `0 0 44px ${hexToRgba(color, 0.32)}` : "none",
                    opacity: lost ? 0.42 : 1,
                    filter: lost ? "saturate(0.35)" : "none",
                    transition: `opacity 700ms ${EASE}, filter 700ms ${EASE}, background 700ms ${EASE}, border-color 700ms ${EASE}, box-shadow 700ms ${EASE}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: px(34),
                        fontWeight: 700,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <bdi>{outcome?.label ?? ""}</bdi>
                    </span>
                    {won ? (
                      <span
                        style={{
                          flexShrink: 0,
                          padding: `${px(4)}px ${px(14)}px`,
                          borderRadius: 999,
                          fontSize: px(19),
                          fontWeight: 800,
                          color: "#0a0a0a",
                          background: color,
                        }}
                      >
                        ★ {t("widget.prediction.winner")}
                      </span>
                    ) : null}
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: px(64),
                        lineHeight: 1,
                        fontWeight: 800,
                        fontVariantNumeric: "tabular-nums",
                        color,
                      }}
                    >
                      <Percent value={whole[index] ?? 0} />
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: px(14),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 18,
                    }}
                  >
                    <Dots share={strength[index] ?? 0} color={color} size={px(17)} />
                    <span
                      style={{
                        fontSize: px(23),
                        fontWeight: 600,
                        color: muted,
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {outcome
                        ? `${t("overlay.prediction.points", { n: formatCount(outcome.points) })} · ${t("overlay.prediction.voters", { n: formatCount(outcome.voters) })}`
                        : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: px(22),
              display: "flex",
              gap: 8,
              height: px(16),
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            {sides.map(({ color }, index) => {
              const share = totalPoints > 0 ? (strength[index] ?? 0) : 50;
              const lost = winnerIndex >= 0 && winnerIndex !== index;
              return (
                <div
                  key={index}
                  style={{
                    width: `${share}%`,
                    minWidth: totalPoints > 0 && share === 0 ? 0 : 6,
                    borderRadius: 999,
                    background:
                      totalPoints > 0
                        ? `linear-gradient(90deg, ${hexToRgba(color, 0.7)}, ${color})`
                        : "rgba(255,255,255,0.14)",
                    opacity: lost ? 0.35 : 1,
                    boxShadow: totalPoints > 0 && !lost ? `0 0 18px ${hexToRgba(color, 0.45)}` : "none",
                    transition: `width 900ms ${EASE}, opacity 700ms ${EASE}`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </OverlayStage>
  );
}
