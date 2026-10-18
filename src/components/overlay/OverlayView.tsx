import { useEffect, useRef, useState, type ReactElement } from "react";
import { Heart, Pause, Play } from "lucide-react";

import { formatDuration, type TimerFrame } from "@/lib/timer";
import { formatOverlayTime, withAlpha, type OverlayTheme } from "@/lib/overlayTheme";

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
  const { pulseKey, popups } = useTimeAdded(remaining, theme.showAddedPopups);
  const animationClass = ANIMATION_CLASS[theme.animation];

  const timeText = formatOverlayTime(remaining, theme.timeFormat);
  const hideBg = theme.hideBackground;
  /** Card/capsule surface: fully transparent when the user hides the container. */
  const panelStyle = hideBg
    ? { background: "transparent", border: "1px solid transparent", boxShadow: "none" }
    : {
        background: withAlpha(theme.backgroundColor, theme.backgroundOpacity),
        border: `1px solid ${withAlpha(theme.textColor, 18)}`,
      };
  const cap = frame?.maxTimeSeconds ?? null;
  void cap;
  void milestoneCurrent;

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
    <span key={pulseKey} className={animationClass} style={timeStyle}>
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
      {frame?.status ?? "IDLE"}
    </span>
  ) : null;

  const textShadow = `0 2px 14px rgba(0,0,0,0.85), 0 0 22px ${withAlpha(theme.accentColor, 35)}`;

  const maxTime = frame?.maxTimeSeconds ?? remaining;
  const progress = maxTime > 0 ? Math.min(1, Math.max(0, remaining / maxTime)) : 1;
  const ringSize = 220;
  const strokeWidth = 10;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);
  const isRunning = (frame?.status ?? "IDLE") === "RUNNING";

  let body: ReactElement;
  if (theme.layout === "cute_heart") {
    body = (
      <div className="relative inline-block">
        <div
          className={`flex w-fit max-w-full items-center gap-4 rounded-full px-6 py-3 ${hideBg ? "" : "shadow-xl"}`}
          style={{ textShadow, ...panelStyle }}
        >
          <span
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
          <Heart className="size-5" style={{ color: theme.accentColor }} fill="currentColor" aria-hidden />
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
            aria-label="Timer progress"
          >
            <defs>
              <linearGradient id="circular-pomodoro-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
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
              stroke="url(#circular-pomodoro-gradient)"
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
                {frame?.status ?? "IDLE"}
              </span>
            ) : null}
            <span
              className="font-mono text-3xl font-bold"
              style={{
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
            ) : (
              <span
                className="mt-1 text-xs font-bold uppercase tracking-widest text-neutral-400"
                style={{ fontFamily: theme.fontFamily }}
              >
                SUBATHON
              </span>
            )}
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
  const ringSize = 90;
  const strokeWidth = 6;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const totalSeconds = Math.max(0, remaining);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const maxDays =
    frame?.maxTimeSeconds && frame.maxTimeSeconds > 0
      ? Math.max(1, Math.ceil(frame.maxTimeSeconds / 86400))
      : Math.max(1, days);

  const rings = [
    { label: "DAYS", value: days, progress: Math.min(1, Math.max(0, days / maxDays)) },
    { label: "HOURS", value: hours, progress: hours / 24 },
    { label: "MINUTES", value: minutes, progress: minutes / 60 },
    { label: "SECONDS", value: seconds, progress: seconds / 60 },
  ];

  body = (
    <div
      className={`flex items-center justify-center rounded-2xl p-6 ${hideBg ? "" : "backdrop-blur-md"}`}
      style={{ textShadow, ...panelStyle }}
    >
      <div className="flex gap-4">
        {rings.map((ring) => {
          const dashOffset = circumference * (1 - ring.progress);
          return (
            <div key={ring.label} className="flex flex-col items-center gap-2">
              <div className="relative" style={{ width: ringSize, height: ringSize }}>
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
                    stroke={theme.accentColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    style={{ transition: "stroke-dashoffset 0.35s ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="text-2xl font-bold"
                    style={{
                      color: theme.textColor,
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      fontVariantNumeric: "tabular-nums",
                      fontFeatureSettings: '"tnum" 1',
                    }}
                  >
                    {String(ring.value).padStart(2, "0")}
                  </span>
                </div>
              </div>
              <span
                className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400"
                style={{ fontFamily: theme.fontFamily }}
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
    <div
      className="bg-transparent p-0 shadow-none border-none"
      style={{ textShadow }}
    >
      <span
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
