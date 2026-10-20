import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronRight,
  CircleDollarSign,
  Filter as FilterIcon,
  Gem,
  Gift,
  Globe,
  Heart,
  LoaderCircle,
  Lock,
  Pause,
  Play,
  RefreshCw,
  Settings,
  SkipForward,
  Star,
  Trash2,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { PlatformIcon } from "@/components/widgets/PlatformIcon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { describeFeedEvent, relativeFeedTime, type ActivityFeedEvent } from "@/lib/activityFeed";
import { PLATFORM_EVENT_ALLOWLIST, triggerPhrase } from "@/lib/platformEvents";

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

type DockEvent = ActivityFeedEvent & { replayAvailable: boolean };
type DockData = {
  events: DockEvent[];
  queue: {
    paused: boolean;
    muted: boolean;
    current: { id: string } | null;
    pendingCount: number;
  };
};
type DockAction = "pause" | "resume" | "skip" | "clear" | "mute" | "unmute";
type Notice = { key: TranslationKey; tone: "ok" | "error" };

type FilterId =
  | "all"
  | "kick"
  | "twitch"
  | "youtube"
  | "tiktok"
  | "x"
  | "streamlabs"
  | "streamelements"
  | "other";

const ALL_FILTERS: FilterId[] = [
  "all",
  "kick",
  "twitch",
  "youtube",
  "tiktok",
  "x",
  "streamlabs",
  "streamelements",
  "other",
];

// Event types come from the real per-platform allowlist, grouped by their feed phrase
// (KICKs, Super Chat, Membership... are phrases of the base event types).
// YouTube "subscribe" is a follow and "membership" is a paid subscription, so they
// filter under those base types instead of showing duplicate labels.
const TYPE_GROUP: Record<string, string> = { SUBSCRIBE: "FOLLOW", MEMBERSHIP: "SUBSCRIPTION" };
const typeGroup = (platform: string, eventType: string) => {
  const phrase = triggerPhrase(platform, eventType);
  return TYPE_GROUP[phrase] ?? phrase;
};

const PHRASE_ORDER = [
  "FOLLOW",
  "SUBSCRIPTION",
  "GIFT_SUB",
  "GIFT",
  "RAID",
  "BITS",
  "KICKS",
  "DONATION",
  "SUPER_CHAT",
  "LIKE",
];
const SUPPORTED_PHRASES = new Set(
  Object.entries(PLATFORM_EVENT_ALLOWLIST).flatMap(([platform, types]) =>
    types.map((type) => typeGroup(platform, type)),
  ),
);
const EVENT_TYPE_OPTIONS = [
  ...PHRASE_ORDER.filter((phrase) => SUPPORTED_PHRASES.has(phrase)),
  ...[...SUPPORTED_PHRASES].filter((phrase) => !PHRASE_ORDER.includes(phrase)),
];

const FILTER_PLATFORM: Record<Exclude<FilterId, "all" | "other">, string> = {
  kick: "KICK",
  twitch: "TWITCH",
  youtube: "YOUTUBE",
  tiktok: "TIKTOK",
  x: "X",
  streamlabs: "STREAMLABS",
  streamelements: "STREAMELEMENTS",
};
const BRAND_NAME: Record<Exclude<FilterId, "all" | "other">, string> = {
  kick: "Kick",
  twitch: "Twitch",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X",
  streamlabs: "Streamlabs",
  streamelements: "StreamElements",
};
// Thin edge marker per platform; the logos themselves keep their own colours.
const PLATFORM_EDGE: Record<string, string> = {
  KICK: "#53fc18",
  TWITCH: "#9146ff",
  YOUTUBE: "#ff0000",
  TIKTOK: "#25f4ee",
  X: "#a1a1aa",
  STREAMLABS: "#80f5d2",
  STREAMELEMENTS: "#3b6cff",
};
const KNOWN_PLATFORMS = new Set(Object.values(FILTER_PLATFORM));

