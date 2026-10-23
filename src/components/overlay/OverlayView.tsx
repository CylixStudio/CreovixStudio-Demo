import { useEffect, useId, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { Heart, Pause, Play } from "lucide-react";

import { formatDuration, type TimerFrame } from "@/lib/timer";
import { formatOverlayTime, withAlpha, type OverlayTheme } from "@/lib/overlayTheme";
import { useLanguage } from "@/lib/i18n";

const ANIMATION_CLASS: Record<OverlayTheme["animation"], string> = {
  none: "",
  pulse: "overlay-anim-pulse",
  flash: "overlay-anim-flash",
  bounce: "overlay-anim-bounce",
};

type Popup = { id: number; seconds: number };

/**
 * Fires whenever the remaining time jumps upward (a rule payout or a manual
 * add), which is what drives the overlay's "time added" animation.
 */
function useTimeAdded(remaining: number, enabled: boolean) {
  const previous = useRef<number | null>(null);
  const nextId = useRef(0);
  const [pulseKey, setPulseKey] = useState(0);
  const [popups, setPopups] = useState<Popup[]>([]);

  useEffect(() => {
    const prev = previous.current;
    previous.current = remaining;
    if (prev == null) return;
    const delta = remaining - prev;
    // Countdown ticks move down; only an increase means time was added.
    if (delta < 1) return;
    setPulseKey((key) => key + 1);
    if (!enabled) return;
    const id = nextId.current++;
    setPopups((current) => [...current, { id, seconds: Math.round(delta) }]);
    const timeout = setTimeout(
      () => setPopups((current) => current.filter((entry) => entry.id !== id)),
      1600,
    );
    return () => clearTimeout(timeout);
  }, [remaining, enabled]);

  return { pulseKey, popups };
}

export function OverlayView({
  theme,
  remaining,
  frame,
  scale = 1,
  milestoneCurrent = 0,
}: {
  theme: OverlayTheme;
  remaining: number;
  frame: TimerFrame | null;
  /** Shrinks the whole overlay for the dashboard preview pane. */
  scale?: number;
  /** Kept for call-site compatibility; the latest-supporter bar was removed. */
  lastSupporter?: { name: string; seconds: number; platform: string } | null;
  /** Subscriptions and gifted subscriptions accumulated in the current event window. */
  milestoneCurrent?: number;
}) {
  const { lang } = useLanguage();
  const gradientId = useId().replace(/:/g, "");
  const { pulseKey, popups } = useTimeAdded(remaining, theme.showAddedPopups);
  const animationClass = ANIMATION_CLASS[theme.animation];

  const timeText = formatOverlayTime(remaining, theme.timeFormat);
  const hideBg = theme.hideBackground;
  /** Card/capsule surface: fully transparent when the user hides the container. */
  const panelStyle: CSSProperties = hideBg
    ? { background: "transparent", border: "1px solid transparent", boxShadow: "none" }
    : {
        background: withAlpha(theme.backgroundColor, theme.backgroundOpacity),
        border: `1px solid ${withAlpha(theme.textColor, 18)}`,
      };
  void milestoneCurrent;
  const status = frame?.status ?? "IDLE";
  const statusText =
    lang === "ar"
      ? ({ IDLE: "جاهز", RUNNING: "مباشر", PAUSED: "متوقف مؤقتًا", ENDED: "انتهى" }[status] ??
        status)
      : status;
  const unitLabels =
    lang === "ar"
      ? { days: "أيام", hours: "ساعات", minutes: "دقائق", seconds: "ثوانٍ" }
      : { days: "DAYS", hours: "HOURS", minutes: "MINUTES", seconds: "SECONDS" };
  const units =
    theme.timeFormat === "dhms"
      ? (["days", "hours", "minutes", "seconds"] as const)
      : theme.timeFormat === "ms"
        ? (["minutes", "seconds"] as const)
        : (["hours", "minutes", "seconds"] as const);
  const segments = timeText.split(":").map((value, index) => ({
    value,
    unit: units[index]!,
    label: unitLabels[units[index]!],
  }));

  const timeStyle = {
    fontFamily: theme.fontFamily,
    fontSize: `${theme.fontSize}px`,
    lineHeight: 1.1,
    color: theme.textColor,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "0.02em",
    whiteSpace: "nowrap",
    fontFeatureSettings: '"tnum" 1',
    WebkitFontSmoothing: "antialiased",
    textRendering: "geometricPrecision",
  } as const;

  const labelStyle = {
    fontFamily: theme.fontFamily,
    fontSize: `${Math.max(10, Math.round(theme.fontSize * 0.2))}px`,
    color: theme.accentColor,
    letterSpacing: "0.35em",
    fontWeight: 700,
  } as const;

  const time = (
    <span key={pulseKey} dir="ltr" className={animationClass} style={timeStyle}>
      {timeText}
    </span>
  );

  const statusBadge = theme.showStatus ? (
    <span
      style={{
        fontFamily: theme.fontFamily,
        fontSize: `${Math.max(10, Math.round(theme.fontSize * 0.16))}px`,
        color: theme.accentColor,
        letterSpacing: "0.2em",
        fontWeight: 700,
      }}
    >
      {statusText}
    </span>
  ) : null;

  const textShadow = `0 2px 14px rgba(0,0,0,0.85), 0 0 22px ${withAlpha(theme.accentColor, 35)}`;

  const maxTime = frame?.maxTimeSeconds ?? remaining;
  const progress = maxTime > 0 ? Math.min(1, Math.max(0, remaining / maxTime)) : 1;
  const ringSize = Math.max(220, Math.round(theme.fontSize * 3));
  const strokeWidth = 10;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);
  const isRunning = (frame?.status ?? "IDLE") === "RUNNING";

  let body: ReactElement;
  if (["tower", "broadcast", "circular_pomodoro", "multi_ring_countdown"].includes(theme.layout)) {
    body = (
      <div
        className={`timer-refined timer-refined-${theme.layout}`}
        style={
          {
            ...panelStyle,
            color: theme.textColor,
            fontFamily: theme.fontFamily,
            "--timer-accent": theme.accentColor,
            "--timer-font": `${theme.fontSize}px`,
          } as import("react").CSSProperties
        }
      >
        <header>
          {theme.showLabel ? <span dir="auto">{theme.label}</span> : <span />}
          {statusBadge}
        </header>
        {theme.layout === "tower" ? (
          <div className="timer-tower-body">
            <div className="timer-tower-rail">
              <span style={{ height: `${progress * 100}%` }} />
            </div>
            <div className="timer-tower-units" dir="ltr">
              {segments.map((segment) => (
                <div key={segment.unit}>
                  <strong>{segment.value}</strong>
                  <small>{segment.label}</small>
                </div>
              ))}
            </div>
          </div>
        ) : theme.layout === "multi_ring_countdown" ? (
          <div key={pulseKey} className={`timer-time-rail ${animationClass}`} dir="ltr">
            {segments.map((segment, i) => (
              <div key={segment.unit}>
                <span className="timer-rail-dot" />
                <strong>{segment.value}</strong>
                <small>{segment.label}</small>
                {i < segments.length - 1 ? <span className="timer-rail-join" /> : null}
              </div>
            ))}
          </div>
        ) : theme.layout === "circular_pomodoro" ? (
          <div className="timer-dual-arc">
            <svg viewBox="0 0 360 250" aria-hidden>
              <path
                d="M40 180A140 140 0 0 1 320 180"
                fill="none"
                stroke={withAlpha(theme.accentColor, 15)}
                strokeWidth="5"
              />
              <path
                d="M40 180A140 140 0 0 1 320 180"
                fill="none"
                stroke={theme.accentColor}
                strokeWidth="5"
                pathLength="100"
                strokeDasharray={`${progress * 100} 100`}
                strokeLinecap="round"
              />
              <path
                d="M70 180A110 110 0 0 1 290 180"
                fill="none"
                stroke={withAlpha(theme.textColor, 12)}
                strokeWidth="1"
              />
            </svg>
            <div>
              <span key={pulseKey} className={animationClass} dir="ltr">
                {timeText}
              </span>
              <small>{lang === "ar" ? "الوقت المتبقي" : "TIME REMAINING"}</small>
            </div>
          </div>
        ) : (
          <div className="timer-broadcast-counter">
            <span className="timer-broadcast-label">
              {lang === "ar" ? "الوقت المتبقي" : "TIME REMAINING"}
            </span>
            <span dir="ltr">{time}</span>
            <span className="timer-broadcast-icon">
              {isRunning ? <Pause size={24} /> : <Play size={24} />}
            </span>
          </div>
        )}
        <footer>
          <span className="timer-refined-progress">
            <span style={{ width: `${progress * 100}%` }} />
          </span>
          {theme.showStatus ? (
            <span className="timer-status-dot" style={{ opacity: isRunning ? 1 : 0.4 }} />
          ) : null}
        </footer>
      </div>
    );
  } else if (theme.layout === "split_clock") {
    body = (
      <div
        className="space-y-4 p-3"
        style={{ color: theme.textColor, fontFamily: theme.fontFamily }}
      >
        <div className="flex items-center justify-between gap-6">
          {theme.showLabel ? (
            <span dir="auto" style={labelStyle}>
              {theme.label}
            </span>
          ) : null}
          {statusBadge}
        </div>
        <div key={pulseKey} className={`flex items-start gap-3 ${animationClass}`} dir="ltr">
          {segments.map((segment) => (
            <div key={segment.unit} className="flex flex-col items-center gap-3">
              <div
                className="relative isolate overflow-hidden rounded-lg px-4 py-4"
                style={{ ...panelStyle, boxShadow: hideBg ? "none" : "0 6px 0 rgba(0,0,0,.4)" }}
              >
                {!hideBg ? (
                  <span className="absolute inset-x-0 top-1/2 -z-10 h-px bg-black/70" />
                ) : null}
                <span style={{ ...timeStyle, lineHeight: 1 }}>{segment.value}</span>
                {!hideBg ? (
                  <>
                    <i className="absolute start-0 top-1/2 h-2 w-1 -translate-y-1/2 rounded-e bg-black/70" />
                    <i className="absolute end-0 top-1/2 h-2 w-1 -translate-y-1/2 rounded-s bg-black/70" />
                  </>
                ) : null}
              </div>
              <span style={{ ...labelStyle, letterSpacing: lang === "ar" ? 0 : "0.18em" }}>
                {segment.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (theme.layout === "tower") {
    body = (
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          ...panelStyle,
          color: theme.textColor,
          fontFamily: theme.fontFamily,
          minWidth: theme.fontSize * 2.6,
        }}
      >
        {!hideBg ? (
          <div
            className="absolute inset-y-0 start-0 w-1.5"
            style={{ background: theme.accentColor }}
          />
        ) : null}
        {theme.showLabel || theme.showStatus ? (
          <div className="flex flex-col gap-2 px-6 pb-3 pt-5">
            {theme.showLabel ? (
              <span
                dir="auto"
                style={{ ...labelStyle, letterSpacing: lang === "ar" ? 0 : "0.2em" }}
              >
                {theme.label}
              </span>
            ) : null}
            {statusBadge}
          </div>
        ) : null}
        <div key={pulseKey} className={animationClass}>
          {segments.map((segment, index) => (
            <div
              key={segment.unit}
              className="flex items-end justify-between gap-5 px-6 py-3"
              style={{
                borderTop: hideBg ? undefined : `1px solid ${withAlpha(theme.textColor, 9)}`,
              }}
            >
              <div className="flex flex-col gap-2 pb-1">
                <span
                  dir="ltr"
                  style={{
                    color: withAlpha(theme.accentColor, 70),
                    fontSize: 10,
                    letterSpacing: "0.1em",
                  }}
                >
                  0{index + 1}
                </span>
                <span style={{ ...labelStyle, letterSpacing: lang === "ar" ? 0 : "0.12em" }}>
                  {segment.label}
                </span>
              </div>
              <span
                dir="ltr"
                style={{ ...timeStyle, lineHeight: 1, fontSize: theme.fontSize * 0.85 }}
              >
                {segment.value}
              </span>
            </div>
          ))}
        </div>
        <div
          className="mx-6 mb-5 mt-3 h-1 overflow-hidden rounded-full"
          style={{ background: withAlpha(theme.accentColor, 15) }}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${progress * 100}%`, background: theme.accentColor }}
          />
        </div>
      </div>
    );
  } else if (theme.layout === "broadcast") {
    body = (
      <div
        className="flex items-stretch overflow-hidden rounded-2xl"
        style={{ ...panelStyle, color: theme.textColor, fontFamily: theme.fontFamily }}
      >
        <div
          className="flex flex-col justify-center gap-3 border-e border-white/15 px-6 py-5"
          style={{ background: hideBg ? "transparent" : withAlpha(theme.accentColor, 8) }}
        >
          <span className="h-1 w-10 rounded-full" style={{ background: theme.accentColor }} />
          {theme.showLabel ? <span style={labelStyle}>{theme.label}</span> : null}
          {statusBadge}
        </div>
        <div className="flex flex-col justify-center gap-3 px-7 py-5">
          <span dir="ltr">{time}</span>
          <div className="h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full"
              style={{ width: `${progress * 100}%`, background: theme.accentColor }}
            />
          </div>
        </div>
      </div>
    );
  } else if (theme.layout === "cute_heart") {
    body = (
      <div className="relative inline-block">
        <div
          className={`flex w-fit max-w-full items-center gap-4 rounded-full px-6 py-3 ${hideBg ? "" : "shadow-xl"}`}
          style={{ textShadow, ...panelStyle }}
        >
          <span
            dir="ltr"
            className="font-mono font-bold tracking-tight"
            style={{
              color: theme.textColor,
              fontSize: `${theme.fontSize}px`,
              lineHeight: 1.1,
              fontVariantNumeric: "tabular-nums",
              fontFeatureSettings: '"tnum" 1',
            }}
          >
            {timeText}
          </span>
        </div>
        <span className="absolute -top-2 -end-2 flex items-center justify-center rounded-full bg-white p-1.5 shadow-lg">
          <Heart
            className="size-5"
            style={{ color: theme.accentColor }}
            fill="currentColor"
            aria-hidden
          />
        </span>
      </div>
    );
  } else if (theme.layout === "circular_pomodoro") {
    body = (
      <div
        className={`flex flex-col items-center justify-center rounded-3xl p-6 ${hideBg ? "" : "shadow-2xl"}`}
        style={{ textShadow, ...panelStyle }}
      >
        <div className="relative" style={{ width: ringSize, height: ringSize }}>
          <svg
            width={ringSize}
            height={ringSize}
            viewBox={`0 0 ${ringSize} ${ringSize}`}
            className="-rotate-90"
            aria-label={lang === "ar" ? "تقدم المؤقت" : "Timer progress"}
          >
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={theme.accentColor} />
                <stop offset="100%" stopColor={withAlpha(theme.accentColor, 55)} />
              </linearGradient>
            </defs>
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.10)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 0.35s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {theme.showStatus ? (
              <span
                className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
                style={{ fontFamily: theme.fontFamily, color: theme.accentColor }}
              >
                <span
                  className="rounded-full"
                  style={{
                    width: 7,
                    height: 7,
                    background: isRunning ? "#22C55E" : theme.accentColor,
                    boxShadow: `0 0 10px ${isRunning ? "#22C55E" : theme.accentColor}`,
                  }}
                />
                {statusText}
              </span>
            ) : null}
            <span
              dir="ltr"
              key={pulseKey}
              className={animationClass}
              style={{
                fontSize: Math.min(theme.fontSize * 0.6, ringSize / (timeText.length * 0.65)),
                fontWeight: 700,
                color: theme.textColor,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontVariantNumeric: "tabular-nums",
                fontFeatureSettings: '"tnum" 1',
              }}
            >
              {timeText}
            </span>
            {theme.showLabel ? (
              <span
                className="mt-1 text-xs font-bold uppercase tracking-widest text-neutral-400"
                style={{ fontFamily: theme.fontFamily }}
              >
                {theme.label}
              </span>
            ) : null}
            <span className="mt-2 text-white/70">
              {isRunning ? (
                <Pause className="size-4" fill="currentColor" aria-hidden />
              ) : (
                <Play className="size-4" fill="currentColor" aria-hidden />
              )}
            </span>
          </div>
        </div>
      </div>
    );
  } else if (theme.layout === "multi_ring_countdown") {
    const ringSize = Math.max(76, Math.round(theme.fontSize * 1.45));
    const strokeWidth = 6;
    const radius = (ringSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    const rings = segments.map((segment, index) => {
      const fullUnit = segment.unit === "days" ? 86400 : segment.unit === "hours" ? 3600 : 60;
      const maximum =
        index === 0
          ? Math.max(1, Math.ceil((frame?.maxTimeSeconds ?? remaining) / fullUnit))
          : segment.unit === "hours"
            ? 24
            : 60;
      return { ...segment, progress: Math.min(1, Math.max(0, Number(segment.value) / maximum)) };
    });

    body = (
      <div className="flex flex-col gap-5 p-3" style={{ textShadow, fontFamily: theme.fontFamily }}>
        {theme.showLabel || theme.showStatus ? (
          <div className="flex items-center justify-between gap-6">
            {theme.showLabel ? (
              <span dir="auto" style={labelStyle}>
                {theme.label}
              </span>
            ) : null}
            {statusBadge}
          </div>
        ) : null}
        <div key={pulseKey} className={`flex gap-4 ${animationClass}`} dir="ltr">
          {rings.map((ring) => {
            const dashOffset = circumference * (1 - ring.progress);
            return (
              <div key={ring.unit} className="flex flex-col items-center gap-3">
                <div
                  className="relative rounded-full"
                  style={{ ...panelStyle, width: ringSize, height: ringSize }}
                >
                  <svg
                    width={ringSize}
                    height={ringSize}
                    viewBox={`0 0 ${ringSize} ${ringSize}`}
                    className="-rotate-90"
                    aria-label={ring.label}
                  >
                    <circle
                      cx={ringSize / 2}
                      cy={ringSize / 2}
                      r={radius}
                      fill="none"
                      stroke="rgba(255,255,255,0.10)"
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                    />
                    <circle
                      cx={ringSize / 2}
                      cy={ringSize / 2}
                      r={radius}
                      fill="none"
                      stroke={withAlpha(theme.accentColor, 100 - rings.indexOf(ring) * 15)}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                      style={{ transition: "stroke-dashoffset 0.35s ease" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span
                      className="font-bold"
                      style={{
                        color: theme.textColor,
                        fontFamily: theme.fontFamily,
                        fontSize: Math.min(
                          theme.fontSize * 0.55,
                          ringSize / (ring.value.length * 0.8),
                        ),
                        fontVariantNumeric: "tabular-nums",
                        fontFeatureSettings: '"tnum" 1',
                      }}
                    >
                      {ring.value}
                    </span>
                  </div>
                </div>
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400"
                  style={{
                    fontFamily: theme.fontFamily,
                    color: theme.accentColor,
                    letterSpacing: lang === "ar" ? 0 : "0.16em",
                  }}
                >
                  {ring.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  } else if (theme.layout === "raw_digits") {
    body = (
      <div className="bg-transparent p-0 shadow-none border-none" style={{ textShadow }}>
        <span
          dir="ltr"
          className="font-mono font-bold tracking-wider"
          style={{
            color: theme.textColor,
            fontFamily: theme.fontFamily,
            fontSize: `${theme.fontSize}px`,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
            fontFeatureSettings: '"tnum" 1',
            whiteSpace: "nowrap",
          }}
        >
          {timeText}
        </span>
      </div>
    );
  } else {
    body = (
      <div
        className={`flex w-fit max-w-full items-center gap-4 rounded-full px-6 py-2.5 ${hideBg ? "" : "backdrop-blur-md"}`}
        style={{
          textShadow,
          ...panelStyle,
          ...(hideBg
            ? {}
            : {
                boxShadow: `inset 0 1px 0 ${withAlpha(theme.textColor, 12)}, 0 18px 45px rgba(0,0,0,.48), 0 0 26px ${withAlpha(theme.accentColor, 18)}`,
              }),
        }}
      >
        <span
          className="overlay-live-dot shrink-0 rounded-full"
          style={{
            width: 10,
            height: 10,
            background: theme.accentColor,
            boxShadow: `0 0 14px ${theme.accentColor}`,
          }}
        />
        <div className="flex min-w-0 items-center gap-4">
          {theme.showLabel ? <span style={labelStyle}>{theme.label}</span> : null}
          <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{time}</span>
        </div>
        {statusBadge}
      </div>
    );
  }

  return (
    <div
      className="relative inline-block"
      data-layout-content
      data-timer-layout={theme.layout}
      dir={lang === "ar" ? "rtl" : "ltr"}
      style={scale === 1 ? undefined : { transform: `scale(${scale})`, transformOrigin: "center" }}
    >
      {body}
      <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2">
        {popups.map((popup) => (
          <div
            key={popup.id}
            className="overlay-float whitespace-nowrap"
            style={{
              fontFamily: theme.fontFamily,
              fontSize: `${Math.max(14, Math.round(theme.fontSize * 0.28))}px`,
              fontWeight: 700,
              color: theme.accentColor,
              textShadow: `0 0 18px ${withAlpha(theme.accentColor, 70)}`,
            }}
          >
            +{formatDuration(popup.seconds)}
          </div>
        ))}
      </div>
    </div>
  );
}
