import type { TranslationKey } from "@/lib/i18n";
import { triggerPhrase } from "@/lib/platformEvents";
/**
 * Consecutive activity-feed grouping.
 *
 * A run is two or more events that sit next to each other in the current list
 * (newest first) and share the same actor and the same event type. A different
 * actor or a different event type ends the run. Repeats that are not adjacent
 * stay separate rows. Every event remains in the group.
 */
export type GroupableFeedEvent = {
  id: string;
  platform: string;
  event_type: string;
  actor_name: string | null;
};

export type FeedEventGroup<T extends GroupableFeedEvent> = {
  /** Oldest event id in the run, so a newer repeat does not remount the row. */
  id: string;
  events: T[];
};

export type ActivityFeedEvent = GroupableFeedEvent & {
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

export const ACTIVITY_FEED_FILTERS = [
  { id: "all", label: "activity.allPlatforms" },
  { id: "kick", label: "activity.filter.kick", platform: "KICK" },
  { id: "twitch", label: "activity.filter.twitch", platform: "TWITCH" },
  { id: "youtube", label: "activity.filter.youtube", platform: "YOUTUBE" },
  { id: "tiktok", label: "activity.filter.tiktok", platform: "TIKTOK" },
  { id: "x", label: "activity.filter.x", platform: "X" },
  { id: "streamlabs", label: "activity.filter.streamlabs", platform: "STREAMLABS" },
  { id: "streamelements", label: "activity.filter.streamelements", platform: "STREAMELEMENTS" },
  { id: "other", label: "activity.filter.other" },
] as const;

export function matchesActivityFeedFilter(
  event: ActivityFeedEvent,
  filterId: (typeof ACTIVITY_FEED_FILTERS)[number]["id"],
): boolean {
  if (filterId === "all") return true;
  const filter = ACTIVITY_FEED_FILTERS.find((f) => f.id === filterId);
  if (!filter) return false;
  if ("platform" in filter) return event.platform === filter.platform;
  return false;
}

function actorKey(name: string | null): string | null {
  const trimmed = (name ?? "").trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function sameRun(a: GroupableFeedEvent, b: GroupableFeedEvent): boolean {
  const actor = actorKey(a.actor_name);
  if (!actor || actor !== actorKey(b.actor_name)) return false;
  return a.event_type === b.event_type;
}

export function groupConsecutiveEvents<T extends GroupableFeedEvent>(
  events: readonly T[],
): FeedEventGroup<T>[] {
  const groups: FeedEventGroup<T>[] = [];
  for (const event of events) {
    const current = groups[groups.length - 1];
    const latest = current?.events[0];
    if (current && latest && sameRun(latest, event)) {
      current.events.push(event);
      current.id = event.id;
      continue;
    }
    groups.push({ id: event.id, events: [event] });
  }
  return groups;
}

type Translate = (key: TranslationKey) => string;

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

function formatMoney(amount: number, currency: string | null): string {
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      }).format(amount);
    } catch {
      return `${formatNumber(amount)} ${currency}`;
    }
  }
  return formatNumber(amount);
}

/**
 * One-line description of a feed record ("500 Bits", "Raid ×48", "Super Chat $50").
 * Shared by the Activity Feed page and the OBS Dock so both read the same.
 */
export function describeFeedEvent(
  event: Pick<ActivityFeedEvent, "platform" | "event_type" | "amount" | "currency" | "quantity">,
  t: Translate,
): { phrase: string; text: string } {
  const phrase = triggerPhrase(event.platform, event.event_type);
  const typeKey = `activity.dock.type.${phrase}` as TranslationKey;
  const translated = t(typeKey);
  const label = translated === typeKey ? event.event_type : translated;
  const quantity = Math.max(1, Math.round(Number(event.quantity) || 1));
  let text = label;
  if (phrase === "BITS" || phrase === "KICKS") {
    text = `${formatNumber(event.amount ?? quantity)} ${label}`;
  } else if (phrase === "DONATION" || phrase === "SUPER_CHAT") {
    text = event.amount != null ? `${label} ${formatMoney(event.amount, event.currency)}` : label;
  } else if (
    phrase === "RAID" ||
    ((phrase === "GIFT_SUB" || phrase === "GIFT") && quantity > 1)
  ) {
    text = `${label} ×${formatNumber(quantity)}`;
  }
  return { phrase, text };
}

/** Compact relative time: now / 5m / 3h / 2d (unit letters come from the dock keys). */
export function relativeFeedTime(iso: string, now: number, t: Translate): string {
  const diff = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (diff < 60) return t("activity.dock.now");
  if (diff < 3600) return `${Math.floor(diff / 60)}${t("activity.dock.unitMinute")}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}${t("activity.dock.unitHour")}`;
  return `${Math.floor(diff / 86400)}${t("activity.dock.unitDay")}`;
}