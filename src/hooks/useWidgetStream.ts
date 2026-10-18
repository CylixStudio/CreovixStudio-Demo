import { useEffect, useRef, useState } from "react";

import { demoChangeEvent, demoStorageKey, loadDemoState, peekDemoCache } from "@/lib/demoStore";
import { normalizeDemoFile, type DemoFile } from "@/lib/demoState";
import { isDemoToken } from "@/lib/demoMode";
import { getClientDb } from "@/demo/context";
import { DEMO_CHANGE_EVENT } from "@/demo/overlay";
import {
  createOverlayLink,
  eventFromBroadcast,
  FALLBACK_MS,
  mergeAlert,
  mergeServerEvents,
  needsDirectRead,
  SSE_BOOT_MS,
} from "@/lib/overlayTransport";
import { useTimerSession } from "@/hooks/useTimerSession";
import { useWidgetRealtime } from "@/hooks/useWidgetRealtime";
import type { ChatMessage, ChatSources } from "@/hooks/useLiveChat";
import {
  readChatLine,
  reconcileChatLines,
  type ChatLinkStatus,
  type OverlayChatLine,
} from "@/lib/overlayChat";
import { readReplyMeta } from "@/lib/replyAlert";
import type { StreamEventsRuntime } from "@/lib/streamEventsSchedule";
import type { PollRuntime, PredictionRuntime } from "@/lib/interactiveWidgets";
import type { TimerFrame } from "@/lib/timer";
import type {
  GoalSnapshot,
  OverlayEvent,
  SpinState,
  SpotlightMessage,
  TapperEntry,
  WidgetType,
} from "@/lib/widgets";

function mergePreviewTests(pending: OverlayEvent[], server: OverlayEvent[]) {
  const ids = new Set(server.map((event) => event.id));
  const nextPending = pending.filter((event) => !ids.has(event.id));
  if (nextPending.length === 0) return { pending: nextPending, events: server };
  const events = [...nextPending, ...server].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return { pending: nextPending, events };
}


export type StreamStatus = ChatLinkStatus;

export type StreamWidget = {
  id: string;
  name: string;
  type: WidgetType;
  config: unknown;
};

type Snapshot = {
  widget: StreamWidget;
  frame: TimerFrame | null;
  goal: GoalSnapshot | null;
  events: OverlayEvent[];
  spin: SpinState | null;
  spotlight?: SpotlightMessage | null;
  streamEvents?: StreamEventsRuntime | null;
  poll?: PollRuntime | null;
  prediction?: PredictionRuntime | null;
  tappers?: TapperEntry[];
  tapGoal?: { taps: number } | null;
  chat?: ChatSources | null;
  chatMessages?: OverlayChatLine[];
};

/**
 * One direct stream while it is healthy. /live runs only as the fallback
 * after the stream drops, plus a single read when a broadcast changes data
 * the stream has not pushed yet. The subathon second still comes from the
 * absolute end time.
 */
