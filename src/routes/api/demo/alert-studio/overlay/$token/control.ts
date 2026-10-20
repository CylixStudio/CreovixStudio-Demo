import { createFileRoute } from "@tanstack/react-router";

import {
  controlTokenMatches,
  clearAlertQueue,
  demoAlertsEnabled,
  getAlertControlState,
  setAlertMuted,
  setAlertPaused,
  skipCurrentAlert,
} from "@/lib/alertStudio.server";

/**
 * Alert Control API. Backed by the shared server queue state, so the dashboard,
 * other tabs/devices and every OBS source read the same Running/Paused status and
 * act on the same queue.
 */
export const Route = createFileRoute("/api/demo/alert-studio/overlay/$token/control")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!demoAlertsEnabled() || !controlTokenMatches(params.token)) {
          return Response.json({ error: "not_found" }, { status: 404 });
        }
        const state = getAlertControlState();
        return Response.json(
          {
            paused: state.paused,
            muted: state.muted,
            current: state.current,
            pending: state.pending,
            pendingCount: state.pending.length,
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
      POST: async ({ request, params }) => {
        if (!demoAlertsEnabled() || !controlTokenMatches(params.token)) {
          return Response.json({ error: "not_found" }, { status: 404 });
        }
        const body = (await request.json().catch(() => ({}))) as { action?: string };
        switch (body.action) {
          case "pause":
            await setAlertPaused(true);
            break;
          case "resume":
            await setAlertPaused(false);
            break;
          case "mute":
            await setAlertMuted(true);
            break;
          case "unmute":
            await setAlertMuted(false);
            break;
          case "skip":
            await skipCurrentAlert();
            break;
          case "clear":
            await clearAlertQueue();
            break;
          default:
            return Response.json({ error: "unknown_action" }, { status: 400 });
        }
        const state = getAlertControlState();
        return Response.json(
          {
            ok: true,
            paused: state.paused,
            muted: state.muted,
            current: state.current,
            pending: state.pending,
            pendingCount: state.pending.length,
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
