import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";
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
  const isRunning = (frame?.status ?? "IDLE") === "RUNNING";

  let body: ReactElement;
  if (["tower", "broadcast", "split_clock", "multi_ring_countdown"].includes(theme.layout)) {
    const units = (
      <div className="premium-timer-units" dir="ltr">
        {segments.map((segment) => (
          <div key={segment.unit}>
            <strong>{segment.value}</strong>
            <small>{segment.label}</small>
          </div>
        ))}
      </div>
    );
    body = (
      <div
        className={`premium-timer premium-timer-${theme.layout}`}
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
        {theme.layout === "multi_ring_countdown" ? (
          <>
            <header>
              {theme.showLabel ? <span dir="auto">{theme.label}</span> : null}
              {statusBadge}
            </header>
            <div className="premium-timer-cinema" key={pulseKey}>
              <span className={animationClass} dir="ltr">
                {timeText}
              </span>
              <span className="premium-timer-scan" aria-hidden />
            </div>
            <footer>
              <span>{lang === "ar" ? "الوقت المتبقي" : "TIME REMAINING"}</span>
              <span
                className="premium-timer-film"
                style={
                  { "--timer-progress": `${progress * 100}%` } as import("react").CSSProperties
                }
              />
            </footer>
          </>
        ) : theme.layout === "tower" ? (
          <>
            <aside>
              <span className="premium-timer-signal">
                {isRunning ? <Pause size={21} /> : <Play size={21} />}
              </span>
              {statusBadge}
            </aside>
            <div>
              <header>{theme.showLabel ? <span dir="auto">{theme.label}</span> : null}</header>
              {units}
              <div className="premium-timer-meter">
                <span style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          </>
        ) : theme.layout === "split_clock" ? (
          <>
            <header>
              {theme.showLabel ? <span dir="auto">{theme.label}</span> : null}
              {statusBadge}
            </header>
            <div className="premium-timer-milestone">
              {time}
              <span className="premium-timer-remaining">{Math.round(progress * 100)}%</span>
            </div>
            <div className="premium-timer-stations" aria-hidden>
              {[0, 25, 50, 75, 100].map((step) => (
                <span key={step} className={progress * 100 >= step ? "is-reached" : ""}>
                  <i />
                  {step}%
                </span>
              ))}
            </div>
          </>
        ) : (
          <>
            <span className="premium-timer-minimal-rule" />
            <div>
              {theme.showLabel ? <span dir="auto">{theme.label}</span> : null}
              <div className="premium-timer-minimal-time">{time}</div>
              {statusBadge}
            </div>
          </>
        )}
      </div>
    );
  } else if (theme.layout === "circular_pomodoro") {
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
      style={
        ["tower", "broadcast", "split_clock", "multi_ring_countdown"].includes(theme.layout)
          ? {
              maxWidth: "calc(100vw - 56px)",
              ...(scale === 1 ? {} : { transform: `scale(${scale})`, transformOrigin: "center" }),
            }
          : scale === 1
            ? undefined
            : { transform: `scale(${scale})`, transformOrigin: "center" }
      }
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