const TYPE_ICON: Record<string, LucideIcon> = {
  FOLLOW: UserPlus,
  SUBSCRIPTION: Star,
  SUBSCRIBE: Star,
  MEMBERSHIP: Star,
  GIFT_SUB: Gift,
  GIFT: Gift,
  BITS: Gem,
  KICKS: Zap,
  DONATION: CircleDollarSign,
  SUPER_CHAT: CircleDollarSign,
  RAID: Users,
  LIKE: Heart,
};

const PREFS_KEY = "cylix.dock.prefs";
type Prefs = { showTests: boolean; showMessages: boolean };
const DEFAULT_PREFS: Prefs = { showTests: true, showMessages: true };

function matchesFilter(event: ActivityFeedEvent, filter: FilterId): boolean {
  if (filter === "all") return true;
  if (filter === "other") return !KNOWN_PLATFORMS.has(event.platform);
  return event.platform === FILTER_PLATFORM[filter];
}

function FilterGlyph({ id, size }: { id: FilterId; size: number }) {
  if (id === "all") return null;
  return (
    <span aria-hidden className="inline-flex shrink-0">
      {id === "other" ? (
        <Globe style={{ width: size, height: size }} />
      ) : (
        <PlatformIcon platform={FILTER_PLATFORM[id]} size={size} />
      )}
    </span>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  active,
  badge,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  badge?: number;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <button
            type="button"
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            onClick={onClick}
            className={`relative flex size-8 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-35 max-[379px]:size-7 max-[339px]:size-[26px] ${
              active
                ? "bg-[#bee1fc]/15 text-[#bee1fc]"
                : "text-white/85 hover:bg-white/[0.07] hover:text-white"
            }`}
          >
            {children}
            {badge ? (
              <span className="absolute -end-0.5 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#bee1fc] px-1 text-[9px] font-bold leading-none text-[#0a0a0a]">
                {badge > 99 ? "99+" : badge}
              </span>
            ) : null}
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="rounded-md px-2 py-1 text-[11px] leading-tight"
        sideOffset={6}
        collisionPadding={6}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

const MENU_CONTENT =
  "min-w-[10rem] max-w-[min(18rem,calc(100vw-1rem))] rounded-lg border-white/10 bg-[#111] p-1 text-[13px]";
const MENU_ITEM = "rounded-md px-2 py-1.5 text-[13px]";

function ActivityFeedDock() {
  const { token } = Route.useParams();
  const { t, dir, lang, setLang } = useLanguage();
  const [data, setData] = useState<DockData | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  // Empty list means every event type; platform and type filters apply together.
  const [types, setTypes] = useState<string[]>([]);
  const pillRow = useRef<HTMLDivElement>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [working, setWorking] = useState(false);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const refreshing = useRef(false);
  const stopped = useRef(false);
  const noticeTimer = useRef<number | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PREFS_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) });
    } catch {
      /* ignore unreadable prefs */
    }
  }, []);

  const updatePrefs = (patch: Partial<Prefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* storage may be unavailable in some embedded browsers */
      }
      return next;
    });
  };

  const flash = useCallback((next: Notice) => {
    setNotice(next);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    if (next.tone === "ok") {
      noticeTimer.current = window.setTimeout(() => setNotice(null), 2500);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (refreshing.current || stopped.current) return;
    refreshing.current = true;
    try {
      const response = await fetch(
        `/api/demo/alert-studio/overlay/${encodeURIComponent(token)}/feed`,
        { cache: "no-store", referrerPolicy: "no-referrer" },
      );
      if (!response.ok) {
        setOnline(false);
        if (response.status === 404) {
          stopped.current = true;
          setInvalid(true);
          setData(null);
        } else {
          flash({
            key: response.status === 429 ? "activity.dock.rateLimited" : "activity.dock.offline",
            tone: "error",
          });
        }
        return;
      }
      setData((await response.json()) as DockData);
      setOnline(true);
      setNotice((current) => (current?.tone === "error" ? null : current));
    } catch {
      setOnline(false);
      flash({ key: "activity.dock.offline", tone: "error" });
    } finally {
      refreshing.current = false;
      setLoading(false);
    }
  }, [token, flash]);

  useEffect(() => {
    stopped.current = false;
    setInvalid(false);
    void refresh();
    const poll = window.setInterval(() => void refresh(), 3000);
    const tick = window.setInterval(() => setNow(Date.now()), 30000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [refresh]);

  useEffect(() => {
    if (!confirmClear) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent && confirmRef.current?.contains(event.target as Node)) return;
      setConfirmClear(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("mousedown", close);
    };
  }, [confirmClear]);

  const visibleEvents = useMemo(
    () =>
      (data?.events ?? []).filter(
        (event) =>
          matchesFilter(event, filter) &&
          (types.length === 0 || types.includes(typeGroup(event.platform, event.event_type))) &&
          (prefs.showTests || !event.isTest),
      ),
    [data?.events, filter, types, prefs.showTests],
  );

  const toggleType = (phrase: string) =>
    setTypes((current) =>
      current.includes(phrase) ? current.filter((item) => item !== phrase) : [...current, phrase],
    );

  const selectFilter = (id: FilterId) => {
    setFilter(id);
    window.requestAnimationFrame(() =>
      pillRow.current
        ?.querySelector<HTMLElement>(`[data-filter="${id}"]`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" }),
    );
  };

  const onPillWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const row = event.currentTarget;
    if (row.scrollWidth > row.clientWidth && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      row.scrollLeft += event.deltaY;
    }
  };

  const performAction = async (action: DockAction) => {
    if (working || invalid) return;
    setWorking(true);
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
      if (!response.ok) throw new Error("failed");
      await refresh();
    } catch {
      flash({ key: "activity.dock.actionFailed", tone: "error" });
    } finally {
      setWorking(false);
    }
  };

  const replay = async (eventId: string) => {
    if (replayingId || invalid) return;
    setReplayingId(eventId);
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
      if (!response.ok) throw new Error("failed");
      await refresh();
      flash({ key: "activity.dock.replayQueued", tone: "ok" });
    } catch {
      flash({ key: "activity.dock.replayFail", tone: "error" });
    } finally {
      setReplayingId(null);
    }
  };

  const paused = data?.queue.paused ?? false;
  const muted = data?.queue.muted ?? false;
  const pendingCount = data?.queue.pendingCount ?? 0;
  const hasCurrent = Boolean(data?.queue.current);
  const controlsOff = !data || working || invalid;
  const label = (key: TranslationKey) => t(key);
  const filterLabel = (id: FilterId) =>
    id === "all"
      ? t("activity.dock.all")
      : id === "other"
        ? t("activity.dock.other")
        : BRAND_NAME[id];
  const activeFilter = types.length > 0;

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#0a0a0a] p-1.5 text-white" dir={dir}>
      <style>{`
        .dock-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.18) transparent; }
        .dock-scroll::-webkit-scrollbar { width: 6px; }
        .dock-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.18); border-radius: 999px; }
        .dock-scroll::-webkit-scrollbar-track { background: transparent; }
        .dock-filters { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.18) transparent; }
        .dock-filters::-webkit-scrollbar { height: 4px; }
        .dock-filters::-webkit-scrollbar-thumb { background: rgba(255,255,255,.18); border-radius: 999px; }
      `}</style>
      <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a]">
        <header className="relative flex h-12 shrink-0 items-center gap-1 border-b border-white/10 ps-3 pe-2 max-[379px]:ps-2.5 max-[379px]:pe-1.5">
          <h1 className="flex min-w-0 flex-1 items-center gap-2 text-[17px] font-bold leading-none max-[379px]:text-[15px] max-[339px]:gap-1.5 max-[339px]:text-sm">
            <span className="truncate">{t("activity.dock.title")}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  role="status"
                  aria-label={online ? t("activity.dock.online") : t("activity.dock.offline")}
                  className={`size-1.5 shrink-0 rounded-full ${online ? "bg-emerald-400" : "bg-white/25"}`}
                />
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="rounded-md px-2 py-1 text-[11px] leading-tight"
                sideOffset={6}
              >
                {online ? t("activity.dock.online") : t("activity.dock.offline")}
              </TooltipContent>
            </Tooltip>
          </h1>

          <IconButton
            label={paused ? t("activity.dock.resume") : t("activity.dock.pause")}
            active={paused}
            disabled={controlsOff}
            onClick={() => void performAction(paused ? "resume" : "pause")}
          >
            {paused ? <Play className="size-[18px]" fill="currentColor" /> : <Pause className="size-[18px]" fill="currentColor" />}
          </IconButton>
          <IconButton
            label={muted ? t("activity.dock.unmute") : t("activity.dock.mute")}
            active={muted}
            disabled={controlsOff}
            onClick={() => void performAction(muted ? "unmute" : "mute")}
          >
            {muted ? <VolumeX className="size-[18px]" /> : <Volume2 className="size-[18px]" />}
          </IconButton>
          <IconButton
            label={hasCurrent ? t("activity.dock.skip") : t("activity.dock.skipIdle")}
            disabled={controlsOff || !hasCurrent}
            onClick={() => void performAction("skip")}
          >
            <SkipForward className="size-[18px]" fill="currentColor" />
          </IconButton>
          <IconButton
            label={pendingCount ? t("activity.dock.clear") : t("activity.dock.clearNone")}
            badge={pendingCount}
            disabled={controlsOff || pendingCount === 0}
            onClick={() => setConfirmClear(true)}
          >
            <Trash2 className="size-[18px]" />
          </IconButton>

          <span className="mx-0.5 h-5 w-px shrink-0 bg-white/15 max-[379px]:mx-0" aria-hidden />

          <DropdownMenu dir={dir}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("activity.dock.filterTypes")}
                    className={`relative flex size-8 items-center justify-center rounded-md transition-colors max-[379px]:size-7 max-[339px]:size-[26px] ${
                      activeFilter
                        ? "bg-[#bee1fc]/15 text-[#bee1fc]"
                        : "text-white/85 hover:bg-white/[0.07] hover:text-white"
                    }`}
                  >
                    <FilterIcon className="size-[18px]" fill="currentColor" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="rounded-md px-2 py-1 text-[11px] leading-tight"
                sideOffset={6}
              >
                {t("activity.dock.filterTypes")}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className={`${MENU_CONTENT} w-56`}>
              <DropdownMenuLabel className="px-2 py-1 text-[11px] font-medium text-white/50">
                {t("activity.dock.eventTypes")}
              </DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={types.length === 0}
                onCheckedChange={() => setTypes([])}
                onSelect={(event) => event.preventDefault()}
                className={MENU_ITEM}
              >
                {t("activity.dock.all")}
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator className="bg-white/10" />
              {EVENT_TYPE_OPTIONS.map((phrase) => {
                const key = `activity.dock.type.${phrase}` as TranslationKey;
                const label = t(key);
                return (
                  <DropdownMenuCheckboxItem
                    key={phrase}
                    checked={types.includes(phrase)}
                    onCheckedChange={() => toggleType(phrase)}
                    onSelect={(event) => event.preventDefault()}
                    className={MENU_ITEM}
                  >
                    {label === key ? phrase : label}
                  </DropdownMenuCheckboxItem>
                );
              })}
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                className={MENU_ITEM}
                disabled={types.length === 0}
                onSelect={(event) => {
                  event.preventDefault();
                  setTypes([]);
                }}
              >
                {t("activity.dock.clearFilter")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu dir={dir}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("activity.dock.settings")}
                    className="flex size-8 items-center justify-center rounded-md text-white/85 transition-colors hover:bg-white/[0.07] hover:text-white max-[379px]:size-7 max-[339px]:size-[26px]"
                  >
                    <Settings className="size-[18px]" fill="currentColor" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="rounded-md px-2 py-1 text-[11px] leading-tight"
                sideOffset={6}
              >
                {t("activity.dock.settings")}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className={`${MENU_CONTENT} w-64`}>
              <DropdownMenuLabel className="px-2 py-1 text-[11px] font-medium text-white/50">
                {t("activity.dock.settings.language")}
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup value={lang} onValueChange={(value) => setLang(value)}>
                <DropdownMenuRadioItem value="ar" className={MENU_ITEM}>
                  العربية
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="en" className={MENU_ITEM}>
                  English
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuCheckboxItem
                checked={prefs.showTests}
                onCheckedChange={(checked) => updatePrefs({ showTests: checked === true })}
                onSelect={(event) => event.preventDefault()}
                className={MENU_ITEM}
              >
                {t("activity.dock.settings.testEvents")}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={prefs.showMessages}
                onCheckedChange={(checked) => updatePrefs({ showMessages: checked === true })}
                onSelect={(event) => event.preventDefault()}
                className={MENU_ITEM}
              >
                {t("activity.dock.settings.messages")}
              </DropdownMenuCheckboxItem>
              <DropdownMenuItem className={MENU_ITEM} onSelect={() => void refresh()}>
                <RefreshCw className="size-3.5" />
                {t("activity.dock.settings.refresh")}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <p className="px-2 py-1.5 text-[11px] leading-snug text-white/45">
                {t("activity.dock.settings.syncNote")}
              </p>
            </DropdownMenuContent>
          </DropdownMenu>

          {confirmClear ? (
            <div
              ref={confirmRef}
              role="alertdialog"
              aria-label={t("activity.dock.clear")}
              className="absolute end-2 top-[calc(100%+4px)] z-30 w-56 max-w-[calc(100%-1rem)] rounded-lg border border-white/10 bg-[#111] p-3 shadow-xl shadow-black/60"
            >
              <p className="text-[13px] font-semibold">
                {t("activity.dock.clearConfirm", { n: pendingCount })}
              </p>
              <p className="mt-0.5 text-[11px] text-white/50">{t("activity.dock.clearHint")}</p>
              <div className="mt-2.5 flex justify-end gap-1.5">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirmClear(false)}
                  className="h-7 rounded-md px-2.5 text-xs text-white/70 hover:bg-white/[0.07]"
                >
                  {t("activity.dock.cancel")}
                </button>
                <button
                  type="button"
                  disabled={working}
                  onClick={() => {
                    setConfirmClear(false);
                    void performAction("clear");
                  }}
                  className="h-7 rounded-md bg-[#bee1fc] px-2.5 text-xs font-semibold text-[#0a0a0a] hover:bg-[#bee1fc]/90 disabled:opacity-50"
                >
                  {t("activity.dock.confirm")}
                </button>
              </div>
            </div>
          ) : null}
        </header>

        <div
          ref={pillRow}
          onWheel={onPillWheel}
          className="dock-filters flex shrink-0 scroll-smooth items-center gap-1 overflow-x-auto border-b border-white/10 px-2.5 py-2 max-[379px]:px-2"
          role="group"
          aria-label={t("activity.dock.filter")}
        >
          {ALL_FILTERS.map((id) => {
            const selected = filter === id;
            return (
              <button
                type="button"
                key={id}
                data-filter={id}
                aria-pressed={selected}
                aria-label={filterLabel(id)}
                onClick={() => selectFilter(id)}
                className={`flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2 text-[13px] leading-none transition-colors ${
                  selected
                    ? "border-[#bee1fc]/45 bg-[#bee1fc]/12 text-white"
                    : "border-white/12 text-white/80 hover:bg-white/[0.05]"
                }`}
              >
                <FilterGlyph id={id} size={15} />
                <span>{filterLabel(id)}</span>
              </button>
            );
          })}
        </div>

