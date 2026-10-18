import { DEMO_BUILD } from "@/lib/demoMode";
import type { OverlayChatLine } from "@/lib/overlayChat";
import type { OverlayEvent } from "@/lib/widgets";

export const FIXTURE_TOKEN = "fixture-overlay";

type Listener = (event: string, data: unknown) => void;

const listeners = new Set<Listener>();
const closers = new Set<() => void>();

const state: {
  dropped: boolean;
  lines: OverlayChatLine[];
  events: OverlayEvent[];
} = {
  dropped: false,
  lines: [],
  events: [],
};

export function isFixtureOverlay(token: string): boolean {
  return DEMO_BUILD && token === FIXTURE_TOKEN;
}

function snapshot() {
  return {
    widget: {
      id: "fixture-widget",
      name: "Fixture",
      type: "CHAT_BOX" as const,
      config: { theme: "royal-compact", maxMessages: 8 },
    },
    frame: null,
    goal: null,
    events: state.events,
    spin: null,
    spotlight: null,
    streamEvents: null,
    poll: null,
    prediction: null,
    tappers: [],
    tapGoal: null,
    chat: null,
    chatMessages: state.lines,
  };
}

function publish(event: string, data: unknown) {
  for (const listener of listeners) listener(event, data);
}

export function fixtureLiveResponse(): Response {
  return Response.json(snapshot(), { headers: { "cache-control": "no-store" } });
}

export function fixtureStreamResponse(request: Request): Response {
  const encoder = new TextEncoder();
  let closed = false;
  let listener: Listener | null = null;
  const close = () => {
    if (closed) return;
    closed = true;
    if (listener) listeners.delete(listener);
    closers.delete(close);
    try {
      controller.close();
    } catch {
      /* already closed */
    }
  };
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(next) {
      controller = next;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          close();
        }
      };
      if (state.dropped) {
        close();
        return;
      }
      send("init", snapshot());
      listener = send;
      listeners.add(send);
      closers.add(close);
      request.signal.addEventListener("abort", close);
    },
    cancel() {
      close();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
    },
  });
}

export function fixtureAction(action: string): { ok: boolean; dropped: boolean; lines: number; events: number } {
  if (action === "drop") {
    state.dropped = true;
    for (const close of [...closers]) close();
  } else if (action === "restore") {
    state.dropped = false;
  } else if (action === "chat") {
    const line: OverlayChatLine = {
      id: "fixture-chat-1",
      platform: "TEST",
      author: "Fixture",
      color: null,
      badges: [],
      text: "fixture-chat-line",
      at: Date.now(),
    };
    state.lines = [line, ...state.lines.filter((item) => item.id !== line.id)].slice(0, 8);
    publish("chatlines", state.lines);
  } else if (action === "alert") {
    const event: OverlayEvent = {
      id: "fixture-alert-1",
      platform: "KICK",
      eventType: "SUBSCRIPTION",
      actorName: "FixtureFan",
      eventType: "FOLLOW",
      actorName: "FixtureFan",
      amount: null,
      currency: null,
      createdAt: new Date().toISOString(),
      isTest: false,
    };
    state.events = [event, ...state.events.filter((item) => item.id !== event.id)];
    publish("events", state.events);
  }
  return { ok: true, dropped: state.dropped, lines: state.lines.length, events: state.events.length };
}
