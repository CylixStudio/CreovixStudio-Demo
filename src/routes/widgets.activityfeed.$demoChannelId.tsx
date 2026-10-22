import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Bell,
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
  RotateCcw,
  Settings,
  SkipForward,
  Star,
  Trash2,
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

export const Route = createFileRoute("/widgets/activityfeed/$demoChannelId")({
  head: () => ({
    meta: [
      { title: "CylixStudio — Activity Feed Dock" },
      { name: "robots", content: "noindex,nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
    scripts: [{ children: UI_SIZE_BOOT_SCRIPT }],
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
  FOLLOW: Heart,
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
  HOST: Users,
  LIKE: Heart,
};

const PREFS_KEY = "cylix.dock.prefs";
// Logo pixel sizes at 100%; the UI Size factor is applied where they are rendered.
const ROW_LOGO_PX = 13;
const FILTER_LOGO_PX = 15;
const PLATFORM_ICON_MODES = ["left", "right", "color", "none"] as const;
type PlatformIconMode = (typeof PLATFORM_ICON_MODES)[number];
const UI_SIZE_MIN = 60;
const UI_SIZE_MAX = 130;
const UI_SIZE_DEFAULT = 100;
type Prefs = {
  showTests: boolean;
  showMessages: boolean;
  platformIcons: PlatformIconMode;
  uiSize: number;
};
const DEFAULT_PREFS: Prefs = {
  showTests: true,
  showMessages: true,
  platformIcons: "left",
  uiSize: UI_SIZE_DEFAULT,
};

function clampUiSize(value: number): number {
  return Math.min(UI_SIZE_MAX, Math.max(UI_SIZE_MIN, Math.round(value)));
}

function readPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const stored = JSON.parse(raw) as Partial<Prefs>;
    return {
      showTests: typeof stored.showTests === "boolean" ? stored.showTests : DEFAULT_PREFS.showTests,
      showMessages:
        typeof stored.showMessages === "boolean" ? stored.showMessages : DEFAULT_PREFS.showMessages,
      platformIcons: PLATFORM_ICON_MODES.includes(stored.platformIcons as PlatformIconMode)
        ? (stored.platformIcons as PlatformIconMode)
        : DEFAULT_PREFS.platformIcons,
      uiSize:
        typeof stored.uiSize === "number" && Number.isFinite(stored.uiSize)
          ? clampUiSize(stored.uiSize)
          : DEFAULT_PREFS.uiSize,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/**
 * UI Size scales the dock by changing the page's root font size. Every size and spacing in
 * this page (and in the Radix popovers and tooltips, which portal to the body) is in rem,
 * so the layout is recomputed instead of being transformed: nothing is clipped and no
 * unaccounted space is left. The same inline script is run from the route head to avoid a
 * flash at 100% before hydration.
 */
const UI_SIZE_BOOT_SCRIPT = `try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_KEY)})||"{}");var s=Number(p.uiSize);if(s>=${UI_SIZE_MIN}&&s<=${UI_SIZE_MAX})document.documentElement.style.fontSize=Math.round(s)+"%"}catch(e){}`;

function UiSizeControl({
  value,
  onChange,
  label,
  resetLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  resetLabel: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = (text: string, final: boolean) => {
    setDraft(text);
    const parsed = Number(text);
    if (text.trim() === "" || !Number.isFinite(parsed)) {
      if (final) setDraft(String(value));
      return;
    }
    if (final) onChange(clampUiSize(parsed));
    else if (parsed >= UI_SIZE_MIN && parsed <= UI_SIZE_MAX) onChange(Math.round(parsed));
  };

  return (
    <div className="px-2 py-1.5" onKeyDown={(event) => event.stopPropagation()}>
      <div className="flex items-center gap-2">
        <input
          type="range"
          aria-label={label}
          min={UI_SIZE_MIN}
          max={UI_SIZE_MAX}
          step={1}
          value={value}
          onChange={(event) => onChange(clampUiSize(Number(event.target.value)))}
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[#bee1fc]"
        />
        <label className="flex shrink-0 items-center gap-0.5 rounded-md border border-white/15 bg-black/30 px-1.5 text-[0.8125rem] tabular-nums focus-within:border-[#bee1fc]/60">
          <input
            type="number"
            dir="ltr"
            inputMode="numeric"
            aria-label={`${label} %`}
            min={UI_SIZE_MIN}
            max={UI_SIZE_MAX}
            value={draft}
            onChange={(event) => commit(event.target.value, false)}
            onBlur={(event) => commit(event.target.value, true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit((event.target as HTMLInputElement).value, true);
            }}
            className="h-6 w-[2.6rem] bg-transparent text-end outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span aria-hidden className="text-white/50">
            %
          </span>
        </label>
      </div>
      <button
        type="button"
        disabled={value === UI_SIZE_DEFAULT}
        onClick={() => onChange(UI_SIZE_DEFAULT)}
        className="mt-1.5 flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[0.8125rem] text-white/80 transition-colors hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <RotateCcw className="size-3.5" aria-hidden />
        {resetLabel}
      </button>
    </div>
  );
}

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
            className={`relative flex size-8 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-35 group-data-[compact]/dock:size-7 group-data-[tiny]/dock:size-[1.625rem] ${
              active
                ? "bg-[#bee1fc]/15 text-[#bee1fc]"
                : "text-white/85 hover:bg-white/[0.07] hover:text-white"
            }`}
          >
            {children}
            {badge ? (
                          <span className="absolute -end-0.5 -top-0.5 flex h-[0.9375rem] min-w-[0.9375rem] items-center justify-center rounded-full bg-[#bee1fc] px-1 text-[0.5625rem] font-bold leading-none text-[#0a0a0a]">
                {badge > 99 ? "99+" : badge}
              </span>
            ) : null}
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className={TIP}
        sideOffset={6}
        collisionPadding={6}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

const TIP = "rounded-md px-2 py-1 text-[0.6875rem] leading-tight";
const MENU_LABEL = "px-2 py-1 text-[0.6875rem] font-medium text-white/50";
const MENU_CONTENT =
  "min-w-[10rem] max-w-[min(18rem,calc(100vw-1rem))] rounded-lg border-white/10 bg-[#111] p-1 text-[0.8125rem]";
const MENU_ITEM = "rounded-md px-2 py-1.5 text-[0.8125rem]";

function ActivityFeedDock() {
  // The fixed demo channel id doubles as the Demo store's dock key; it is not a secret.
  const { demoChannelId: token } = Route.useParams();
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

  const [prefsReady, setPrefsReady] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  useEffect(() => {
    setPrefs(readPrefs());
    setPrefsReady(true);
  }, []);

  // Scale variable: the root font size drives every rem-based size and spacing on this page.
  useEffect(() => {
    if (!prefsReady) return;
    const root = document.documentElement;
    root.style.fontSize = prefs.uiSize === UI_SIZE_DEFAULT ? "" : `${prefs.uiSize}%`;
    return () => {
      root.style.fontSize = "";
    };
  }, [prefs.uiSize, prefsReady]);

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
  // "Left"/"Right" are physical sides, so in a right-to-left layout the logo's flex position is mirrored.
  const showLogo = prefs.platformIcons === "left" || prefs.platformIcons === "right";
  const logoFirst = showLogo && (prefs.platformIcons === "left") === (dir === "ltr");
  const iconsOnly = prefs.platformIcons === "none";
  const ui = prefs.uiSize / 100;
  // Compact layouts depend on the width in unscaled units, so they follow UI Size.
  const effectiveWidth = viewportWidth / ui;
  const compact = effectiveWidth > 0 && effectiveWidth < 380;
  const tiny = effectiveWidth > 0 && effectiveWidth < 340;

  return (
    <main
      className="group/dock fixed inset-0 overflow-hidden bg-[#0a0a0a] p-1.5 text-white"
      dir={dir}
      data-compact={compact ? "" : undefined}
      data-tiny={tiny ? "" : undefined}
    >
      <style>{`
        .dock-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.18) transparent; }
        .dock-scroll::-webkit-scrollbar { width: 0.375rem; }
        .dock-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.18); border-radius: 999px; }
        .dock-scroll::-webkit-scrollbar-track { background: transparent; }
        .dock-filters { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.18) transparent; }
        .dock-filters::-webkit-scrollbar { height: 0.25rem; }
        .dock-filters::-webkit-scrollbar-thumb { background: rgba(255,255,255,.18); border-radius: 999px; }
      `}</style>
      <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a]">
        <header className="relative flex h-12 shrink-0 items-center gap-1 border-b border-white/10 ps-3 pe-2 group-data-[compact]/dock:ps-2.5 group-data-[compact]/dock:pe-1.5">
          <h1 className="flex min-w-0 flex-1 items-center gap-2 text-[1.0625rem] font-bold leading-none group-data-[compact]/dock:text-[0.9375rem] group-data-[tiny]/dock:gap-1.5 group-data-[tiny]/dock:text-sm">
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
                className={TIP}
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
            {paused ? <Play className="size-[1.125rem]" fill="currentColor" /> : <Pause className="size-[1.125rem]" fill="currentColor" />}
          </IconButton>
          <IconButton
            label={muted ? t("activity.dock.unmute") : t("activity.dock.mute")}
            active={muted}
            disabled={controlsOff}
            onClick={() => void performAction(muted ? "unmute" : "mute")}
          >
            {muted ? <VolumeX className="size-[1.125rem]" /> : <Volume2 className="size-[1.125rem]" />}
          </IconButton>
          <IconButton
            label={hasCurrent ? t("activity.dock.skip") : t("activity.dock.skipIdle")}
            disabled={controlsOff || !hasCurrent}
            onClick={() => void performAction("skip")}
          >
            <SkipForward className="size-[1.125rem]" fill="currentColor" />
          </IconButton>
          <IconButton
            label={pendingCount ? t("activity.dock.clear") : t("activity.dock.clearNone")}
            badge={pendingCount}
            disabled={controlsOff || pendingCount === 0}
            onClick={() => setConfirmClear(true)}
          >
            <Trash2 className="size-[1.125rem]" />
          </IconButton>

          <span className="mx-0.5 h-5 w-px shrink-0 bg-white/15 group-data-[compact]/dock:mx-0" aria-hidden />

          <DropdownMenu dir={dir}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("activity.dock.filterTypes")}
                    className={`relative flex size-8 items-center justify-center rounded-md transition-colors group-data-[compact]/dock:size-7 group-data-[tiny]/dock:size-[1.625rem] ${
                      activeFilter
                        ? "bg-[#bee1fc]/15 text-[#bee1fc]"
                        : "text-white/85 hover:bg-white/[0.07] hover:text-white"
                    }`}
                  >
                                        <FilterIcon className="size-[1.125rem]" fill="currentColor" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className={TIP}
                sideOffset={6}
              >
                {t("activity.dock.filterTypes")}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className={`${MENU_CONTENT} w-56`}>
              <DropdownMenuLabel className={MENU_LABEL}>
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
                    className="flex size-8 items-center justify-center rounded-md text-white/85 transition-colors hover:bg-white/[0.07] hover:text-white group-data-[compact]/dock:size-7 group-data-[tiny]/dock:size-[1.625rem]"
                  >
                                        <Settings className="size-[1.125rem]" fill="currentColor" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                                    className={TIP}
                sideOffset={6}
              >
                {t("activity.dock.settings")}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className={`${MENU_CONTENT} w-64`}>
              <DropdownMenuLabel className={MENU_LABEL}>
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
              <DropdownMenuLabel className={MENU_LABEL}>
                {t("activity.dock.settings.platformIcons")}
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={prefs.platformIcons}
                onValueChange={(value) => {
                  if (PLATFORM_ICON_MODES.includes(value as PlatformIconMode)) {
                    updatePrefs({ platformIcons: value as PlatformIconMode });
                  }
                }}
              >
                {PLATFORM_ICON_MODES.map((mode) => (
                  <DropdownMenuRadioItem
                    key={mode}
                    value={mode}
                    className={MENU_ITEM}
                    onSelect={(event) => event.preventDefault()}
                  >
                    {t(`activity.dock.platformIcons.${mode}` as TranslationKey)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuLabel className={MENU_LABEL}>
                {t("activity.dock.settings.uiSize")}
              </DropdownMenuLabel>
              <UiSizeControl
                value={prefs.uiSize}
                onChange={(uiSize) => updatePrefs({ uiSize })}
                label={t("activity.dock.settings.uiSize")}
                resetLabel={t("activity.dock.settings.uiSizeReset")}
              />
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
              <p className="px-2 py-1.5 text-[0.6875rem] leading-snug text-white/45">
                {t("activity.dock.settings.syncNote")}
              </p>
            </DropdownMenuContent>
          </DropdownMenu>

          {confirmClear ? (
            <div
              ref={confirmRef}
              role="alertdialog"
              aria-label={t("activity.dock.clear")}
              className="absolute end-2               top-[calc(100%+0.25rem)] z-30 w-56 max-w-[calc(100%-1rem)] rounded-lg border border-white/10 bg-[#111] p-3 shadow-xl shadow-black/60"
            >
                            <p className="text-[0.8125rem] font-semibold">
                {t("activity.dock.clearConfirm", { n: pendingCount })}
              </p>
                            <p className="mt-0.5 text-[0.6875rem] text-white/50">{t("activity.dock.clearHint")}</p>
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
          className="dock-filters flex shrink-0 scroll-smooth items-center gap-1 overflow-x-auto border-b border-white/10 px-2.5 py-2 group-data-[compact]/dock:px-2"
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
                className={`flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2 text-[0.8125rem] leading-none transition-colors ${
                  selected
                    ? "border-[#bee1fc]/45 bg-[#bee1fc]/12 text-white"
                    : "border-white/12 text-white/80 hover:bg-white/[0.05]"
                }`}
              >
                <FilterGlyph id={id} size={FILTER_LOGO_PX * ui} />
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
            <p className="flex items-start gap-2 px-4 py-8 text-[0.8125rem] leading-snug text-white/60">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t("activity.dock.invalid")}
            </p>
          ) : loading && !data ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-white/50">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              {t("activity.dock.loading")}
            </div>
          ) : visibleEvents.length === 0 ? (
            <p className="px-4 py-12 text-center text-[0.8125rem] text-white/50">
              {data && data.events.length > 0 ? t("activity.dock.emptyFilter") : t("activity.dock.empty")}
            </p>
          ) : (
            <ul>
              {visibleEvents.map((event) => {
                const { phrase, text } = describeFeedEvent(event, label);
                const TypeIcon = TYPE_ICON[phrase];
                // None keeps the event icon in front of the user name; it never falls back to nothing.
                const LeadIcon = iconsOnly ? (TypeIcon ?? Bell) : null;
                const edge = PLATFORM_EDGE[event.platform] ?? "#71717a";
                const replaying = replayingId === event.id;
                const replayLabel = event.replayAvailable
                  ? t("activity.dock.replay")
                  : t("activity.dock.replayUnavailable");
                const logo = showLogo ? (
                  <span
                    data-platform-icon={prefs.platformIcons}
                    className={`flex w-[0.8125rem] shrink-0 items-center justify-center ${
                      logoFirst ? "-me-1" : "-ms-1"
                    }`}
                  >
                    <PlatformIcon platform={event.platform} size={ROW_LOGO_PX * ui} />
                  </span>
                ) : null;
                return (
                  <li
                    key={event.id}
                    className={`relative flex min-h-[3.25rem] items-center gap-2.5 border-b border-white/[0.07] py-2 pe-1.5                     hover:bg-white/[0.025] group-data-[compact]/dock:gap-2 ${
                      prefs.platformIcons === "color"
                                            ? "ps-5 group-data-[compact]/dock:ps-4"
                                            : "ps-2.5 group-data-[compact]/dock:ps-2"
                    }`}
                  >
                    {prefs.platformIcons === "color" ? (
                      <span
                        aria-hidden
                        data-platform-color={event.platform}
                        className="absolute start-2 top-1/2 h-8 w-[0.1875rem] -translate-y-1/2 rounded-full group-data-[compact]/dock:start-1.5"
                        style={{ background: edge }}
                      />
                    ) : null}
                    {logoFirst ? logo : null}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-1.5 text-[0.9375rem] leading-[1.375rem] group-data-[compact]/dock:flex-col group-data-[compact]/dock:items-start group-data-[compact]/dock:gap-0 group-data-[compact]/dock:text-sm group-data-[compact]/dock:leading-5">
                        <span className="flex min-w-0 items-center gap-1.5">
                          {LeadIcon ? (
                            <LeadIcon
                              data-event-icon={phrase}
                              className="size-4 shrink-0 text-white/75"
                              aria-hidden
                            />
                          ) : null}
                          <bdi className="break-words font-bold">
                            {event.actor_name ?? t("activity.anonymous")}
                          </bdi>
                        </span>
                        <ChevronRight className="size-3.5 shrink-0 text-white/35 rtl:rotate-180 group-data-[compact]/dock:hidden" aria-hidden />
                        <span className="flex min-w-0 items-center gap-1 text-white/90">
                          {TypeIcon && !iconsOnly ? (
                            <TypeIcon
                              data-event-icon={phrase}
                              className="size-3.5 shrink-0 text-white/50"
                              aria-hidden
                            />
                          ) : null}
                          <bdi className="break-words">{text}</bdi>
                          {event.isTest ? (
                            <span className="ms-1 rounded bg-white/10 px-1 text-[0.625rem] leading-4 text-white/55">
                              {t("activity.dock.testBadge")}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      {prefs.showMessages && event.message ? (
                        <p className="line-clamp-2 break-words text-[0.8125rem] leading-snug text-white/45" dir="auto">
                          {event.message}
                        </p>
                      ) : null}
                    </div>
                    {!logoFirst ? logo : null}
                    <time
                      className="ms-auto shrink-0 ps-1 text-[0.8125rem] tabular-nums text-white/50"
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
                              <LoaderCircle className="size-[1.0625rem] animate-spin" aria-hidden />
                            ) : (
                              <RefreshCw className="size-[1.0625rem]" aria-hidden />
                            )}
                          </button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent
                        side="left"
                        className={TIP}
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
