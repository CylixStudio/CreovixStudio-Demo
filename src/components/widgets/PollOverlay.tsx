import { useEffect, useRef, useState, type CSSProperties } from "react";

import {
  OverlayMotionStyles,
  OverlayStage,
  fontScale,
  formatClock,
  formatCount,
  hexToRgba,
  usePresence,
  useFitHeight,
  useTween,
  wholePercents,
} from "@/components/widgets/overlayKit";
import { useLiveChat, type ChatSources } from "@/hooks/useLiveChat";
import {
  pollCardVisible,
  preferNewer,
  sharePercents,
  type PollRuntime,
} from "@/lib/interactiveWidgets";
import { useLanguage } from "@/lib/i18n";
import { parsePollConfig } from "@/lib/widgets";

const OPTION_COLORS = ["#38bdf8", "#34d399", "#fbbf24", "#fb7185", "#a78bfa", "#2dd4bf"];
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

function Percent({ value }: { value: number }) {
  const shown = useTween(value, 800);
  return <span dir="ltr">{Math.round(shown)}%</span>;
}

function Count({ value }: { value: number }) {
  const shown = useTween(value, 800);
  return <span dir="ltr">{formatCount(shown)}</span>;
}

export function PollOverlay({
  config,
  runtime,
  chat = null,
  demo = false,
}: {
  config: unknown;
  runtime: PollRuntime | null;
  chat?: ChatSources | null;
  demo?: boolean;
}) {
  const { t, dir } = useLanguage();
  const parsed = parsePollConfig(config);
  const { kickPoll } = useLiveChat(chat, 1);
  const live = preferNewer(runtime, kickPoll);
  const [now, setNow] = useState(() => Date.now());
  const visible = pollCardVisible(live, now);
  const lastLive = useRef<PollRuntime | null>(null);
  if (visible && live) lastLive.current = live;
  const { mounted, leaving } = usePresence(visible && Boolean(live));
  const fit = useFitHeight(1020);
  const shown = visible && live ? live : lastLive.current;

  useEffect(() => {
    if (!live?.endsAt && !live?.hideAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [live?.endsAt, live?.hideAt, live?.status]);

  const stageProps = {
    mode: demo ? ("box" as const) : ("viewport" as const),
    dir,
    className: demo ? "w-full aspect-video" : "",
  };

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
            {t("widget.poll.idle")}
          </p>
        </div>
      </OverlayStage>
    );
  }

  const open = shown.status === "open";
  const count = shown.options.length;
  const density = count <= 3 ? 1 : count === 4 ? 0.92 : count === 5 ? 0.82 : 0.74;
  const scale =
    (count > 4 ? Math.min(fontScale(parsed.fontSize), 1.1) : fontScale(parsed.fontSize)) * density;
  const px = (n: number) => Math.round(n * scale);
  const text = parsed.textColor;
  const muted = hexToRgba(text, 0.62);
  const accent = parsed.accentColor;

  const counts = shown.options.map((option) => option.votes);
  const total = counts.reduce((sum, value) => sum + value, 0);
  const exact = sharePercents(counts);
  const whole = wholePercents(counts);
  const top = Math.max(0, ...counts);
  const leaders = counts.filter((value) => value === top).length;
  const leaderIndex = top > 0 && leaders === 1 ? counts.indexOf(top) : -1;
  const winnerById =
    shown.winnerId != null ? shown.options.findIndex((option) => option.id === shown.winnerId) : -1;
  const winnerIndex = !open ? (winnerById >= 0 ? winnerById : leaderIndex) : -1;
  const focusIndex = open ? leaderIndex : winnerIndex;
  const remaining =
    open && shown.endsAt ? Math.max(0, Math.ceil((Date.parse(shown.endsAt) - now) / 1000)) : 0;

  const card: CSSProperties = {
    width: Math.round(960 + (Math.min(scale, 1.25) - 1) * 360),
    boxSizing: "border-box",
    padding: `${px(36)}px ${px(40)}px ${px(32)}px`,
    borderRadius: 32,
    color: text,
    fontFamily: parsed.fontFamily,
    background: hexToRgba(parsed.backgroundColor, parsed.backgroundOpacity / 100),
    border: "2px solid rgba(255,255,255,0.12)",
    boxShadow: "0 32px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
    backdropFilter: "blur(22px)",
  };

  return (
    <OverlayStage {...stageProps}>
      <OverlayMotionStyles />
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        <div style={{ transform: `scale(${fit.scale})`, transformOrigin: "center" }}>
          <div ref={fit.ref} className={leaving ? "cxo-out" : "cxo-in"} style={card}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 32,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p
                  style={{
                    fontSize: px(20),
                    fontWeight: 700,
                    letterSpacing: "0.18em",
                    color: accent,
                    textTransform: "uppercase",
                  }}
                >
                  {t("overlay.poll.badge")}
                </p>
                <h2
                  style={{
                    marginTop: px(8),
                    fontSize: px(44),
                    lineHeight: 1.25,
                    fontWeight: 800,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  <bdi>{shown.title || t("widget.poll.heading")}</bdi>
                </h2>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  flexShrink: 0,
                  padding: `${px(10)}px ${px(22)}px`,
                  borderRadius: 999,
                  fontSize: px(24),
                  fontWeight: 700,
                  background: open ? hexToRgba(accent, 0.14) : "rgba(255,255,255,0.08)",
                  border: `2px solid ${open ? hexToRgba(accent, 0.45) : "rgba(255,255,255,0.14)"}`,
                  color: open ? accent : muted,
                  transition: `background 400ms ${EASE}, border-color 400ms ${EASE}, color 400ms ${EASE}`,
                }}
              >
                <span
                  className={open ? "cxo-dot" : undefined}
                  style={{
                    width: px(14),
                    height: px(14),
                    borderRadius: 999,
                    background: open ? accent : muted,
                    boxShadow: open ? `0 0 14px ${hexToRgba(accent, 0.8)}` : "none",
                  }}
                />
                <span>{open ? t("widget.poll.live") : t("widget.poll.ended")}</span>
                {open && shown.endsAt ? (
                  <span dir="ltr" style={{ fontVariantNumeric: "tabular-nums", color: text }}>
                    {formatClock(remaining)}
                  </span>
                ) : null}
              </div>
            </div>

            <div
              style={{ marginTop: px(30), display: "flex", flexDirection: "column", gap: px(14) }}
            >
              {shown.options.map((option, index) => {
                const color = OPTION_COLORS[index % OPTION_COLORS.length] ?? "#38bdf8";
                const focused = index === focusIndex;
                const faded = focusIndex >= 0 && !focused;
                const share = exact[index] ?? 0;
                const tag = focused
                  ? open
                    ? t("overlay.poll.leading")
                    : t("overlay.poll.winner")
                  : null;
                return (
                  <div
                    key={option.id}
                    className={!open && focused ? "cxo-pop" : undefined}
                    style={{
                      position: "relative",
                      padding: `${px(16)}px ${px(22)}px ${px(18)}px`,
                      borderRadius: 22,
                      border: `2px solid ${focused ? hexToRgba(color, 0.6) : "transparent"}`,
                      background: focused ? hexToRgba(color, 0.12) : "rgba(255,255,255,0.04)",
                      boxShadow: focused ? `0 0 36px ${hexToRgba(color, 0.22)}` : "none",
                      opacity: faded ? (open ? 0.82 : 0.5) : 1,
                      transition: `opacity 600ms ${EASE}, background 600ms ${EASE}, border-color 600ms ${EASE}, box-shadow 600ms ${EASE}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: px(18) }}>
                      <span
                        style={{
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                          width: px(46),
                          height: px(46),
                          borderRadius: 999,
                          fontSize: px(24),
                          fontWeight: 800,
                          color: "#0a0a0a",
                          background: color,
                        }}
                      >
                        {index + 1}
                      </span>
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
                        <bdi>{option.label}</bdi>
                      </span>
                      {tag ? (
                        <span
                          style={{
                            flexShrink: 0,
                            padding: `${px(4)}px ${px(14)}px`,
                            borderRadius: 999,
                            fontSize: px(19),
                            fontWeight: 800,
                            letterSpacing: "0.04em",
                            color: "#0a0a0a",
                            background: color,
                          }}
                        >
                          {!open ? "★ " : ""}
                          {tag}
                        </span>
                      ) : null}
                      <span
                        style={{
                          flexShrink: 0,
                          fontSize: px(24),
                          fontWeight: 600,
                          color: muted,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        <Count value={option.votes} />
                      </span>
                      <span
                        style={{
                          flexShrink: 0,
                          minWidth: px(132),
                          textAlign: "end",
                          fontSize: px(52),
                          lineHeight: 1,
                          fontWeight: 800,
                          fontVariantNumeric: "tabular-nums",
                          color: focused ? color : text,
                        }}
                      >
                        <Percent value={whole[index] ?? 0} />
                      </span>
                    </div>
                    <div
                      style={{
                        position: "relative",
                        marginTop: px(14),
                        height: px(16),
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.1)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        className={focused && open ? "cxo-sheen" : undefined}
                        style={{
                          position: "relative",
                          height: "100%",
                          width: `${option.votes > 0 ? Math.max(share, 1.5) : 0}%`,
                          borderRadius: 999,
                          overflow: "hidden",
                          background: `linear-gradient(90deg, ${hexToRgba(color, 0.75)}, ${color})`,
                          boxShadow: focused ? `0 0 20px ${hexToRgba(color, 0.55)}` : "none",
                          transition: `width 900ms ${EASE}`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <p
              style={{
                marginTop: px(22),
                fontSize: px(22),
                fontWeight: 600,
                color: muted,
                textAlign: "end",
              }}
            >
              {total > 0
                ? t("overlay.poll.totalVotes", { n: formatCount(total) })
                : t("overlay.poll.noVotes")}
            </p>
          </div>
        </div>
      </div>
    </OverlayStage>
  );
}
