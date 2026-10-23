import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock3 } from "lucide-react";

import {
  formatCountdown,
  formatUptime,
  resolveStreamSchedule,
  type StreamEventsRuntime,
} from "@/lib/streamEventsSchedule";
import { parseStreamEventsScheduleConfig } from "@/lib/widgets";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { chromeLayoutClass, parseChromeLayout } from "@/lib/widgetLayouts";

/**
 * OBS / hub glass card for the smart broadcast events schedule.
 */
export function StreamEventsScheduleCard({
  config,
  runtime,
  demo = false,
  onPrevious,
  onNext,
  showNav = false,
  compact = false,
}: {
  config: unknown;
  runtime?: StreamEventsRuntime | null;
  demo?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  showNav?: boolean;
  compact?: boolean;
}) {
  const { t, dir } = useLanguage();
  const style = parseStreamEventsScheduleConfig(config);
  const [now, setNow] = useState(() => Date.now());

  const effectiveRuntime: StreamEventsRuntime = useMemo(() => {
    if (runtime?.startedAt) return runtime;
    if (demo) {
      return {
        startedAt: new Date(Date.now() - 7 * 60_000).toISOString(),
        bonusElapsedSeconds: 0,
        revision: 0,
      };
    }
    return runtime ?? { startedAt: null, bonusElapsedSeconds: 0, revision: 0 };
  }, [runtime, demo]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const snapshot = useMemo(
    () => resolveStreamSchedule(style.events, effectiveRuntime, now),
    [style.events, effectiveRuntime, now],
  );

  const badge =
    snapshot.status === "waiting"
      ? t("scheduleCard.standby")
      : snapshot.status === "finished"
        ? t("scheduleCard.done")
        : snapshot.phase === "up_next"
          ? t("scheduleCard.upNext")
          : t("scheduleCard.onStream");

  const eventTitle =
    snapshot.status === "active"
      ? snapshot.current.title
      : snapshot.status === "finished"
        ? t("scheduleCard.complete")
        : t("scheduleCard.waiting");

  const countdown =
    snapshot.status === "active"
      ? formatCountdown(snapshot.remainingSeconds)
      : snapshot.status === "waiting"
        ? "--:--"
        : "0:00";

  const urgency = snapshot.status === "active" ? snapshot.urgency : "calm";
  const uptimeSeconds = snapshot.status === "waiting" ? 0 : snapshot.streamElapsedSeconds;
  const activeIndex =
    snapshot.status === "active"
      ? snapshot.index
      : snapshot.status === "finished"
        ? style.events.length
        : -1;
  const cumulativeStarts = style.events.map((_, index) =>
    style.events.slice(0, index).reduce((sum, event) => sum + event.durationSeconds, 0),
  );

  const chrome = parseChromeLayout(config);
  if (style.layout !== "direct" && style.layout !== "timeline") {
    const agenda = style.layout === "agenda";
    const calendar = style.layout === "calendar";
    const bold = style.layout === "bold";
    const roadmap = style.layout === "roadmap";
    const spotlight = style.layout === "spotlight";
    const glass = style.layout === "glass";
    const currentColor =
      urgency === "critical" ? "#fb7185" : urgency === "warn" ? "#fcd34d" : style.accentColor;
    const clock = (
      <span
        dir="ltr"
        className={cn(
          "font-mono font-bold tabular-nums",
          urgency === "critical" && "animate-pulse",
        )}
        style={{
          color: currentColor,
          fontSize: `${Math.max(24, Math.round(style.fontSize * (bold ? 1.8 : spotlight ? 1.5 : 1.1)))}px`,
        }}
      >
        {countdown}
      </span>
    );
    return (
      <section
        data-layout-content
        dir={dir}
        data-schedule-layout={style.layout}
        className={cn(
          "w-full overflow-hidden border border-white/10 text-zinc-100",
          bold ? "border-t-4" : "rounded-2xl",
          glass ? "bg-[#0a0a0a]/75 backdrop-blur-2xl" : "bg-[#0a0a0a]",
          compact ? "p-3" : "p-4",
        )}
        style={{
          fontFamily: style.fontFamily,
          borderTopColor: bold ? style.accentColor : undefined,
        }}
      >
        <header className="flex min-w-0 items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-sm font-semibold" dir="auto">
            {style.title}
          </h2>
          <span
            className="shrink-0 text-[0.55rem] font-bold uppercase tracking-widest"
            style={{ color: style.accentColor }}
          >
            {badge}
          </span>
        </header>

        {!agenda && !calendar && !roadmap ? (
          <div
            className={cn(
              "my-4",
              glass && "rounded-xl border border-white/10 bg-white/[0.04] p-4",
              bold && "flex flex-col border-b border-white/20 pb-4",
              spotlight && "flex flex-col items-center text-center",
            )}
          >
            {spotlight ? (
              <div
                className="mb-3 grid size-36 place-items-center rounded-full border-[3px] shadow-[0_0_35px_rgba(190,225,252,.06)]"
                style={{ borderColor: currentColor }}
              >
                {clock}
              </div>
            ) : (
              <div
                className={cn("flex items-center justify-between gap-3", bold && "order-2 mt-2")}
              >
                {clock}
                {glass ? <Clock3 className="size-6 text-white/20" aria-hidden /> : null}
              </div>
            )}
            <p
              className={cn(
                "break-words font-semibold",
                bold ? "text-2xl font-black leading-tight" : "mt-2 text-base",
              )}
              dir="auto"
            >
              {eventTitle}
            </p>
            {snapshot.status === "active" && snapshot.next ? (
              <p className="mt-2 text-xs text-zinc-500" dir="auto">
                {t("scheduleCard.next", { title: snapshot.next.title })}
              </p>
            ) : null}
          </div>
        ) : null}

        <div
          className={cn(
            "mt-4",
            calendar
              ? "grid grid-cols-2 gap-2"
              : glass
                ? "flex gap-2 overflow-x-auto pb-2"
                : spotlight
                  ? "flex flex-wrap justify-center gap-1.5"
                  : roadmap
                    ? "relative space-y-4 py-2"
                    : "space-y-0",
          )}
        >
          {roadmap ? (
            <div className="absolute inset-y-2 start-1/2 w-px bg-white/10" aria-hidden />
          ) : null}
          {style.events.map((event, index) => {
            const current = index === activeIndex;
            const passed = activeIndex > index;
            return (
              <div
                key={event.id}
                className={cn(
                  "relative min-w-0",
                  calendar
                    ? "flex min-h-32 flex-col rounded-lg border p-3"
                    : agenda
                      ? "grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 border-b border-white/[.07] py-3"
                      : bold
                        ? "flex items-center gap-3 border-b border-white/10 py-3"
                        : roadmap
                          ? "w-[calc(50%-10px)] rounded-xl border p-3"
                          : spotlight
                            ? "max-w-full rounded-full border px-3 py-1.5 text-xs"
                            : "flex w-28 shrink-0 flex-col rounded-lg border p-3",
                  passed && "opacity-40",
                  roadmap && (index % 2 === 0 ? "me-auto" : "ms-auto"),
                )}
                style={{
                  borderColor: current ? style.accentColor : "rgba(255,255,255,.1)",
                  background: current ? "rgba(190,225,252,.06)" : undefined,
                }}
              >
                {agenda ? (
                  <span dir="ltr" className="pt-1 font-mono text-xs tabular-nums text-zinc-500">
                    {formatCountdown(cumulativeStarts[index] ?? 0)}
                  </span>
                ) : null}
                {!agenda && !spotlight ? (
                  <span
                    dir="ltr"
                    className={cn(
                      "font-mono font-bold tabular-nums",
                      bold ? "w-9 shrink-0 text-3xl" : "mb-2 text-xs",
                    )}
                    style={{ color: current ? style.accentColor : "#71717a" }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                ) : null}
                <div
                  className={cn("min-w-0", bold && "flex-1", calendar && "flex flex-1 flex-col")}
                >
                  <p
                    dir="auto"
                    className={cn(
                      "break-words font-semibold",
                      bold
                        ? "text-base"
                        : spotlight
                          ? "truncate text-[0.65rem]"
                          : "text-xs leading-relaxed",
                    )}
                  >
                    {event.title}
                  </p>
                  {!spotlight ? (
                    <div
                      className={cn(
                        "mt-2 flex flex-wrap items-center justify-between gap-1",
                        calendar && "mt-auto pt-3",
                      )}
                    >
                      <span
                        dir="ltr"
                        className="font-mono text-[0.6rem] tabular-nums text-zinc-500"
                      >
                        {calendar || roadmap
                          ? `${formatCountdown(cumulativeStarts[index] ?? 0)} · `
                          : ""}
                        {formatCountdown(event.durationSeconds)}
                      </span>
                      {current ? (
                        <span
                          className="text-[0.5rem] font-bold uppercase"
                          style={{ color: style.accentColor }}
                        >
                          {badge}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {current && (agenda || calendar || roadmap) ? (
                    <div className="mt-1">{clock}</div>
                  ) : null}
                </div>
                {roadmap ? (
                  <span
                    className={cn(
                      "absolute top-5 size-2 rounded-full",
                      index % 2 === 0 ? "-end-[15px]" : "-start-[15px]",
                    )}
                    style={{
                      background: current ? style.accentColor : passed ? "#71717a" : "#27272a",
                    }}
                    aria-hidden
                  />
                ) : null}
              </div>
            );
          })}
        </div>
        {(agenda || calendar || roadmap) && snapshot.status !== "active" ? (
          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="text-sm text-zinc-400" dir="auto">
              {eventTitle}
            </p>
            {clock}
          </div>
        ) : null}
        <footer className="mt-4 flex items-center justify-between gap-2 border-t border-white/[.06] pt-3">
          <span className="flex items-center gap-2 text-[0.55rem] uppercase tracking-widest text-zinc-500">
            <span
              className="size-1.5 rounded-full"
              style={{
                background: effectiveRuntime.startedAt || demo ? style.accentColor : "#52525b",
              }}
            />
            {t("scheduleCard.live")}
            {style.showUptime ? (
              <span dir="ltr" className="font-mono normal-case tabular-nums tracking-normal">
                {formatUptime(uptimeSeconds)}
              </span>
            ) : null}
          </span>
          {showNav ? (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={onPrevious}
                aria-label={dir === "rtl" ? "الفعالية السابقة" : "Previous event"}
                className="rounded-lg border border-white/10 p-1.5"
              >
                <ChevronLeft className="size-3.5 rtl:rotate-180" />
              </button>
              <button
                type="button"
                onClick={onNext}
                aria-label={dir === "rtl" ? "الفعالية التالية" : "Next event"}
                className="rounded-lg border border-white/10 p-1.5"
              >
                <ChevronRight className="size-3.5 rtl:rotate-180" />
              </button>
            </div>
          ) : null}
        </footer>
      </section>
    );
  }
  return (
    <div
      data-layout-content
      className={cn(
        "w-full overflow-hidden rounded-2xl border border-white/10 shadow-[0_18px_60px_rgba(0,0,0,.4)]",
        chrome === "glass" ? "bg-[#0c0e14]/78 backdrop-blur-xl" : "bg-zinc-950",
        chrome === "bold" ? "border-2 border-white/25" : "",
        chromeLayoutClass(chrome),
        compact ? "p-3" : "p-4",
      )}
      dir={dir}
      style={{ fontFamily: style.fontFamily, fontSize: `${style.fontSize}px` }}
    >
      {style.layout === "timeline" ? (
        <div className="mt-4 flex items-stretch gap-0 overflow-x-auto pb-1">
          {style.events.map((event, index) => {
            const current = index === activeIndex;
            const passed = activeIndex > index;
            return (
              <div key={event.id} className="flex min-w-[156px] flex-1 items-start">
                <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                  <span
                    className="grid size-7 shrink-0 place-items-center rounded-full border text-[0.65rem] font-bold tabular-nums"
                    style={{
                      color: current ? "#090b10" : passed ? style.accentColor : "#a1a1aa",
                      background: current ? style.accentColor : "transparent",
                      borderColor: current || passed ? style.accentColor : "rgba(255,255,255,.2)",
                    }}
                  >
                    {(index + 1).toLocaleString("en-US")}
                  </span>
                  <span
                    className="mt-2 line-clamp-3 w-full break-words text-xs font-semibold text-zinc-100"
                    dir="auto"
                  >
                    {event.title}
                  </span>
                  <span
                    className="mt-1 font-mono text-[0.65rem] tabular-nums text-zinc-500"
                    dir="ltr"
                  >
                    {formatCountdown(cumulativeStarts[index] ?? 0)}
                  </span>
                  <span
                    className="mt-1 font-mono text-[0.62rem] tabular-nums text-zinc-400"
                    dir="ltr"
                  >
                    {formatCountdown(event.durationSeconds)}
                  </span>
                </div>
                {index < style.events.length - 1 ? (
                  <span
                    className="mt-3 h-px min-w-3 flex-1"
                    style={{ background: passed ? style.accentColor : "rgba(255,255,255,.18)" }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <div
        className={cn(
          "hub-spotlight-card rounded-xl border border-white/10 bg-white/[0.05] backdrop-blur-md",
          compact ? "px-3 py-2.5" : "px-3.5 py-3",
        )}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: style.accentColor }}
            aria-hidden
          />
          {chrome === "bold" ? (
            <Clock3
              className="size-3.5 shrink-0"
              style={{ color: style.accentColor }}
              aria-hidden
            />
          ) : null}
          <span
            className="min-w-0 flex-1 truncate font-bold"
            style={{
              color: style.accentColor,
              fontSize: `${Math.max(12, Math.round(style.fontSize * 0.42))}px`,
            }}
            dir="auto"
          >
            {eventTitle}
          </span>
          <span className="shrink-0 text-[0.5rem] font-bold uppercase tracking-[0.24em] text-zinc-400">
            {badge}
          </span>
        </div>

        <p
          dir="ltr"
          className={cn(
            "mt-2 font-mono font-bold tabular-nums tracking-wide transition-colors",
            urgency === "critical" && "animate-pulse text-rose-400",
            urgency === "warn" && "text-amber-300",
            urgency === "calm" && "text-zinc-50",
          )}
          style={{
            fontSize: `${Math.max(18, Math.round(style.fontSize * (compact ? 0.72 : 1)))}px`,
          }}
        >
          {snapshot.status === "waiting" ? (
            <span className="inline-flex items-center gap-2 text-zinc-400">
              <span className="size-3.5 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
              {t("scheduleCard.loading")}
            </span>
          ) : (
            countdown
          )}
        </p>
        {snapshot.status === "active" && snapshot.next ? (
          <p className="mt-1 truncate text-[0.65rem] text-zinc-500" dir="auto">
            {t("scheduleCard.next", { title: snapshot.next.title })}
          </p>
        ) : null}
      </div>

      <div className={cn("mt-3 flex items-start gap-2.5", compact && "mt-2.5")}>
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
          <Clock3 className="size-4 text-[#bee1fc]" aria-hidden />
        </span>
        <div className="min-w-0">
          <p
            className="truncate font-medium tracking-tight text-zinc-50"
            style={{ fontSize: `${Math.max(13, Math.round(style.fontSize * 0.45))}px` }}
          >
            {style.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[0.72rem] leading-relaxed text-zinc-400">
            {t("scheduleCard.hint")}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 pt-1">
        <span className="flex items-center gap-2 text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                "size-1.5 rounded-full",
                effectiveRuntime.startedAt || demo ? "bg-[#bee1fc]" : "bg-zinc-600",
              )}
              aria-hidden
            />
            {t("scheduleCard.live")}
          </span>
          {style.showUptime ? (
            <span className="font-mono normal-case tracking-normal text-zinc-500">
              {formatUptime(uptimeSeconds)}
            </span>
          ) : null}
        </span>

        {showNav ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onPrevious}
              className="rounded-xl border border-white/10 p-1.5 text-zinc-400 transition-opacity hover:opacity-80"
              aria-label="Previous event"
            >
              <ChevronLeft className="size-3.5 rtl:rotate-180" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onNext}
              className="rounded-xl border border-white/10 p-1.5 text-zinc-400 transition-opacity hover:opacity-80"
              aria-label="Next event"
            >
              <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function StreamEventsScheduleView({
  config,
  runtime = null,
  demo = false,
}: {
  config: unknown;
  runtime?: StreamEventsRuntime | null;
  demo?: boolean;
}) {
  return (
    <div className="w-full max-w-[340px]">
      <StreamEventsScheduleCard config={config} runtime={runtime ?? null} demo={demo} />
    </div>
  );
}