{notice ? (
          <p
            role="status"
            className={`shrink-0 border-b border-white/10 px-3 py-1.5 text-xs ${
              notice.tone === "ok" ? "text-[#bee1fc]" : "text-amber-200/90"
            }`}
          >
            {t(notice.key)}
          </p>
        ) : null}

        <div className="dock-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {invalid ? (
            <p className="flex items-start gap-2 px-4 py-8 text-[13px] leading-snug text-white/60">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t("activity.dock.invalid")}
            </p>
          ) : loading && !data ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-white/50">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              {t("activity.dock.loading")}
            </div>
          ) : visibleEvents.length === 0 ? (
            <p className="px-4 py-12 text-center text-[13px] text-white/50">
              {data && data.events.length > 0 ? t("activity.dock.emptyFilter") : t("activity.dock.empty")}
            </p>
          ) : (
            <ul>
              {visibleEvents.map((event) => {
                const { phrase, text } = describeFeedEvent(event, label);
                const TypeIcon = TYPE_ICON[phrase];
                const edge = PLATFORM_EDGE[event.platform] ?? "#71717a";
                const replaying = replayingId === event.id;
                const replayLabel = event.replayAvailable
                  ? t("activity.dock.replay")
                  : t("activity.dock.replayUnavailable");
                return (
                  <li
                    key={event.id}
                    className="relative flex min-h-[52px] items-center gap-2.5 border-b border-white/[0.07] py-2 ps-5 pe-1.5 hover:bg-white/[0.025] max-[379px]:gap-2 max-[379px]:ps-4"
                  >
                    <span
                      aria-hidden
                      className="absolute start-2 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-full max-[379px]:start-1.5"
                      style={{ background: edge }}
                    />
                    <span className="flex w-7 shrink-0 items-center justify-center">
                      <PlatformIcon platform={event.platform} size={26} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-1.5 text-[15px] leading-[22px] max-[379px]:flex-col max-[379px]:items-start max-[379px]:gap-0 max-[379px]:text-sm max-[379px]:leading-5">
                        <bdi className="break-words font-bold">
                          {event.actor_name ?? t("activity.anonymous")}
                        </bdi>
                        <ChevronRight className="size-3.5 shrink-0 text-white/35 rtl:rotate-180 max-[379px]:hidden" aria-hidden />
                        <span className="flex min-w-0 items-center gap-1 text-white/90">
                          {TypeIcon ? <TypeIcon className="size-3.5 shrink-0 text-white/50" aria-hidden /> : null}
                          <bdi className="break-words">{text}</bdi>
                          {event.isTest ? (
                            <span className="ms-1 rounded bg-white/10 px-1 text-[10px] leading-4 text-white/55">
                              {t("activity.dock.testBadge")}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      {prefs.showMessages && event.message ? (
                        <p className="line-clamp-2 break-words text-[13px] leading-snug text-white/45" dir="auto">
                          {event.message}
                        </p>
                      ) : null}
                    </div>
                    <time
                      className="shrink-0 text-[13px] tabular-nums text-white/50"
                      dateTime={event.created_at}
                    >
                      {relativeFeedTime(event.created_at, now, label)}
                    </time>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex shrink-0">
                          <button
                            type="button"
                            aria-label={replayLabel}
                            disabled={!event.replayAvailable || Boolean(replayingId) || invalid}
                            onClick={() => void replay(event.id)}
                            className="flex size-8 items-center justify-center rounded-md text-white/85 transition-colors hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            {replaying ? (
                              <LoaderCircle className="size-[17px] animate-spin" aria-hidden />
                            ) : (
                              <RefreshCw className="size-[17px]" aria-hidden />
                            )}
                          </button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent
                        side="left"
                        className="rounded-md px-2 py-1 text-[11px] leading-tight"
                        sideOffset={4}
                        collisionPadding={6}
                      >
                        {replayLabel}
                      </TooltipContent>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