export function useWidgetStream(publicToken: string | null) {
  const [widget, setWidget] = useState<StreamWidget | null>(null);
  const [frame, setFrame] = useState<TimerFrame | null>(null);
  const countdown = useTimerSession(frame != null, publicToken);
  const [goal, setGoal] = useState<GoalSnapshot | null>(null);
  const [events, setEvents] = useState<OverlayEvent[]>([]);
  const [spin, setSpin] = useState<SpinState | null>(null);
  const [spotlight, setSpotlight] = useState<SpotlightMessage | null>(null);
  const [streamEvents, setStreamEvents] = useState<StreamEventsRuntime | null>(null);
  const [pollRuntime, setPollRuntime] = useState<PollRuntime | null>(null);
  const [predictionRuntime, setPredictionRuntime] = useState<PredictionRuntime | null>(null);
  const [tappers, setTappers] = useState<TapperEntry[]>([]);
  const [tapGoal, setTapGoal] = useState(0);
  const [chat, setChat] = useState<ChatSources | null>(null);
  const [chatMessages, setChatMessages] = useState<OverlayChatLine[]>([]);
  const [testMessages, setTestMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const previewTests = useRef<OverlayEvent[]>([]);
  const sawLive = useRef(false);

  const adoptServerEvents = (server: OverlayEvent[]) => {
    const merged = mergePreviewTests(previewTests.current, server);
    previewTests.current = merged.pending;
    return merged.events;
  };

  useEffect(() => {
    if (!publicToken || !isDemoToken(publicToken)) return;
    let cancelled = false;
    const applied = { raw: "" };
    const apply = (state: DemoFile) => {
      if (cancelled) return;
      const found = state.widgets.find((item) => item.public_token === publicToken);
      const signature = JSON.stringify({
        id: found?.id ?? "",
        config: found?.config ?? null,
        state: found?.state ?? null,
        goal: found ? (state.goals.find((item) => item.widget_id === found.id) ?? null) : null,
        frame: found ? (state.frames[found.id] ?? null) : null,
        messages: state.messages[publicToken] ?? [],
        name: found?.name ?? "",
        type: found?.type ?? "",
      });
      if (signature === applied.raw) return;
      applied.raw = signature;
      if (!found) {
        setStatus("error");
        setWidget(null);
        return;
      }
      setWidget({ id: found.id, name: found.name, type: found.type as WidgetType, config: found.config });
      const goalRow = state.goals.find((item) => item.widget_id === found.id);
      setGoal(
        goalRow
          ? {
              title: goalRow.title,
              unit: goalRow.unit,
              target: goalRow.target_value,
              current: goalRow.current_value,
            }
          : null,
      );
      const demoFrame = state.frames[found.id];
      if (demoFrame) {
        countdown.adopt(demoFrame, "sync");
        setFrame(demoFrame);
      }
      const spinState = found.state["spin"];
      setSpin(spinState && typeof spinState === "object" ? (spinState as SpinState) : null);
      setTestMessages(state.messages[publicToken] ?? []);
      setChat(null);
      setStatus("live");
    };
    const onChange = () => {
      const cached = peekDemoCache();
      if (cached) apply(cached);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== demoStorageKey() || !event.newValue) return;
      try {
        apply(normalizeDemoFile(JSON.parse(event.newValue)));
      } catch {
        /* ignore malformed demo storage */
      }
    };
    window.addEventListener(demoChangeEvent(), onChange);
    window.addEventListener("storage", onStorage);
    const controller = new AbortController();
    let pause: ReturnType<typeof setTimeout> | null = null;
    void (async () => {
      try {
        apply(await loadDemoState({ signal: controller.signal }));
      } catch {
        /* the wait loop below retries */
      }
      while (!cancelled) {
        try {
          apply(await loadDemoState({ wait: true, signal: controller.signal }));
        } catch {
          if (cancelled || controller.signal.aborted) return;
          await new Promise((resolve) => {
            pause = setTimeout(resolve, 300);
          });
        }
      }
    })();
    return () => {
      cancelled = true;
      if (pause) clearTimeout(pause);
      controller.abort();
      window.removeEventListener(demoChangeEvent(), onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [publicToken, countdown.adopt]);

  const pullRef = useRef<((reason: "fallback" | "refresh") => void) | null>(null);

  // Demo overlays read activity from the visitor's local demo database.
  useEffect(() => {
    if (!publicToken || !isDemoToken(publicToken)) return;
    const read = () => {
      const rows = getClientDb().rows("events");
      const mapped: OverlayEvent[] = rows
        .map((row) => {
          const raw = (row["raw_payload"] ?? {}) as Record<string, unknown>;
          return {
            id: String(row["id"]),
            platform: String(row["platform"] ?? "KICK"),
            eventType: String(row["event_type"] ?? "FOLLOW"),
            actorName: (row["actor_name"] as string | null) ?? null,
            amount: row["amount"] == null ? null : Number(row["amount"]),
            currency: (row["currency"] as string | null) ?? null,
            quantity: Number(row["quantity"] ?? 1),
            secondsAdded: Number(row["seconds_added"] ?? 0),
            createdAt: String(row["created_at"] ?? new Date().toISOString()),
            isTest: raw["isTest"] === true || raw["simulated"] === true || raw["test_harness"] === true,
          } satisfies OverlayEvent;
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 40);
      setEvents(mapped);
    };
    read();
    window.addEventListener(DEMO_CHANGE_EVENT, read);
    return () => window.removeEventListener(DEMO_CHANGE_EVENT, read);
  }, [publicToken]);

  // Runtime for the interactive widgets, derived from the saved widget config.
  useEffect(() => {
    if (!publicToken || !isDemoToken(publicToken) || !widget) return;
    const now = Date.now();
    if (widget.type === "POLL") {
      setPollRuntime({
        status: "open",
        title: "Which game should we play next?",
        options: [
          { id: "a", label: "Elden Ring", votes: 142 },
          { id: "b", label: "Hades II", votes: 96 },
          { id: "c", label: "Minecraft", votes: 61 },
        ],
        endsAt: new Date(now + 3_600_000).toISOString(),
        hideAt: null,
        winnerId: null,
        updatedAt: new Date(now).toISOString(),
        eventName: "demo",
        lastMessageId: null,
        revision: 1,
      });
    } else if (widget.type === "PREDICTION") {
      setPredictionRuntime({
        status: "open",
        title: "Will we beat the boss on the first try?",
        outcomes: [
          { id: "yes", label: "Yes", points: 18400, voters: 41 },
          { id: "no", label: "No", points: 26100, voters: 58 },
        ],
        endsAt: new Date(now + 3_600_000).toISOString(),
        hideAt: null,
        winnerId: null,
        updatedAt: new Date(now).toISOString(),
        eventName: "demo",
        lastMessageId: null,
        revision: 1,
      });
    } else if (widget.type === "STREAM_EVENTS_SCHEDULE") {
      setStreamEvents({ startedAt: new Date(now - 25 * 60_000).toISOString(), bonusElapsedSeconds: 0, revision: 1 });
    } else if (widget.type === "CHAT_SPOTLIGHT") {
      setSpotlight({
        id: "demo-spotlight",
        platform: "KICK",
        author: "Nova",
        color: "#bee1fc",
        text: "This stream setup is unreal. Cylix makes everything so smooth!",
        badges: ["vip"],
        badgeImages: [],
        pinnedAt: new Date(now).toISOString(),
        nonce: 1,
      });
    }
  }, [publicToken, widget?.id, widget?.type]);

  useEffect(() => {
    if (!publicToken || isDemoToken(publicToken)) return;
    const link = createOverlayLink();
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let fallback: ReturnType<typeof setInterval> | null = null;
    let boot: ReturnType<typeof setTimeout> | null = null;
    let flight: AbortController | null = null;
    let cancelled = false;
    let pulling = false;
    let queued: "fallback" | "refresh" | null = null;

    const applySnapshot = (payload: Snapshot) => {
      setWidget(payload.widget);
      setGoal(payload.goal);
      setEvents((current) => mergeServerEvents(adoptServerEvents(payload.events ?? []), current));
      setSpin(payload.spin);
      setSpotlight(payload.spotlight ?? null);
      setStreamEvents(payload.streamEvents ?? null);
      setPollRuntime(payload.poll ?? null);
      setPredictionRuntime(payload.prediction ?? null);
      setTappers(payload.tappers ?? []);
      setTapGoal(payload.tapGoal?.taps ?? 0);
      if (payload.chat) setChat(payload.chat);
      if (Array.isArray(payload.chatMessages)) {
        setChatMessages((prev) => reconcileChatLines(prev, payload.chatMessages ?? []));
      }
      if (payload.frame) {
        countdown.adopt(payload.frame, link.streamOpen() ? "realtime" : "sync");
        setFrame(payload.frame);
      }
      sawLive.current = true;
      setStatus("live");
    };

    const stopFallback = () => {
      if (fallback) clearInterval(fallback);
      fallback = null;
    };

    const pull = (reason: "fallback" | "refresh") => {
      if (cancelled || !publicToken) return;
      if (reason === "fallback" && !link.fallbackActive()) return;
      if (pulling) {
        queued = reason === "refresh" || queued === "refresh" ? "refresh" : reason;
        return;
      }
      pulling = true;
      flight?.abort();
      const controller = new AbortController();
      flight = controller;
      void (async () => {
        try {
          const response = await fetch(`/api/public/overlay/${publicToken}/live`, {
            cache: "no-store",
            signal: controller.signal,
          });
          if (controller.signal.aborted || cancelled) return;
          if (response.status === 404) {
            cancelled = true;
            stopFallback();
            if (retry) clearTimeout(retry);
            source?.close();
            source = null;
            setStatus("error");
            return;
          }
          if (!response.ok) {
            setStatus((current) => (current === "live" ? "reconnecting" : current));
            return;
          }
          applySnapshot((await response.json()) as Snapshot);
        } catch {
          if (controller.signal.aborted || cancelled) return;
          setStatus((current) => (current === "live" ? "reconnecting" : current));
        } finally {
          pulling = false;
          const next = queued;
          queued = null;
          if (next && !cancelled) pull(next);
        }
      })();
    };
    pullRef.current = pull;

    const startFallback = () => {
      if (fallback || cancelled) return;
      pull("fallback");
      fallback = setInterval(() => pull("fallback"), FALLBACK_MS);
    };

    const connect = () => {
      if (cancelled) return;
      if (!link.begin().opened) return;
      source?.close();
      source = new EventSource(`/api/public/overlay/${publicToken}/stream`);

      source.addEventListener("init", (event) => {
        sawLive.current = true;
        link.opened();
        stopFallback();
        applySnapshot(JSON.parse((event as MessageEvent).data) as Snapshot);
      });
      source.addEventListener("chatlines", (event) => {
        const next = JSON.parse((event as MessageEvent).data) as OverlayChatLine[];
        setChatMessages((prev) => reconcileChatLines(prev, Array.isArray(next) ? next : []));
      });
      source.addEventListener("state", (event) => {
        const next = JSON.parse((event as MessageEvent).data) as TimerFrame;
        countdown.adopt(next, "realtime");
        setFrame(next);
      });
      source.addEventListener("goal", (event) => {
        setGoal(JSON.parse((event as MessageEvent).data) as GoalSnapshot | null);
      });
      source.addEventListener("events", (event) => {
        const server = JSON.parse((event as MessageEvent).data) as OverlayEvent[];
        setEvents((current) => mergeServerEvents(adoptServerEvents(server), current));
      });
      source.addEventListener("spotlight", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          spotlight: SpotlightMessage | null;
          config: unknown;
        };
        setSpotlight(payload.spotlight);
        setWidget((current) => (current ? { ...current, config: payload.config } : current));
      });
      source.addEventListener("streamevents", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          streamEvents: StreamEventsRuntime | null;
          config: unknown;
        };
        setStreamEvents(payload.streamEvents);
        setWidget((current) => (current ? { ...current, config: payload.config } : current));
      });
      source.addEventListener("poll", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          poll: PollRuntime | null;
          config: unknown;
        };
        setPollRuntime(payload.poll);
        setWidget((current) => (current ? { ...current, config: payload.config } : current));
      });
      source.addEventListener("prediction", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          prediction: PredictionRuntime | null;
          config: unknown;
        };
        setPredictionRuntime(payload.prediction);
        setWidget((current) => (current ? { ...current, config: payload.config } : current));
      });
      source.addEventListener("tappers", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          tappers: TapperEntry[];
          config: unknown;
        };
        setTappers(payload.tappers ?? []);
        setWidget((current) => (current ? { ...current, config: payload.config } : current));
      });
      source.addEventListener("tapgoal", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          tapGoal: { taps: number } | null;
          config: unknown;
        };
        setTapGoal(payload.tapGoal?.taps ?? 0);
        setWidget((current) => (current ? { ...current, config: payload.config } : current));
      });
      source.addEventListener("spin", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          spin: SpinState | null;
          config: unknown;
        };
        setSpin(payload.spin);
        setWidget((current) => (current ? { ...current, config: payload.config } : current));
      });

      source.onerror = () => {
        source?.close();
        source = null;
        const lost = link.lost();
        if (cancelled) return;
        setStatus(sawLive.current ? "reconnecting" : "connecting");
        if (lost.startFallback) startFallback();
        if (!lost.schedule) return;
        if (retry) clearTimeout(retry);
        retry = setTimeout(() => {
          retry = null;
          link.retryDue();
          connect();
        }, lost.delay);
      };
    };

    connect();
    boot = setTimeout(() => {
      if (!cancelled && link.bootTimedOut()) startFallback();
    }, SSE_BOOT_MS);

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      if (boot) clearTimeout(boot);
      stopFallback();
      flight?.abort();
      source?.close();
      link.closed();
      pullRef.current = null;
    };
  }, [publicToken, countdown.adopt]);

  useWidgetRealtime(widget?.id ?? null, (message) => {
    if (message.event === "alert") {
      const next = eventFromBroadcast(message.payload);
      if (next) {
        if (next.isTest) {
          previewTests.current = [
            next,
            ...previewTests.current.filter((event) => event.id !== next.id),
          ].slice(0, 8);
        }
        setEvents((current) => mergeAlert(current, next));
      }
      if (needsDirectRead(message.payload)) pullRef.current?.("refresh");
      return;
    }
    if (message.event === "chat") {
      const payload = message.payload as Partial<ChatMessage> & Record<string, unknown>;
      const liveLine = readChatLine(payload);
      if (liveLine) setChatMessages((prev) => reconcileChatLines(prev, [liveLine]));
      const reply = readReplyMeta(payload);
      setTestMessages((prev) =>
        [
          {
            id: String(payload.id ?? `test-${Date.now()}`),
            platform: (payload.platform as ChatMessage["platform"]) ?? "TEST",
            author: String(payload.author ?? "Tester"),
            color: (payload.color as string | null) ?? null,
            badges: Array.isArray(payload.badges) ? (payload.badges as string[]) : [],
            text: String(payload.text ?? ""),
            at:
              typeof payload.at === "number" && payload.at > 0
                ? payload.at
                : (reply.appearanceMs ?? Date.now()),
            isReply: payload.isReply === true || reply.isReply,
            replyQuote: typeof payload.replyQuote === "string" ? payload.replyQuote : reply.quote,
          },
          ...prev,
        ].slice(0, 25),
      );
      return;
    }
    pullRef.current?.("refresh");
  });

  const shownFrame =
    frame && countdown.status === "ENDED" && frame.status === "RUNNING"
      ? { ...frame, status: "ENDED" as const, remainingSeconds: 0, remainingMs: 0 }
      : frame;

  return {
    widget,
    frame: shownFrame,
    remaining: countdown.remaining,
    goal,
    events,
    spin,
    spotlight,
    streamEvents,
    poll: pollRuntime,
    prediction: predictionRuntime,
    tappers,
    tapGoal,
    chat,
    chatMessages,
    testMessages,
    status,
  };
}
