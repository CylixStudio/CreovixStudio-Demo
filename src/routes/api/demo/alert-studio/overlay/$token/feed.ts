import { createFileRoute } from "@tanstack/react-router";
import {
  dockTokenMatches,
  demoAlertsEnabled,
  getAlertControlState,
} from "@/lib/alertStudio.server";
import { readDemoActivityFeed } from "@/lib/activityFeed.server";

/**
 * Activity Feed for Dock / OBS Browser Source.
 * Provides the queue state and activity history for the dock to display.
 */
export const Route = createFileRoute("/api/demo/alert-studio/overlay/$token/feed")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!demoAlertsEnabled() || !dockTokenMatches(params.token)) {
          return Response.json({ error: "not_found" }, { status: 404 });
        }

        const state = getAlertControlState();
        const events = await readDemoActivityFeed();

        return Response.json(
          {
            events,
            locked: false,
            isPro: false,
            queue: {
              paused: state.paused,
              muted: state.muted,
              current: state.current,
              pending: state.pending,
              pendingCount: state.pending.length,
            },
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
