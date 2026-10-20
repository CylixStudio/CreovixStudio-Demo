import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  CircleAlert,
  LoaderCircle,
  MicOff,
  Pause,
  Play,
  RadioTower,
  RotateCw,
  SkipForward,
  Trash2,
  Volume2,
} from "lucide-react";
import { PlatformIcon } from "@/components/widgets/PlatformIcon";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { ALERT_CATALOG, type AlertEvent, type AlertKind } from "@/lib/alertStudio";
import {
  ACTIVITY_FEED_FILTERS,
  matchesActivityFeedFilter,
  type ActivityFeedEvent,
} from "@/lib/activityFeed";
import { isAllowedPlatformEvent, triggerPhrase } from "@/lib/platformEvents";

export const Route = createFileRoute("/activity-feed/dock/$token")({
  head: () => ({
    meta: [
      { title: "CylixStudio — Activity Feed Dock" },
      { name: "robots", content: "noindex,nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: ActivityFeedDock,
});

type DockQueueEvent = Pick<AlertEvent, "id" | "alertId" | "platform" | "username" | "count"> & {
  durationMs: number;
  replayOf: string | null;
};

type DockData = {
  events: (ActivityFeedEvent & { replayAvailable: boolean })[];
  locked: boolean;
  isPro: boolean;
  queue: {
    paused: boolean;
    muted: boolean;
    current: DockQueueEvent | null;
    pending: DockQueueEvent[];
    pendingCount: number;
  };
};

type Filter = (typeof ACTIVITY_FEED_FILTERS)[number]["id"];
type DockAction = "pause" | "resume" | "skip" | "clear" | "mute" | "unmute";

function eventLabel(event: ActivityFeedEvent, t: (key: TranslationKey) => string) {
  const key = `activity.type.${triggerPhrase(event.platform, event.event_type)}` as TranslationKey;
  return t(key);
}

function ActivityFeedDock() {
  const { token } = Route.useParams();
  const { t, dir, lang } = useLanguage();
  const [data, setData] = useState<DockData | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<TranslationKey | "">("");
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const response = await fetch(`/api/demo/alert-studio/overlay/${encodeURIComponent(token)}/feed`, {
        cache: "no-store",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) {
        if (response.status === 404) {
          setData(null);
          setNotice("activity.dock.invalid");
        } else if (response.status === 429) setNotice("activity.dock.rateLimited");
        else setNotice("activity.dock.offline");
        setOnline(false);
        return;
      }
      const next = (await response.json()) as DockData;
      setData(next);
      setOnline(true);
      setNotice("");
    } catch {
      setOnline(false);
      setNotice("activity.dock.offline");
    } finally {
      refreshing.current = false;
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const visibleEvents = useMemo(
    () => (data?.events ?? []).filter((event) => matchesActivityFeedFilter(event, filter)),
    [data?.events, filter],
  );

  const performAction = async (action: DockAction) => {
    if (working) return;
    if (action === "clear" && !window.confirm(t("activity.dock.clearConfirm"))) return;
    setWorking(true);
    setNotice("");
    try {
      const response = await fetch(
        `/api/demo/alert-studio/overlay/${encodeURIComponent(token)}/control`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          referrerPolicy: "no-referrer",
          body: JSON.stringify({ action }),
        },
      );
      if (!response.ok) throw new Error("activity.dock.actionFailed");
      await refresh();
    } catch {
      setNotice("activity.dock.actionFailed");
    } finally {
      setWorking(false);
    }
  };

  const replay = async (eventId: string) => {
    if (working) return;
    setWorking(true);
    setNotice("");
    try {
      const response = await fetch(
        `/api/demo/alert-studio/overlay/${encodeURIComponent(token)}/replay`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          referrerPolicy: "no-referrer",
          body: JSON.stringify({ eventId }),
        },
      );
      if (!response.ok) throw new Error("activity.dock.replayFail");
      await refresh();
      setNotice("activity.dock.replayQueued");
    } catch {
      setNotice("activity.dock.replayFail");
    } finally {
      setWorking(false);
    }
  };

  const statusText = online ? t("activity.dock.online") : t("activity.dock.offline");
  const current = data?.queue.current;
  const alertName = (alertId: AlertKind) =>
    ALERT_CATALOG.find((definition) => definition.id === alertId)?.title ?? alertId;
  const queueLine = (event: DockQueueEvent) =>
    `${alertName(event.alertId)} — ${event.username} · ${event.platform}`;

  return (
    <main className="min-h-screen bg-[#090a0d] p-3 text-foreground sm:p-5" dir={dir}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Activity className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">{t("activity.dock.title")}</h1>
              <p className="text-xs text-muted-foreground">{t("activity.dock.subtitle")}</p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
              online
                ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-200"
                : "border-white/10 text-muted-foreground"
            }`}
            aria-live="polite"
          >
            <RadioTower className="size-3.5" aria-hidden />
            {statusText}
          </span>
        </header>

        {notice ? (
          <p
            role="status"
            className="flex items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-300/5 px-3 py-2 text-xs text-amber-100"
          >
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            {t(notice)}
          </p>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="me-1 text-xs font-semibold">{t("activity.dock.controls")}</span>
              {data ? (
                <span
                  className={`me-1 rounded-full border px-2 py-1 text-[0.65rem] ${
                    data.queue.paused
                      ? "border-amber-300/20 text-amber-100"
                      : "border-emerald-300/20 text-emerald-100"
                  }`}
                  aria-live="polite"
                >
                  {data.queue.paused ? t("alerts.control.paused") : t("alerts.control.running")}
                  {data.queue.muted ? ` · ${t("activity.dock.muted")}` : ""}
                </span>
              ) : null}
              {data?.queue.paused ? (
                <button
                  type="button"
                  disabled={working || !data}
                  onClick={() => void performAction("resume")}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs hover:bg-white/5 disabled:opacity-50"
                >
                  <Play className="size-3.5" aria-hidden />
                  {t("alerts.control.resume")}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={working || !data}
                  onClick={() => void performAction("pause")}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs hover:bg-white/5 disabled:opacity-50"
                >
                  <Pause className="size-3.5" aria-hidden />
                  {t("alerts.control.pause")}
                </button>
              )}
              <button
                type="button"
                disabled={working || !data || !current}
                onClick={() => void performAction("skip")}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs hover:bg-white/5 disabled:opacity-40"
              >
                <SkipForward className="size-3.5" aria-hidden />
                {t("alerts.control.skip")}
              </button>
              <button
                type="button"
                disabled={working || !data || !data.queue.pendingCount}
                onClick={() => void performAction("clear")}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs hover:bg-white/5 disabled:opacity-40"
              >
                <Trash2 className="size-3.5" aria-hidden />
                {t("alerts.control.clear")}
              </button>
              <button
                type="button"
                disabled={working || !data}
                onClick={() => void performAction(data?.queue.muted ? "unmute" : "mute")}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs hover:bg-white/5 disabled:opacity-50"
              >
                {data?.queue.muted ? (
                  <Volume2 className="size-3.5" aria-hidden />
                ) : (
                  <MicOff className="size-3.5" aria-hidden />
                )}
                {t(data?.queue.muted ? "activity.dock.unmute" : "activity.dock.mute")}
              </button>
            </div>
            <button
              type="button"
              disabled={working}
              onClick={() => void refresh()}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs text-muted-foreground hover:bg-white/5 disabled:opacity-50"
            >
              <RotateCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
              {t("activity.dock.refresh")}
            </button>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="min-w-0 rounded-xl border border-white/5 bg-black/15 px-3 py-2.5">
              <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("activity.dock.nowPlaying")}
              </p>
              <p className="mt-1 truncate text-xs">
                {current ? queueLine(current) : t("activity.dock.nothingPlaying")}
              </p>
            </div>
            <div className="min-w-0 rounded-xl border border-white/5 bg-black/15 px-3 py-2.5">
              <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("activity.dock.queue")}
              </p>
              <p className="mt-1 truncate text-xs">
                {t("activity.dock.pending", { count: data?.queue.pendingCount ?? 0 })}
                {data?.queue.pending[0] ? ` · ${queueLine(data.queue.pending[0])}` : ""}
              </p>
            </div>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 p-3 sm:p-4">
            <div>
              <h2 className="text-sm font-semibold">{t("activity.dock.history")}</h2>
              {data?.locked ? (
                <p className="mt-1 text-[0.7rem] text-muted-foreground">
                  {t("activity.dock.locked")}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("activity.filter")}>
              {ACTIVITY_FEED_FILTERS.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={filter === item.id}
                  onClick={() => setFilter(item.id)}
                  className={`min-h-8 rounded-lg px-2.5 text-[0.7rem] ${
                    filter === item.id
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-white/5"
                  }`}
                >
                  {t(item.label as TranslationKey)}
                </button>
              ))}
            </div>
          </div>
          {loading && !data ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              {t("activity.loading")}
            </div>
          ) : visibleEvents.length === 0 ? (
            <p className="px-4 py-12 text-center text-xs text-muted-foreground">
              {data?.locked ? t("activity.dock.locked") : t("activity.dock.empty")}
            </p>
          ) : (
            <ul className="max-h-[72vh] divide-y divide-white/5 overflow-y-auto">
              {visibleEvents.map((event) => {
                const label = eventLabel(event, (key) => t(key));
                const eventTime = new Intl.DateTimeFormat(lang, {
                  hour: "numeric",
                  minute: "2-digit",
                  month: "short",
                  day: "numeric",
                }).format(new Date(event.created_at));
                const amount =
                  event.amount != null
                    ? `${event.amount}${event.currency ? ` ${event.currency}` : ""}`
                    : event.quantity > 1
                      ? `×${event.quantity}`
                      : "";
                return (
                  <li key={event.id} className="flex min-w-0 items-start gap-3 px-3 py-3 sm:px-4">
                    <PlatformIcon platform={event.platform} size={20} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-xs font-semibold">
                          {event.actor_name ?? t("activity.anonymous")}
                        </span>
                        <span className="text-[0.68rem] text-muted-foreground">{label}</span>
                        {amount ? (
                          <span className="text-[0.68rem] text-muted-foreground">{amount}</span>
                        ) : null}
                        {event.isTest ? (
                          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[0.62rem] text-muted-foreground">
                            {t("activity.testEvent")}
                          </span>
                        ) : null}
                      </div>
                      {event.message ? (
                        <p
                          className="mt-1 break-words text-[0.72rem] text-muted-foreground"
                          dir="auto"
                        >
                          {event.message}
                        </p>
                      ) : null}
                    </div>
                    <time
                      className="shrink-0 text-[0.65rem] text-muted-foreground"
                      dateTime={event.created_at}
                    >
                      {eventTime}
                    </time>
                    {event.replayAvailable ? (
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => void replay(event.id)}
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground disabled:opacity-40"
                        aria-label={t("activity.dock.replay")}
                        title={t("activity.dock.replay")}
                      >
                        {working ? (
                          <LoaderCircle className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <RotateCw className="size-4" aria-hidden />
                        )}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
