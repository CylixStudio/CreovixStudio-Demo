import { DEMO_USER_ID } from "@/lib/demoMode";
import {
  emptyDemoFile,
  normalizeDemoFile,
  type DemoChatMessage,
  type DemoFile,
  type DemoFrame,
  type DemoGoal,
  type DemoWidget,
} from "@/lib/demoState";

const STORAGE_KEY = "cylixstudio-demo:v1";
const CHANGE_EVENT = "cylix-demo";

let cache: DemoFile | null = null;
let cacheRaw = "";
let serverRev = 0;
let chain: Promise<unknown> = Promise.resolve();

export function demoStorageKey(): string {
  return STORAGE_KEY;
}

export function peekDemoCache(): DemoFile | null {
  return cache;
}

function remember(state: DemoFile) {
  const raw = JSON.stringify(state);
  cache = state;
  if (raw === cacheRaw) return;
  cacheRaw = raw;
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    /* ignore quota */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function demoChangeEvent(): string {
  return CHANGE_EVENT;
}

export async function loadDemoState(options?: { wait?: boolean; signal?: AbortSignal }): Promise<DemoFile> {
  const wait = options?.wait === true;
  const url = wait ? `/api/demo/state?wait=1&since=${serverRev}` : "/api/demo/state";
  try {
    const response = await fetch(url, { cache: "no-store", signal: options?.signal });
    if (response.status === 204) return cache ?? emptyDemoFile();
    if (response.ok) {
      const rev = Number(response.headers.get("x-demo-rev"));
      if (Number.isFinite(rev)) serverRev = rev;
      const next = normalizeDemoFile(await response.json());
      remember(next);
      return next;
    }
  } catch {
    /* local fallback below */
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const next = raw ? normalizeDemoFile(JSON.parse(raw)) : emptyDemoFile();
    cache = next;
    return next;
  } catch {
    return cache ?? emptyDemoFile();
  }
}

export function updateDemoState(mutator: (state: DemoFile) => DemoFile): Promise<DemoFile> {
  const run = chain.then(async () => {
    const current = cache ?? (await loadDemoState());
    const next = normalizeDemoFile(mutator(current));
    remember(next);
    const response = await fetch("/api/demo/state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!response.ok) throw new Error("Could not save demo data");
    const saved = normalizeDemoFile(await response.json());
    remember(saved);
    return saved;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function newId(): string {
  return crypto.randomUUID();
}

export async function insertDemoWidget(args: {
  userId: string;
  type: string;
  name: string;
  subathonId: string | null;
  config: Record<string, unknown>;
  goal?: { title: string; unit: string; target: number } | null;
}): Promise<{ id: string; public_token: string }> {
  const singleton = new Set([
    "KICKS_GOAL",
    "VIEWER_COUNTER",
    "SPIN_WHEEL",
    "EVENT_LABELS",
    "GOAL_BAR",
    "DONATION_GOAL",
    "FOLLOWER_GOAL",
    "SUBSCRIBER_GOAL",
    "CUSTOM_GOAL",
    "POLL",
    "PREDICTION",
  ]);
  let created: { id: string; public_token: string } | null = null;
  await updateDemoState((state) => {
    if (singleton.has(args.type)) {
      const existing = state.widgets.find((widget) => widget.type === args.type);
      if (existing) {
        created = { id: existing.id, public_token: existing.public_token };
        return state;
      }
    }
    const widget: DemoWidget = {
      id: newId(),
      user_id: args.userId || DEMO_USER_ID,
      name: args.name,
      type: args.type,
      config: args.config,
      state: {},
      subathon_id: args.subathonId,
      public_token: `demo-${newId()}`,
      is_enabled: true,
      created_at: new Date().toISOString(),
    };
    created = { id: widget.id, public_token: widget.public_token };
    const goals = [...state.goals];
    if (args.goal) {
      goals.push({
        id: newId(),
        widget_id: widget.id,
        user_id: widget.user_id,
        title: args.goal.title,
        unit: args.goal.unit,
        target_value: args.goal.target,
        current_value: 0,
      });
    }
    const frames = { ...state.frames };
    if (args.type === "SUBATHON_TIMER") {
      frames[widget.id] = runningFrame();
    }
    return { ...state, widgets: [...state.widgets, widget], goals, frames };
  });
  if (!created) throw new Error("Could not create the demo widget.");
  return created;
}

function runningFrame(): DemoFrame {
  const remainingMs = 2 * 60 * 60 * 1000;
  const now = Date.now();
  return {
    status: "RUNNING",
    accumulatedSeconds: 7200,
    startedAt: new Date(now).toISOString(),
    pausedAt: null,
    expiresAt: new Date(now + remainingMs).toISOString(),
    totalAddedSeconds: 0,
    maxTimeSeconds: null,
    revision: now,
    remainingSeconds: 7200,
    remainingMs,
    endAtMs: now + remainingMs,
    serverTime: now,
    serverOffsetMs: 0,
  };
}

export async function ensureDemoSubathon(widgetId: string): Promise<string> {
  let subathonId = "";
  await updateDemoState((state) => {
    const widget = state.widgets.find((item) => item.id === widgetId);
    if (!widget) throw new Error("Widget not found.");
    subathonId = widget.subathon_id ?? `demo-subathon-${widget.id.slice(0, 8)}`;
    return {
      ...state,
      widgets: state.widgets.map((item) => (item.id === widgetId ? { ...item, subathon_id: subathonId } : item)),
      frames: state.frames[widgetId] ? state.frames : { ...state.frames, [widgetId]: runningFrame() },
    };
  });
  return subathonId;
}

export async function saveDemoWidget(input: {
  widgetId: string;
  name: string;
  config: Record<string, unknown>;
  goal?: { id: string; title: string; unit: string; target: number; current: number } | null;
}): Promise<void> {
  await updateDemoState((state) => ({
    ...state,
    widgets: state.widgets.map((widget) =>
      widget.id === input.widgetId ? { ...widget, name: input.name, config: input.config } : widget,
    ),
    goals: input.goal
      ? state.goals.map((goal) =>
          goal.id === input.goal?.id
            ? {
                ...goal,
                title: input.goal.title,
                unit: input.goal.unit,
                target_value: input.goal.target,
                current_value: input.goal.current,
              }
            : goal,
        )
      : state.goals,
  }));
}

export async function deleteDemoWidget(widgetId: string): Promise<void> {
  await updateDemoState((state) => {
    const widget = state.widgets.find((item) => item.id === widgetId);
    const messages = { ...state.messages };
    if (widget) delete messages[widget.public_token];
    const frames = { ...state.frames };
    delete frames[widgetId];
    return {
      ...state,
      widgets: state.widgets.filter((item) => item.id !== widgetId),
      goals: state.goals.filter((goal) => goal.widget_id !== widgetId),
      messages,
      frames,
    };
  });
}

export async function setDemoWidgetState(widgetId: string, widgetState: Record<string, unknown>): Promise<void> {
  await updateDemoState((state) => ({
    ...state,
    widgets: state.widgets.map((widget) => (widget.id === widgetId ? { ...widget, state: widgetState } : widget)),
  }));
}

export async function setDemoGoalCurrent(goalId: string, current: number): Promise<void> {
  await updateDemoState((state) => ({
    ...state,
    goals: state.goals.map((goal) => (goal.id === goalId ? { ...goal, current_value: current } : goal)),
  }));
}

export async function appendDemoMessages(token: string, messages: DemoChatMessage[]): Promise<void> {
  await updateDemoState((state) => ({
    ...state,
    messages: {
      ...state.messages,
      [token]: [...messages, ...(state.messages[token] ?? [])].slice(0, 40),
    },
  }));
}

export async function clearDemoMessages(token: string): Promise<void> {
  await updateDemoState((state) => ({
    ...state,
    messages: { ...state.messages, [token]: [] },
  }));
}

export type { DemoChatMessage, DemoFile, DemoGoal, DemoWidget };
