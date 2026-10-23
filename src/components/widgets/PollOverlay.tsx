import { useEffect, useRef, useState, type CSSProperties } from "react";

import {
  OverlayMotionStyles,
  OverlayStage,
  fontScale,
  formatClock,
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
import { parsePollConfig, type PollLayout } from "@/lib/widgets";

const OPTION_COLORS = ["#38bdf8", "#34d399", "#fbbf24", "#fb7185", "#a78bfa", "#2dd4bf"];
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const latinCount = (value: number) => Math.round(value).toLocaleString("en-US");

function Percent({ value }: { value: number }) {
  const shown = useTween(value, 800);
  return <span dir="ltr">{latinCount(shown)}%</span>;
}

function Count({ value }: { value: number }) {
  const shown = useTween(value, 800);
  return <span dir="ltr">{latinCount(shown)}</span>;
}

function PollResults({
  layout,
  options,
  shares,
  percents,
  focus,
  open,
  accent,
  muted,
  leadingLabel,
  winnerLabel,
  scale,
}: {
  layout: PollLayout;
  options: PollRuntime["options"];
  shares: number[];
  percents: number[];
  focus: number;
  open: boolean;
  accent: string;
  muted: string;
  leadingLabel: string;
  winnerLabel: string;
  scale: number;
}) {
  const px = (n: number) => Math.round(n * scale);
  const donut = layout === "donut";
  const ballot = layout === "ballot";
  const split = layout === "split";
  const total = options.reduce((sum, option) => sum + option.votes, 0);
  const circumference = 2 * Math.PI * 84;
  let offset = 0;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: donut
          ? "300px minmax(0, 1fr)"
          : split
            ? "repeat(2, minmax(0, 1fr))"
            : "1fr",
        gap: 24,
        alignItems: "center",
        marginTop: 30,
      }}
    >
      {donut ? (
        <div style={{ position: "relative", width: 300, height: 300 }} dir="ltr">
          <svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden>
            <circle
              cx="100"
              cy="100"
              r="84"
              fill="none"
              stroke="rgba(255,255,255,.08)"
              strokeWidth="22"
            />
            {options.map((option, index) => {
              const share = shares[index] ?? 0;
              const start = offset;
              offset += share;
              return (
                <circle
                  key={option.id}
                  cx="100"
                  cy="100"
                  r="84"
                  fill="none"
                  stroke={OPTION_COLORS[index % OPTION_COLORS.length]}
                  strokeWidth={focus === index ? 26 : 22}
                  strokeDasharray={`${(share * circumference) / 100} ${circumference}`}
                  strokeDashoffset={(-start * circumference) / 100}
                  transform="rotate(-90 100 100)"
                />
              );
            })}
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeContent: "center",
              textAlign: "center",
            }}
          >
            <strong style={{ fontSize: px(48), color: accent }}>
              <Count value={total} />
            </strong>
            <span style={{ fontSize: px(16), color: muted }}>Σ</span>
          </div>
        </div>
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: ballot || split ? "repeat(2, minmax(0, 1fr))" : "1fr",
          gap: ballot ? 18 : 12,
          gridColumn: split ? "1 / -1" : undefined,
        }}
      >
        {options.map((option, index) => {
          const color = donut ? OPTION_COLORS[index % OPTION_COLORS.length] : accent;
          const focused = focus === index;
          return (
            <div
              key={option.id}
              style={{
                position: "relative",
                overflow: "hidden",
                minWidth: 0,
                display: "grid",
                gridTemplateColumns: ballot
                  ? "48px minmax(0, 1fr)"
                  : split
                    ? "1fr"
                    : "48px minmax(0, 1fr) auto",
                alignItems: "center",
                gap: 16,
                padding: ballot ? 24 : split ? "22px 26px" : "16px 12px",
                borderRadius: ballot ? 4 : split ? 20 : 0,
                border:
                  ballot || split
                    ? `1px solid ${hexToRgba(color ?? accent, focused ? 0.65 : 0.16)}`
                    : undefined,
                borderBottom: !ballot && !split ? "1px solid rgba(255,255,255,.12)" : undefined,
                background: ballot
                  ? "rgba(255,255,255,.035)"
                  : split
                    ? `linear-gradient(90deg, ${hexToRgba(accent, 0.12)}, transparent)`
                    : undefined,
                opacity: !open && focus >= 0 && !focused ? 0.48 : 1,
              }}
            >
              {!split ? (
                <span
                  dir="ltr"
                  style={{
                    width: 42,
                    height: 42,
                    display: "grid",
                    placeItems: "center",
                    border: ballot
                      ? `2px solid ${hexToRgba(accent, focused ? 0.8 : 0.25)}`
                      : undefined,
                    borderRadius: ballot ? 8 : 99,
                    color: color,
                    fontSize: px(24),
                    fontWeight: 800,
                  }}
                >
                  {ballot && focused ? "✓" : String(index + 1).padStart(2, "0")}
                </span>
              ) : null}
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    fontSize: px(ballot ? 25 : 28),
                    fontWeight: 700,
                    overflowWrap: "anywhere",
                  }}
                >
                  <bdi>{option.label}</bdi>
                </p>
                <span style={{ fontSize: px(17), color: muted }}>
                  <Count value={option.votes} />
                </span>
                {focused ? (
                  <span style={{ marginInlineStart: 12, color, fontSize: px(14), fontWeight: 800 }}>
                    {open ? leadingLabel : winnerLabel}
                  </span>
                ) : null}
                {!ballot ? (
                  <div
                    style={{
                      marginTop: 10,
                      height: split ? 3 : 6,
                      background: "rgba(255,255,255,.06)",
                      borderRadius: 99,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${shares[index] ?? 0}%`,
                        background: color,
                        borderRadius: 99,
                        transition: `width 900ms ${EASE}`,
                      }}
                    />
                  </div>
                ) : null}
              </div>
              <strong
                style={{
                  fontSize: px(split ? 64 : ballot ? 40 : 34),
                  color: focused ? color : undefined,
                  gridColumn: ballot ? "2" : undefined,
                  lineHeight: 1.1,
                }}
              >
                <Percent value={percents[index] ?? 0} />
              </strong>
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const fit = useFitHeight(parsed.layout === "compact" ? 620 : 1020);
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
  const compact = parsed.layout === "compact";
  const cards = parsed.layout === "cards";
  const columns = parsed.layout === "columns";
  const editorial = ["ballot", "leaderboard", "donut", "split"].includes(parsed.layout);

  const card: CSSProperties = {
    width: compact
      ? 720
      : editorial
        ? 1120
        : cards
          ? 1180
          : columns
            ? 1260
            : Math.round(960 + (Math.min(scale, 1.25) - 1) * 360),
    maxWidth: "100%",
    boxSizing: "border-box",
    padding: `${px(compact ? 22 : 36)}px ${px(compact ? 24 : 40)}px ${px(compact ? 20 : 32)}px`,
    borderRadius: compact ? 24 : 32,
    color: text,
    fontFamily: parsed.fontFamily,
    background: hexToRgba(
      editorial && parsed.backgroundColor === "#1A1B23" ? "#0a0a0a" : parsed.backgroundColor,
      parsed.backgroundOpacity / 100,
    ),
    border: "2px solid rgba(255,255,255,0.12)",
    boxShadow: "0 32px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
    backdropFilter: "blur(22px)",
  };

  return (
    <OverlayStage {...stageProps}>
      <OverlayMotionStyles />
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        <div style={{ transform: `scale(${fit.scale})`, transformOrigin: "center" }}>
          <div
            data-layout-content
            ref={fit.ref}
            className={leaving ? "cxo-out" : "cxo-in"}
            style={card}
          >
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

            {editorial ? (
              <PollResults
                layout={parsed.layout}
                options={shown.options}
                shares={exact}
                percents={whole}
                focus={focusIndex}
                open={open}
                accent={accent}
                muted={muted}
                leadingLabel={t("overlay.poll.leading")}
                winnerLabel={t("overlay.poll.winner")}
                scale={scale}
              />
            ) : (
              <div
                style={{
                  marginTop: px(compact ? 18 : 30),
                  display: cards || columns ? "grid" : "flex",
                  gridTemplateColumns: cards
                    ? "repeat(2, minmax(0, 1fr))"
                    : columns
                      ? `repeat(${Math.min(count, 6)}, minmax(0, 1fr))`
                      : undefined,
                  flexDirection: cards || columns ? undefined : "column",
                  alignItems: compact ? "stretch" : undefined,
                  gap: px(compact ? 8 : cards ? 16 : columns ? 10 : 14),
                }}
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
                  if (compact) {
                    return (
                      <div
                        key={option.id}
                        className={!open && focused ? "cxo-pop" : undefined}
                        style={{
                          padding: `${px(10)}px ${px(14)}px`,
                          borderRadius: 14,
                          border: `1px solid ${focused ? hexToRgba(color, 0.65) : "rgba(255,255,255,0.08)"}`,
                          background: focused ? hexToRgba(color, 0.12) : "rgba(255,255,255,0.035)",
                          opacity: faded && !open ? 0.52 : 1,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span
                            style={{
                              minWidth: 0,
                              flex: 1,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: px(22),
                              fontWeight: 700,
                            }}
                          >
                            <bdi>{option.label}</bdi>
                          </span>
                          {tag ? (
                            <span style={{ color, fontSize: px(13), fontWeight: 800 }}>{tag}</span>
                          ) : null}
                          <span style={{ color: muted, fontSize: px(14) }}>
                            <Count value={option.votes} />
                          </span>
                          <span
                            style={{
                              color: focused ? color : text,
                              fontSize: px(23),
                              fontWeight: 800,
                            }}
                          >
                            <Percent value={whole[index] ?? 0} />
                          </span>
                        </div>
                        <div
                          style={{
                            marginTop: 8,
                            height: 6,
                            borderRadius: 99,
                            overflow: "hidden",
                            background: "rgba(255,255,255,.09)",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${option.votes > 0 ? Math.max(share, 1.5) : 0}%`,
                              background: color,
                              transition: `width 900ms ${EASE}`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  }
                  if (cards) {
                    return (
                      <div
                        key={option.id}
                        className={!open && focused ? "cxo-pop" : undefined}
                        style={{
                          minWidth: 0,
                          padding: `${px(18)}px ${px(20)}px`,
                          borderRadius: 22,
                          border: `2px solid ${focused ? hexToRgba(color, 0.65) : "rgba(255,255,255,0.08)"}`,
                          background: focused ? hexToRgba(color, 0.12) : "rgba(255,255,255,0.04)",
                          opacity: faded && !open ? 0.5 : 1,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, color }}>
                          <span style={{ fontSize: px(16), fontWeight: 800 }}>
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          {tag ? (
                            <span
                              style={{
                                marginInlineStart: "auto",
                                fontSize: px(13),
                                fontWeight: 800,
                              }}
                            >
                              {tag}
                            </span>
                          ) : null}
                        </div>
                        <p
                          style={{
                            marginTop: px(12),
                            minHeight: px(54),
                            fontSize: px(24),
                            fontWeight: 750,
                            lineHeight: 1.15,
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          <bdi>{option.label}</bdi>
                        </p>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            justifyContent: "space-between",
                            gap: 8,
                            marginTop: px(10),
                          }}
                        >
                          <span
                            style={{
                              color: focused ? color : text,
                              fontSize: px(40),
                              lineHeight: 1,
                              fontWeight: 850,
                            }}
                          >
                            <Percent value={whole[index] ?? 0} />
                          </span>
                          <span style={{ color: muted, fontSize: px(15) }}>
                            {t("overlay.poll.totalVotes", { n: latinCount(option.votes) })}
                          </span>
                        </div>
                        <div
                          style={{
                            marginTop: px(14),
                            height: px(8),
                            borderRadius: 99,
                            background: "rgba(255,255,255,.1)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${option.votes > 0 ? Math.max(share, 1.5) : 0}%`,
                              background: color,
                              transition: `width 900ms ${EASE}`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  }
                  if (columns) {
                    return (
                      <div
                        key={option.id}
                        className={!open && focused ? "cxo-pop" : undefined}
                        style={{
                          minWidth: 0,
                          minHeight: px(290),
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          textAlign: "center",
                          padding: `${px(14)}px ${px(10)}px`,
                          borderRadius: 20,
                          border: `1px solid ${focused ? hexToRgba(color, 0.6) : "rgba(255,255,255,.08)"}`,
                          background: focused ? hexToRgba(color, 0.1) : "rgba(255,255,255,.035)",
                          opacity: faded && !open ? 0.5 : 1,
                        }}
                      >
                        <div
                          style={{
                            alignSelf: "stretch",
                            height: 7,
                            borderRadius: 99,
                            background: color,
                            opacity: option.votes > 0 ? 1 : 0.22,
                          }}
                        />
                        {tag ? (
                          <span
                            style={{ marginTop: px(12), color, fontSize: px(13), fontWeight: 800 }}
                          >
                            {tag}
                          </span>
                        ) : (
                          <span style={{ height: px(28) }} />
                        )}
                        <span
                          style={{
                            marginTop: px(12),
                            fontSize: px(39),
                            lineHeight: 1,
                            fontWeight: 850,
                            color: focused ? color : text,
                          }}
                        >
                          <Percent value={whole[index] ?? 0} />
                        </span>
                        <span
                          style={{
                            flex: 1,
                            display: "grid",
                            placeItems: "center",
                            marginTop: px(14),
                            fontSize: px(17),
                            fontWeight: 700,
                            lineHeight: 1.2,
                            overflowWrap: "anywhere",
                          }}
                        >
                          <bdi>{option.label}</bdi>
                        </span>
                        <span style={{ marginTop: px(12), color: muted, fontSize: px(14) }}>
                          {t("overlay.poll.totalVotes", { n: latinCount(option.votes) })}
                        </span>
                      </div>
                    );
                  }
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
            )}

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
                ? t("overlay.poll.totalVotes", { n: latinCount(total) })
                : t("overlay.poll.noVotes")}
            </p>
          </div>
        </div>
      </div>
    </OverlayStage>
  );
}
