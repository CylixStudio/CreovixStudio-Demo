import { createFileRoute } from "@tanstack/react-router";
import {
  dockTokenMatches,
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
        if (!demoAlertsEnabled() || !dockTokenMatches(params.token)) {
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
            { error: "replay_failed", queued: false, reason: result.reason },
            { status: result.reason === "not_found" ? 404 : 409 },
          );
        }

        return Response.json(
          { ok: true, queued: true },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
