import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowUp, ChevronDown, ChevronRight, Plug } from "lucide-react";

import { PlatformFilterBar, FilterDot } from "@/components/hub/PlatformFilterBar";


import { AppShell } from "@/components/layout/AppShell";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/layout/EmptyState";
import { TestEventMenu, type InjectedFeedEvent } from "@/components/activity/TestEventMenu";
import { ReplyAlertFrame } from "@/components/overlay/ReplyAlertFrame";
import { PlatformIcon } from "@/components/widgets/PlatformIcon";
import { readReplyMeta } from "@/lib/replyAlert";
import { isStoredTestRow, readTestDisplay } from "@/lib/testAlert";
import { requestUpgrade } from "@/components/subscription/upgradePlan";
import { getPlanActivity } from "@/lib/planData.functions";
import { FREE_PLAN_LIMITS } from "@/lib/plans";
import { supabase } from "@/lib/supabase/client";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { describeFeedEvent, groupConsecutiveEvents, relativeFeedTime, type FeedEventGroup } from "@/lib/activityFeed";
import { isAllowedPlatformEvent } from "@/lib/platformEvents";
import { isTestMode } from "@/lib/testMode";
import { useWidgets } from "@/hooks/useWidgets";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useApplyDefaultPlatform } from "@/lib/defaultPlatform";

