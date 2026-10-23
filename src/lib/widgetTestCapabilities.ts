import { TEST_EVENT_GROUPS, type TestEventGroup } from "@/lib/testEvents";
import { selectedEventLabelOptions } from "@/lib/eventLabels";

export function widgetTestGroups(type: string, config?: Record<string, unknown>): TestEventGroup[] {
  const kind = type === "GOAL_BAR" ? `${String(config?.["goalType"] ?? "")}_GOAL` : type;
  const labels = selectedEventLabelOptions(config?.["labels"]);
  return TEST_EVENT_GROUPS.map((group) => ({
    ...group,
    events: group.events.filter((event) => {
      if (kind === "KICKS_GOAL") return group.platform === "KICK" && event.type === "BITS";
      if (kind === "FOLLOWER_GOAL") return event.type === "FOLLOW";
      if (kind === "SUBSCRIBER_GOAL")
        return event.type === "SUBSCRIPTION" || event.type === "GIFT_SUB";
      if (kind === "DONATION_GOAL") return event.type === "DONATION";
      if (kind === "TIKTOK_TAPPERS" || kind === "TIKTOK_TAP_GOAL")
        return group.platform === "TIKTOK" && event.type === "LIKE";
      if (kind === "SUBATHON_TIMER")
        return ["SUBSCRIPTION", "GIFT_SUB", "BITS", "DONATION"].includes(event.type);
      if (kind === "EVENT_LABELS") {
        if (event.type === "BITS")
          return group.platform === "KICK"
            ? labels.includes("lastKicks") || labels.includes("topKicks")
            : group.platform === "TWITCH" && labels.includes("topBits");
        if (event.type === "FOLLOW") return labels.includes("lastFollow");
        if (event.type === "DONATION") return labels.includes("lastDonation");
        if (event.type === "SUBSCRIPTION") return labels.includes("lastSub");
        if (event.type === "GIFT_SUB")
          return labels.includes("lastGift") || labels.includes("topGift");
        if (event.type === "RAID") return labels.includes("lastRaid") || labels.includes("topRaid");
        return false;
      }
      return kind === "ALERT_BOX" || kind === "EMOTE_RAIN";
    }),
  })).filter((group) => group.events.length > 0);
}
