import { createFileRoute } from "@tanstack/react-router";

import {
  alertTokenMatches,
  demoAlertsEnabled,
  getAlertControlState,
  listAlertEvents,
  subscribeAlertControl,
  subscribeAlertEvents,
} from "@/lib/alertStudio.server";

export const Route = createFileRoute("/api/demo/alert-studio/overlay/$token/stream")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!demoAlertsEnabled() || !alertTokenMatches(params.token)) {
          return new Response(null, { status: 404 });
        }
        const encoder = new TextEncoder();
        let closed = false;
        const stream = new ReadableStream({
          start(controller) {
            const send = (event: string, data: unknown) => {
              if (closed) return;
              controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            };
            const control = getAlertControlState();
            send("init", {
              events: listAlertEvents(),
              paused: control.paused,
              currentId: control.current?.id ?? null,
            });
            const unsubscribe = subscribeAlertEvents((event) => send("alert", event));
            const unsubscribeControl = subscribeAlertControl((signal) => send("control", signal));
            const beat = setInterval(() => {
              if (!closed) controller.enqueue(encoder.encode(`: ping\n\n`));
            }, 15000);
            const close = () => {
              if (closed) return;
              closed = true;
              clearInterval(beat);
              unsubscribe();
              unsubscribeControl();
              try {
                controller.close();
              } catch {
                /* already closed */
              }
            };
            request.signal.addEventListener("abort", close);
          },
        });
        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-store",
            connection: "keep-alive",
          },
        });
      },
    },
  },
});
