import { DEMO_USER_ID } from "@/lib/demoMode";
import { seedWheelConfig } from "@/lib/widgets";

export type DemoWidget = {
  id: string;
  user_id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  state: Record<string, unknown>;
  subathon_id: string | null;
  public_token: string;
  is_enabled: boolean;
  created_at: string;
};

export type DemoGoal = {
  id: string;
  widget_id: string;
  user_id: string;
  title: string;
  unit: string;
  target_value: number;
  current_value: number;
};

export type DemoBadge = {
  type: string;
  text?: string | null;
  count?: number | null;
};

export type DemoChatMessage = {
  id: string;
  platform: "KICK" | "TWITCH" | "TEST";
  author: string;
  color: string | null;
  badges: string[];
  badgeList?: DemoBadge[];
  avatarUrl?: string | null;
  text: string;
  at: number;
};

export type DemoFrame = {
  status: "IDLE" | "RUNNING" | "PAUSED" | "ENDED";
  accumulatedSeconds: number;
  startedAt: string | null;
  pausedAt: string | null;
  expiresAt: string | null;
  totalAddedSeconds: number;
  maxTimeSeconds: number | null;
  revision: number;
  remainingSeconds: number;
  remainingMs: number;
  endAtMs: number | null;
  serverTime: number;
  serverOffsetMs: number;
};

export type DemoFile = {
  widgets: DemoWidget[];
  goals: DemoGoal[];
  messages: Record<string, DemoChatMessage[]>;
  frames: Record<string, DemoFrame>;
};

export function emptyDemoFile(): DemoFile {
  return { widgets: [], goals: [], messages: {}, frames: {} };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function normalizeDemoFile(raw: unknown): DemoFile {
  const source = asRecord(raw);
  const widgets = Array.isArray(source["widgets"]) ? source["widgets"] : [];
  const goals = Array.isArray(source["goals"]) ? source["goals"] : [];
  const messages = asRecord(source["messages"]);
  const frames = asRecord(source["frames"]);
  const next: DemoFile = emptyDemoFile();
  for (const item of widgets) {
    const row = asRecord(item);
    const id = typeof row["id"] === "string" ? row["id"] : "";
    const token = typeof row["public_token"] === "string" ? row["public_token"] : "";
    if (!id || !token.startsWith("demo-")) continue;
    const type = typeof row["type"] === "string" ? row["type"] : "CHAT_BOX";
    const config = asRecord(row["config"]);
    next.widgets.push({
      id,
      user_id: DEMO_USER_ID,
      name: typeof row["name"] === "string" && row["name"].trim() ? row["name"].trim() : "Widget",
      type,
      config: type === "SPIN_WHEEL" ? seedWheelConfig(config) : config,
      state: asRecord(row["state"]),
      subathon_id: typeof row["subathon_id"] === "string" ? row["subathon_id"] : null,
      public_token: token,
      is_enabled: row["is_enabled"] !== false,
      created_at: typeof row["created_at"] === "string" ? row["created_at"] : new Date().toISOString(),
    });
  }
  for (const item of goals) {
    const row = asRecord(item);
    const id = typeof row["id"] === "string" ? row["id"] : "";
    const widgetId = typeof row["widget_id"] === "string" ? row["widget_id"] : "";
    if (!id || !widgetId) continue;
    next.goals.push({
      id,
      widget_id: widgetId,
      user_id: DEMO_USER_ID,
      title: typeof row["title"] === "string" ? row["title"] : "Goal",
      unit: typeof row["unit"] === "string" ? row["unit"] : "USD",
      target_value: Number(row["target_value"]) || 0,
      current_value: Number(row["current_value"]) || 0,
    });
  }
  for (const [token, rows] of Object.entries(messages)) {
    if (!token.startsWith("demo-") || !Array.isArray(rows)) continue;
    next.messages[token] = rows
      .map((item) => asRecord(item))
      .filter((row) => typeof row["id"] === "string" && typeof row["text"] === "string")
      .slice(0, 40)
      .map((row) => ({
        id: String(row["id"]),
        platform: row["platform"] === "TWITCH" || row["platform"] === "TEST" ? row["platform"] : "KICK",
        author: typeof row["author"] === "string" ? row["author"].slice(0, 40) : "DemoUser",
        color: typeof row["color"] === "string" ? row["color"] : null,
        badges: Array.isArray(row["badges"]) ? row["badges"].filter((badge) => typeof badge === "string").slice(0, 12) : [],
        badgeList: Array.isArray(row["badgeList"])
          ? row["badgeList"].map((badge) => asRecord(badge)).filter((badge) => typeof badge["type"] === "string").slice(0, 12).map((badge) => ({
              type: String(badge["type"]),
              text: typeof badge["text"] === "string" ? badge["text"] : null,
              count: typeof badge["count"] === "number" ? badge["count"] : null,
            }))
          : undefined,
        avatarUrl: typeof row["avatarUrl"] === "string" ? row["avatarUrl"] : null,
        text: String(row["text"]).slice(0, 800),
        at: typeof row["at"] === "number" ? row["at"] : Date.now(),
      }));
  }
  for (const [id, frame] of Object.entries(frames)) {
    const row = asRecord(frame);
    if (row["status"] !== "RUNNING" && row["status"] !== "PAUSED" && row["status"] !== "ENDED" && row["status"] !== "IDLE") continue;
    next.frames[id] = row as DemoFrame;
  }
  return next;
}
