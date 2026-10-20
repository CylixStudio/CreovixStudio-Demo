import { createFileRoute } from "@tanstack/react-router";

import { alertTokenMatches, demoAlertsEnabled, getAlertControlState } from "@/lib/alertStudio.server";

export const Route = createFileRoute("/api/demo/alert-studio/overlay/$token/live")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!demoAlertsEnabled() || !alertTokenMatches(params.token)) {
          return Response.json({ error: "not_found" }, { status: 404 });
        }
        const control = getAlertControlState();
        return Response.json(
          {
            paused: control.paused,
            muted: control.muted,
            currentId: control.current?.id ?? null,
            pendingCount: control.pending.length,
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
