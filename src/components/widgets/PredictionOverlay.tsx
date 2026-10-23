import { useEffect, useRef, useState, type CSSProperties } from "react";

import {
  OverlayMotionStyles,
  OverlayStage,
  fontScale,
  formatClock,
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
import { VotingResultsFace } from "@/components/widgets/VotingResultsFace";

const GREEN = "#00c70f";
const RED = "#ff2b2b";
const AMBER = "#fbbf24";
const DOT_SLOTS = 5;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const latinCount = (value: number) => Math.round(value).toLocaleString("en-US");

function Percent({ value }: { value: number }) {
  const shown = useTween(value, 800);
  return <span dir="ltr">{latinCount(shown)}%</span>;
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
  const compact = parsed.layout === "compact";
  const split = parsed.layout === "split";

  const card: CSSProperties = {
    width: compact ? 680 : split ? 1160 : 1480,
    maxWidth: "100%",
    boxSizing: "border-box",
    padding: `${px(compact ? 18 : 28)}px ${px(compact ? 22 : 40)}px ${px(compact ? 20 : 30)}px`,
    borderRadius: compact ? 24 : 32,
    color: text,
    fontFamily: parsed.fontFamily,
    background: hexToRgba(parsed.backgroundColor, Math.max(parsed.backgroundOpacity, 55) / 100),
    border: "2px solid rgba(255,255,255,0.12)",
    boxShadow: "0 28px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
    backdropFilter: "blur(22px)",
  };

  if (["classic", "split", "ribbon", "odds"].includes(parsed.layout))
    return (
      <OverlayStage {...stageProps}>
        <OverlayMotionStyles />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            padding: 64,
          }}
        >
          <VotingResultsFace
            family="prediction"
            layout={parsed.layout}
            title={shown.title || t("widget.prediction.heading")}
            options={outcomes.map((option, index) => ({
              id: option.id,
              label: option.label,
              value: option.points,
              voters: option.voters,
              percent: whole[index] ?? 0,
            }))}
            focus={winnerIndex}
            open={open}
            remaining={remaining}
            accent={accent}
            color={text}
            background={hexToRgba(
              parsed.backgroundColor === "#1A1B23" ? "#101216" : parsed.backgroundColor,
              parsed.backgroundOpacity / 100,
            )}
            fontFamily={parsed.fontFamily}
            fontSize={parsed.fontSize}
            leaving={leaving}
          />
        </div>
      </OverlayStage>
    );
  if (["scoreboard", "duel"].includes(parsed.layout)) {
    const ribbon = parsed.layout === "ribbon";
    const duel = parsed.layout === "duel";
    const odds = parsed.layout === "odds";
    return (
      <OverlayStage {...stageProps}>
        <OverlayMotionStyles />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: ribbon ? "end center" : "center",
            padding: 48,
          }}
        >
          <section
            data-layout-content
            className={leaving ? "cxo-out" : "cxo-in"}
            style={{
              ...card,
              width: ribbon ? 1600 : odds ? 1000 : 1240,
              padding: ribbon ? 26 : 36,
              borderRadius: ribbon ? 8 : duel ? 0 : 28,
              borderTop: duel ? `3px solid ${accent}` : card.border,
              background: hexToRgba(
                parsed.backgroundColor === "#1A1B23" ? "#0a0a0a" : parsed.backgroundColor,
                Math.max(parsed.backgroundOpacity, 72) / 100,
              ),
            }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                paddingBottom: 22,
                borderBottom: "1px solid rgba(255,255,255,.12)",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p
                  style={{
                    fontSize: px(16),
                    color: accent,
                    letterSpacing: ".16em",
                    fontWeight: 800,
                  }}
                >
                  {t("overlay.prediction.badge")}
                </p>
                <h2
                  style={{
                    fontSize: px(ribbon ? 28 : 38),
                    fontWeight: 800,
                    overflowWrap: "anywhere",
                  }}
                >
                  <bdi>{shown.title || t("widget.prediction.heading")}</bdi>
                </h2>
              </div>
              <div
                style={{ color: statusColor, fontSize: px(20), fontWeight: 700, textAlign: "end" }}
              >
                <span>{statusLabel}</span>
                {open && shown.endsAt ? (
                  <p dir="ltr" style={{ color: text, fontVariantNumeric: "tabular-nums" }}>
                    {formatClock(remaining)}
                  </p>
                ) : null}
              </div>
            </header>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: ribbon
                  ? "1fr"
                  : duel
                    ? "1fr 80px 1fr"
                    : "repeat(2, minmax(0, 1fr))",
                gap: ribbon ? 10 : 24,
                marginTop: 24,
                alignItems: "stretch",
              }}
            >
              {sides.map(({ outcome, color }, index) => {
                const won = winnerIndex === index;
                const lost = winnerIndex >= 0 && !won;
                const share = strength[index] ?? 0;
                return (
                  <div
                    key={outcome?.id ?? index}
                    style={{
                      gridColumn: duel ? (index === 0 ? "1" : "3") : undefined,
                      gridRow: duel ? 1 : undefined,
                      position: "relative",
                      minWidth: 0,
                      overflow: "hidden",
                      display: ribbon ? "grid" : "flex",
                      gridTemplateColumns: ribbon ? "minmax(0, 1fr) 100px 300px" : undefined,
                      flexDirection: "column",
                      alignItems: ribbon ? "center" : "stretch",
                      padding: ribbon ? "14px 20px" : duel ? "32px 24px" : 24,
                      borderRadius: odds ? 24 : ribbon ? 4 : 0,
                      border: odds ? `1px solid ${hexToRgba(color, 0.3)}` : undefined,
                      borderInlineStart: ribbon ? `4px solid ${color}` : undefined,
                      background: duel
                        ? `linear-gradient(180deg, ${hexToRgba(color, 0.14)}, transparent)`
                        : "rgba(255,255,255,.025)",
                      opacity: lost ? 0.4 : 1,
                      textAlign: ribbon ? "start" : "center",
                    }}
                  >
                    <h3
                      style={{
                        fontSize: px(duel ? 34 : 26),
                        fontWeight: 750,
                        overflowWrap: "anywhere",
                      }}
                    >
                      <bdi>{outcome?.label ?? ""}</bdi>
                    </h3>
                    {odds ? (
                      <div
                        style={{
                          position: "relative",
                          width: 220,
                          height: 220,
                          margin: "22px auto",
                        }}
                        dir="ltr"
                      >
                        <svg viewBox="0 0 160 160" width="100%" height="100%" aria-hidden>
                          <circle
                            cx="80"
                            cy="80"
                            r="66"
                            fill="none"
                            stroke="rgba(255,255,255,.08)"
                            strokeWidth="8"
                          />
                          {share > 0 ? (
                            <circle
                              cx="80"
                              cy="80"
                              r="66"
                              fill="none"
                              stroke={color}
                              strokeWidth="8"
                              strokeLinecap="round"
                              strokeDasharray={`${share * 4.1469} 414.69`}
                              transform="rotate(-90 80 80)"
                            />
                          ) : null}
                        </svg>
                        <strong
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "grid",
                            placeItems: "center",
                            color,
                            fontSize: px(52),
                          }}
                        >
                          <Percent value={whole[index] ?? 0} />
                        </strong>
                      </div>
                    ) : (
                      <strong
                        style={{
                          color,
                          fontSize: px(ribbon ? 32 : duel ? 88 : 112),
                          fontWeight: 850,
                          lineHeight: 1.3,
                          marginTop: ribbon ? 0 : 18,
                        }}
                      >
                        <Percent value={whole[index] ?? 0} />
                      </strong>
                    )}
                    <div
                      style={{
                        marginTop: ribbon ? 0 : "auto",
                        color: muted,
                        fontSize: px(ribbon ? 16 : 19),
                      }}
                    >
                      {outcome ? (
                        <>
                          <span>
                            {t("overlay.prediction.points", { n: latinCount(outcome.points) })}
                          </span>
                          <span style={{ marginInlineStart: 16 }}>
                            {t("overlay.prediction.voters", { n: latinCount(outcome.voters) })}
                          </span>
                        </>
                      ) : null}
                    </div>
                    {won ? (
                      <p style={{ marginTop: 12, color, fontSize: px(18), fontWeight: 800 }}>
                        ★ {t("widget.prediction.winner")}
                      </p>
                    ) : null}
                    {!odds ? (
                      <div
                        style={{
                          gridColumn: ribbon ? "1 / -1" : undefined,
                          height: duel ? 8 : 4,
                          marginTop: 18,
                          background: "rgba(255,255,255,.08)",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${share}%`,
                            background: color,
                            transition: `width 900ms ${EASE}`,
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {duel ? (
                <div
                  dir="ltr"
                  style={{
                    gridColumn: 2,
                    gridRow: 1,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 24,
                    fontWeight: 850,
                    color: accent,
                  }}
                >
                  VS
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </OverlayStage>
    );
  }

  return (
    <OverlayStage {...stageProps}>
      <OverlayMotionStyles />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: compact ? "center" : "flex-end",
          justifyContent: "center",
          padding: compact ? 16 : "0 24px 56px",
        }}
      >
        <div data-layout-content className={leaving ? "cxo-out" : "cxo-in"} style={card}>
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

          <div
            style={{
              marginTop: px(compact ? 14 : 22),
              display: compact ? "flex" : "grid",
              flexDirection: compact ? "column" : undefined,
              gridTemplateColumns: compact ? undefined : "1fr 1fr",
              gap: px(compact ? 8 : split ? 18 : 28),
            }}
          >
            {sides.map(({ color, outcome }, index) => {
              const won = winnerIndex === index;
              const lost = winnerIndex >= 0 && !won;
              return (
                <div
                  key={index}
                  className={won ? "cxo-pop" : undefined}
                  style={{
                    minWidth: 0,
                    padding: compact
                      ? `${px(10)}px ${px(14)}px`
                      : `${px(split ? 26 : 18)}px ${px(split ? 24 : 26)}px ${px(split ? 28 : 20)}px`,
                    borderRadius: compact ? 16 : 24,
                    background: hexToRgba(color, won ? 0.2 : 0.09),
                    border: `2px solid ${hexToRgba(color, won ? 0.75 : 0.28)}`,
                    boxShadow: won ? `0 0 44px ${hexToRgba(color, 0.32)}` : "none",
                    opacity: lost ? 0.42 : 1,
                    filter: lost ? "saturate(0.35)" : "none",
                    transition: `opacity 700ms ${EASE}, filter 700ms ${EASE}, background 700ms ${EASE}, border-color 700ms ${EASE}, box-shadow 700ms ${EASE}`,
                    display: compact ? "grid" : split ? "flex" : "block",
                    flexDirection: split ? "column" : undefined,
                    justifyContent: split ? "center" : undefined,
                    alignItems: compact || split ? "center" : undefined,
                    textAlign: split ? "center" : undefined,
                    minHeight: split ? px(220) : undefined,
                    gridTemplateColumns: compact ? "minmax(0, 1fr) auto" : undefined,
                    gap: compact ? px(10) : undefined,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: split ? "column" : "row",
                      alignItems: "center",
                      gap: px(compact ? 8 : split ? 14 : 18),
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        flex: split ? undefined : 1,
                        minWidth: 0,
                        fontSize: px(compact ? 22 : split ? 30 : 34),
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
                        fontSize: px(compact ? 32 : split ? 58 : 64),
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
                      marginTop: compact ? 0 : px(split ? 22 : 14),
                      gridColumn: compact ? "1 / -1" : undefined,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: px(compact ? 8 : 18),
                      flexDirection: compact ? "row-reverse" : split ? "column" : undefined,
                    }}
                  >
                    <Dots share={strength[index] ?? 0} color={color} size={px(compact ? 7 : 17)} />
                    <span
                      style={{
                        fontSize: px(compact ? 13 : split ? 20 : 23),
                        fontWeight: 600,
                        color: muted,
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {outcome
                        ? `${t("overlay.prediction.points", { n: latinCount(outcome.points) })} · ${t("overlay.prediction.voters", { n: latinCount(outcome.voters) })}`
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
                    boxShadow:
                      totalPoints > 0 && !lost ? `0 0 18px ${hexToRgba(color, 0.45)}` : "none",
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
