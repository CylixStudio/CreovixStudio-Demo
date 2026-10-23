const PRO_LAYOUTS: Readonly<Record<string, readonly string[]>> = {
  GOAL_BAR: ["bold", "glass", "ring", "segments"],
  DONATION_GOAL: ["bold", "glass", "ring", "segments"],
  FOLLOWER_GOAL: ["bold", "glass", "ring", "segments"],
  SUBSCRIBER_GOAL: ["bold", "glass", "ring", "segments"],
  KICKS_GOAL: ["bold", "glass", "ring", "segments"],
  CUSTOM_GOAL: ["bold", "glass", "ring", "segments"],
  VIEWER_COUNTER: ["bar", "digital"],
  SPIN_WHEEL: ["compact", "show"],
  EVENT_LABELS: ["floating", "timeline"],
  PREDICTION: ["split", "particle-clash"],
  POLL: ["cards", "columns"],
  CHAT_SPOTLIGHT: ["message"],
  STREAM_EVENTS_SCHEDULE: ["timeline", "calendar"],
  SUBATHON_TIMER: ["broadcast"],
};

export function isProWidgetLayout(type: string, config: unknown): boolean {
  if (!config || typeof config !== "object") return false;
  const layout = (config as Record<string, unknown>)["layout"];
  return typeof layout === "string" && Boolean(PRO_LAYOUTS[type]?.includes(layout));
}

export function assertWidgetLayoutAccess(type: string, config: unknown, proActive: boolean): void {
  if (!proActive && isProWidgetLayout(type, config)) {
    throw new Error("This layout requires Pro. Choose a free layout or enable the Demo Pro plan.");
  }
}
