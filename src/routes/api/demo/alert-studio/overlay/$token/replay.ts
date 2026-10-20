import { createFileRoute } from "@tanstack/react-router";
import {
  alertTokenMatches,
  demoAlertsEnabled,
  getAlertControlState,
} from "@/lib/alertStudio.server";
import { replayDemoActivityEvent } from "@/lib/activityFeed.server";

/**
 * Activity Replay for Dock / OBS Browser Source.
 * Replays a specific activity event into the alert queue.
 */
export const Route = createFileRoute("/api/demo/alert-studio/overlay/$token/replay")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        if (!demoAlertsEnabled() || !alertTokenMatches(params.token)) {
          return Response.json({ error: "not_found" }, { status: 404 });
        }

        const body = (await request.json().catch(() => ({}))) as { eventId?: string };
        const eventId = String(body.eventId ?? "");

        if (!eventId) {
          return Response.json({ error: "missing_event_id" }, { status: 400 });
        }

        const result = await replayDemoActivityEvent(eventId);

        if (!result.queued) {
          return Response.json(
            { error: "replay_failed", queued: false },
            { status: 409 },
          );
        }

        return Response.json(
          { ok: true, queued: true, duplicate: result.duplicate },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