export const Route = createFileRoute("/_authenticated/activity-feed")({
  head: () => ({
    meta: [
      { title: "CylixStudio — Activity Feed" },
      {
        name: "description",
        content:
          "Historical activity log of follows, subscriptions, gift subs, bits, raids and tips across your connected streaming platforms.",
      },
      { property: "og:title", content: "CylixStudio — Activity Feed" },
      {
        property: "og:description",
        content: "Browse and filter your full stream event history in one clean feed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActivityFeedPage,
});

type FeedEvent = {
  id: string;
  platform: string;
  event_type: string;
  actor_name: string | null;
  amount: number | null;
  currency: string | null;
  quantity: number;
  seconds_added: number;
  message: string | null;
  created_at: string;
  isReply?: boolean;
  replyQuote?: string | null;
  isTest?: boolean;
};


type FilterGroup = {
  id: string;
  name: string | null;
  dot: string;
  match: (event: FeedEvent) => boolean;
};

const KNOWN_PLATFORMS = [
  "KICK",
  "TWITCH",
  "YOUTUBE",
  "TIKTOK",
  "X",
  "STREAMLABS",
  "STREAMELEMENTS",
];

const FILTER_GROUPS: FilterGroup[] = [
  { id: "kick", name: "Kick", dot: "#53FC18", match: (e) => e.platform === "KICK" },
  { id: "twitch", name: "Twitch", dot: "#9146FF", match: (e) => e.platform === "TWITCH" },
  { id: "youtube", name: "YouTube", dot: "#FF0000", match: (e) => e.platform === "YOUTUBE" },
  { id: "tiktok", name: "TikTok", dot: "#25F4EE", match: (e) => e.platform === "TIKTOK" },
  { id: "x", name: "X", dot: "#E7E9EA", match: (e) => e.platform === "X" },
  { id: "streamlabs", name: "Streamlabs", dot: "#31C3A2", match: (e) => e.platform === "STREAMLABS" },
  {
    id: "streamelements",
    name: "StreamElements",
    dot: "#236BE9",
    match: (e) => e.platform === "STREAMELEMENTS",
  },
  {
    // Anything from a source outside the named groups (manual adds, future
    // integrations) still belongs in the all-platform totals.
    id: "other",
    name: null,
    dot: "#A1A1AA",
    match: (e) => !KNOWN_PLATFORMS.includes(e.platform),
  },
];

const FILTER_STORAGE_KEY = "activity-feed-filter";


const TEST_FEED_KEY = "creovix:test-activity-feed";

function readTestFeed(): FeedEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(TEST_FEED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FeedEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTestFeed(events: FeedEvent[]) {
  try {
    window.sessionStorage.setItem(TEST_FEED_KEY, JSON.stringify(events.slice(0, 200)));
  } catch {
    /* quota / private mode */
  }
}

function ActivityFeedRow({
  group,
  fresh,
  now,
  t,
}: {
  group: FeedEventGroup<FeedEvent>;
  fresh: boolean;
  now: number;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  const event = group.events[0]!;
  const count = group.events.length;
  const { text } = describeFeedEvent(event, (key) => t(key));
  const time = relativeFeedTime(event.created_at, now, (key) => t(key));

  return (
    <li className={fresh ? "soft-rise" : ""}>
      <ReplyAlertFrame active={event.isReply === true} quote={event.replyQuote}>
        <div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]">
          <span className="mt-px flex w-6 shrink-0 justify-center">
            <PlatformIcon platform={event.platform} size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-3">
              <p className="min-w-0 flex-1 text-sm leading-6">
                <bdi className="font-semibold text-foreground">
                  {event.actor_name ?? t("activity.anonymous")}
                </bdi>
                <ChevronRight
                  className="mx-1.5 inline size-3.5 text-muted-foreground/60 rtl:rotate-180"
                  aria-hidden
                />
                <bdi className="text-foreground/90">{text}</bdi>
                {event.isTest ? (
                  <span className="ms-2 rounded bg-white/10 px-1.5 py-0.5 align-middle text-[0.62rem] text-muted-foreground">
                    {t("activity.testEvent")}
                  </span>
                ) : null}
              </p>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground" title={event.created_at}>
                {time}
              </span>
            </div>
            {event.message ? (
              <p className="mt-0.5 line-clamp-2 break-words text-[0.8rem] text-muted-foreground" dir="auto">
                {event.message}
              </p>
            ) : null}
            {count > 1 ? (
              <Collapsible className="mt-1.5">
                <CollapsibleTrigger className="group flex items-center gap-1 text-[0.7rem] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground">
                  {t("activity.group.count", { count })}
                  <ChevronDown
                    className="size-3 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
                    aria-hidden
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="mt-2 space-y-1 border-s border-white/10 ps-3 pt-1">
                    {group.events.map((item) => (
                      <li key={item.id} className="py-0.5 text-[0.75rem] text-muted-foreground">
                        <ReplyAlertFrame active={item.isReply === true} quote={item.replyQuote}>
                          <div className="flex items-center justify-between gap-2">
                            <bdi className="min-w-0 flex-1 truncate">
                              {[describeFeedEvent(item, (key) => t(key)).text, item.message]
                                .filter(Boolean)
                                .join(" · ")}
                            </bdi>
                            <span className="shrink-0 tabular-nums" title={item.created_at}>
                              {relativeFeedTime(item.created_at, now, (key) => t(key))}
                            </span>
                          </div>
                        </ReplyAlertFrame>
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </div>
        </div>
      </ReplyAlertFrame>
    </li>
  );
}
function readMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  for (const key of ["message", "text", "comment", "user_message", "body"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 400);
  }
  return null;
}

type EventRow = {
  id: string;
  platform: string;
  event_type: string;
  actor_name: string | null;
  amount: number | null;
  currency: string | null;
  quantity: number | null;
  seconds_added: number | null;
  raw_payload: unknown;
  created_at: string;
};

/** Normalizes a persisted `events` row into the shape the feed renders. */
function toFeedEvent(row: EventRow): FeedEvent {
  const reply = readReplyMeta(row.raw_payload);
  const display = readTestDisplay(row.raw_payload);
  const test = isStoredTestRow({ event_type: row.event_type, raw_payload: row.raw_payload });
  return {
    id: row.id,
    platform: row.platform,
    event_type: row.event_type,
    actor_name: row.actor_name,
    amount: display?.amount ?? row.amount,
    currency: display?.currency ?? row.currency,
    quantity: display?.quantity ?? row.quantity ?? 1,
    seconds_added: test ? 0 : (row.seconds_added ?? 0),
    message: readMessage(row.raw_payload),
    created_at: row.created_at,
    isReply: reply.isReply,
    replyQuote: reply.quote,
    ...(test ? { isTest: true as const } : {}),
  };
}

function ActivityFeedPage() {
  const { user } = Route.useRouteContext();
  const { data: workspace } = useWorkspace(user.id);
  const widgets = useWidgets();
  const { t } = useLanguage();
  const testMode = isTestMode();

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(tick);
  }, []);
  const [live, setLive] = useState<FeedEvent[]>([]);
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState<string>("all");
  const filterRestored = useRef(false);

  useEffect(() => {
    if (filterRestored.current) return;
    filterRestored.current = true;
    const stored = window.sessionStorage?.getItem(FILTER_STORAGE_KEY);
    if (stored && (stored === "all" || FILTER_GROUPS.some((group) => group.id === stored))) {
      setFilter(stored);
    }
  }, []);

  const changeFilter = (id: string) => {
    setFilter(id);
    window.sessionStorage?.setItem(FILTER_STORAGE_KEY, id);
  };

  useApplyDefaultPlatform(workspace?.profile?.default_platform, (platform) => {
    const id = platform.toLowerCase();
    if (!window.sessionStorage?.getItem(FILTER_STORAGE_KEY) && FILTER_GROUPS.some((group) => group.id === id)) {
      setFilter(id);
    }
  });
  const [scrolled, setScrolled] = useState(false);
  const freshTimers = useRef<number[]>([]);

  const chatWidgetId =
    widgets.data?.widgets.find((widget) => widget.type === "CHAT_BOX")?.id ??
    widgets.data?.widgets[0]?.id ??
    null;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 300);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (testMode) setLive(readTestFeed());
  }, [testMode]);

  useEffect(() => {
    const timers = freshTimers.current;
    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
  }, []);

  const markFresh = (id: string) => {
    setFreshIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    const timer = window.setTimeout(() => {
      setFreshIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 700);
    freshTimers.current.push(timer);
  };

  const onInject = (event: InjectedFeedEvent) => {
    setLive((prev) => {
      const next = [event, ...prev.filter((item) => item.id !== event.id)].slice(0, 200);
      if (isTestMode()) writeTestFeed(next);
      return next;
    });
    markFresh(event.id);
  };

  const onPersisted = (localId: string, realId: string) => {
    if (!realId || localId === realId) return;
    setLive((prev) => prev.map((item) => (item.id === localId ? { ...item, id: realId } : item)));
    setFreshIds((prev) => {
      if (!prev.has(localId) && !prev.has(realId)) return prev;
      const next = new Set(prev);
      next.delete(localId);
      next.add(realId);
      return next;
    });
  };

  const query = useQuery({
    queryKey: ["activity-feed"],
    enabled: !testMode,
    refetchInterval: scrolled || testMode ? false : 8000,
    queryFn: async () => {
      const result = await getPlanActivity();
      const rows = [
        ...result.events,
        ...result.targets.map((row) => ({
          ...row,
          seconds_added: 0,
          raw_payload: {},
        })),
      ];
      return { rows: rows.map((row) => toFeedEvent(row as EventRow)), locked: result.locked, isPro: result.isPro };
    },
  });

  // Live pipeline: every event written by the Twitch / Kick / TikTok / YouTube /
  // Streamlabs / StreamElements ingest paths lands in `events` and is streamed
  // here instantly, so the feed never waits for the next poll.
  useEffect(() => {
    if (testMode) return;
    const channel = supabase
      .channel("activity-feed-events")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "events" },
        (payload) => {
          const row = payload.new as EventRow | null;
          if (!row?.id) return;
          setLive((prev) =>
            prev.some((item) => item.id === row.id)
              ? prev
              : [toFeedEvent(row), ...prev].slice(0, 200),
          );
          markFresh(row.id);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "target_events" },
        (payload) => {
          const row = payload.new as EventRow | null;
          if (!row?.id) return;
          const event = toFeedEvent({ ...row, seconds_added: 0, raw_payload: {} });
          setLive((prev) => (prev.some((item) => item.id === row.id) ? prev : [event, ...prev].slice(0, 200)));
          markFresh(row.id);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [testMode]);

  const events = useMemo(() => {
    const map = new Map<string, FeedEvent>();
    for (const item of [...live, ...(query.data?.rows ?? [])]) map.set(item.id, item);
    const sorted = [...map.values()]
      .filter((event) => isAllowedPlatformEvent(event.platform, event.event_type))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // A relay (Streamlabs / StreamElements) can echo a native event. Keep the
    // native row. Two events from the same platform always both stay.
    const NATIVE = new Set(["TWITCH", "KICK", "TIKTOK", "YOUTUBE"]);
    const RELAY = new Set(["STREAMLABS", "STREAMELEMENTS"]);
    const kept: FeedEvent[] = [];
    for (const event of sorted) {
      const actor = (event.actor_name ?? "").trim().toLowerCase();
      const time = new Date(event.created_at).getTime();
      const twinIndex =
        actor.length === 0
          ? -1
          : kept.findIndex((other) => {
              if ((other.actor_name ?? "").trim().toLowerCase() !== actor) return false;
              if (other.event_type !== event.event_type) return false;
              if (other.platform === event.platform) return false;
              if (Math.abs(new Date(other.created_at).getTime() - time) > 10_000) return false;
              const cross =
                (NATIVE.has(event.platform) && RELAY.has(other.platform)) ||
                (RELAY.has(event.platform) && NATIVE.has(other.platform));
              return cross;
            });
      if (twinIndex === -1) {
        kept.push(event);
        continue;
      }
      const twin = kept[twinIndex]!;
      if (NATIVE.has(event.platform) && RELAY.has(twin.platform)) {
        kept[twinIndex] = event;
      }
    }
    if (!testMode && query.data && !query.data.isPro) {
      return kept.slice(0, FREE_PLAN_LIMITS.activityEvents);
    }
    return kept;
  }, [query.data, live, testMode]);



  const visible = useMemo(() => {
    if (filter === "all") return events;
    const group = FILTER_GROUPS.find((item) => item.id === filter);
    return group ? events.filter((event) => group.match(event)) : events;
  }, [events, filter]);

  const groups = useMemo(() => groupConsecutiveEvents(visible), [visible]);

  return (
    <AppShell
      user={user}
      profile={workspace?.profile}
      title={t("activity.title")}
      subtitle={t("activity.subtitle")}
      actions={
        <TestEventMenu
          connections={workspace?.connections ?? []}
          widgetId={chatWidgetId}
          onInject={onInject}
          onPersisted={onPersisted}
        />
      }
    >
      <div className="space-y-6">
        {/* Plan Alert */}
        {query.data?.locked ? (
          <button
            type="button"
            onClick={() => requestUpgrade()}
            className="w-full rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground transition-colors hover:bg-primary/10"
          >
            {t("plan.channelLocked")}
          </button>
        ) : query.data && !query.data.isPro ? (
          <p className="text-xs text-muted-foreground">{t("activity.freeLimit")}</p>
        ) : null}

        {/* Filters Section */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <PlatformFilterBar
            ariaLabel={t("activity.filter")}
            allId="all"
            value={filter}
            onChange={changeFilter}
            options={[
              {
                id: "all",
                label: t("activity.dock.all"),
                glyph: (
                  <span className="inline-flex items-center gap-1.5" aria-hidden>
                    {FILTER_GROUPS.slice(0, 4).map((group) => (
                      <FilterDot key={group.id} color={group.dot} />
                    ))}
                  </span>
                ),
              },
              ...FILTER_GROUPS.map((group) => ({
                id: group.id,
                label: group.name ?? t("activity.dock.other"),
                color: group.dot,
                glyph: <FilterDot color={group.dot} />,
              })),
            ]}
          />
          <span className="text-xs font-medium text-muted-foreground" aria-live="polite">
            {visible.length} {visible.length === 1 ? t("activity.event") : t("activity.events")}
          </span>
        </div>
        {/* Main Feed Section */}
        <section>
          {visible.length === 0 ? (
            query.isLoading && !testMode ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-sm text-muted-foreground">{t("activity.loading")}</p>
              </div>
            ) : (workspace?.connections?.length ?? 0) === 0 ? (
              <EmptyState
                icon={Plug}
                title={t("activity.emptyTitle")}
                description={t("activity.emptyConnectDesc")}
                actionLabel={t("activity.connectCta")}
                actionTo="/settings"
              />
            ) : (
              <EmptyState
                icon={Activity}
                title={t("activity.emptyTitle")}
                description={t("activity.emptyWaitingDesc")}
              />
            )
          ) : (
            <div className="surface-card overflow-hidden">
              <ul className="divide-y divide-white/5">
                {groups.map((group) => (
                  <ActivityFeedRow
                    key={group.id}
                    group={group}
                    fresh={group.events.some((event) => freshIds.has(event.id))}
                    now={now}
                    t={t}
                  />
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {scrolled ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 end-6 z-40 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] backdrop-blur px-4 py-2.5 text-xs font-semibold text-foreground transition-all hover:bg-white/10 hover:border-white/20"
        >
          <ArrowUp className="size-4 text-primary" aria-hidden />
          {t("activity.scrollTop")}
        </button>
      ) : null}

    </AppShell>
  );
}
