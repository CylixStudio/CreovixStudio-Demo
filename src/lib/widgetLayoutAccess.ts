import {
  parseChromeLayout,
  parseEventLabelLayout,
  parseGoalLayout,
  parseViewerLayout,
  parseWheelLayout,
} from "@/lib/widgetLayouts";

const PRO_LAYOUTS: Readonly<Record<string, readonly string[]>> = {
  GOAL_BAR: ["bold", "glass", "ring", "segments", "scoreboard", "cinema"],
  DONATION_GOAL: ["bold", "glass", "ring", "segments", "scoreboard", "cinema"],
  FOLLOWER_GOAL: ["bold", "glass", "ring", "segments", "scoreboard", "cinema"],
  SUBSCRIBER_GOAL: ["bold", "glass", "ring", "segments", "scoreboard", "cinema"],
  KICKS_GOAL: ["bold", "glass", "ring", "segments", "scoreboard", "cinema"],
  CUSTOM_GOAL: ["bold", "glass", "ring", "segments", "scoreboard", "cinema"],
  VIEWER_COUNTER: ["bar", "digital", "live", "lower-third", "hud", "ambient"],
  SPIN_WHEEL: ["bare", "show", "bottom", "studio", "spotlight", "orbit"],
  EVENT_LABELS: ["stack", "cycle", "floating", "timeline", "spotlight", "ribbon"],
  PREDICTION: ["split", "particle-clash", "scoreboard", "duel", "ribbon", "odds"],
  POLL: ["cards", "columns", "ballot", "leaderboard", "donut", "split"],
  GIVEAWAY: ["bold", "spotlight", "podium", "ticket", "split", "ribbon"],
  CHAT_SPOTLIGHT: ["bold", "lower-third", "message", "pill", "split", "featured"],
  STREAM_EVENTS_SCHEDULE: ["glass", "bold", "timeline", "calendar", "roadmap", "spotlight"],
  SUBATHON_TIMER: [
    "cute_heart",
    "broadcast",
    "split_clock",
    "circular_pomodoro",
    "multi_ring_countdown",
    "tower",
  ],
};

export function isProWidgetLayout(type: string, config: unknown): boolean {
  const source = config && typeof config === "object" ? (config as Record<string, unknown>) : {};
  let layout: unknown = source["layout"];
  if (
    [
      "GOAL_BAR",
      "DONATION_GOAL",
      "FOLLOWER_GOAL",
      "SUBSCRIBER_GOAL",
      "KICKS_GOAL",
      "CUSTOM_GOAL",
    ].includes(type)
  )
    layout = parseGoalLayout(source);
  else if (type === "VIEWER_COUNTER") layout = parseViewerLayout(source);
  else if (type === "SPIN_WHEEL") layout = parseWheelLayout(source);
  else if (type === "EVENT_LABELS") layout = parseEventLabelLayout(source);
  else if (type === "CHAT_SPOTLIGHT") layout = parseChromeLayout(source);
  else {
    const defaults: Record<string, string> = {
      STREAM_EVENTS_SCHEDULE: "glass",
      SUBATHON_TIMER: "cute_heart",
    };
    if (
      defaults[type] &&
      (typeof layout !== "string" ||
        ![
          ...(PRO_LAYOUTS[type] ?? []),
          ...(type === "SUBATHON_TIMER" ? ["raw_digits", "island"] : ["direct", "agenda"]),
        ].includes(layout))
    )
      layout = defaults[type];
  }
  return typeof layout === "string" && Boolean(PRO_LAYOUTS[type]?.includes(layout));
}

export function assertWidgetLayoutAccess(type: string, config: unknown, proActive: boolean): void {
  if (!proActive && isProWidgetLayout(type, config)) {
    throw new Error("This layout requires Pro. Choose a free layout or enable the Demo Pro plan.");
  }
}
