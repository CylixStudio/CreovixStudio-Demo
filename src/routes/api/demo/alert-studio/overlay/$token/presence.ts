import { createFileRoute } from "@tanstack/react-router";

import { alertTokenMatches, demoAlertsEnabled, touchAlertOverlay } from "@/lib/alertStudio.server";

export const Route = createFileRoute("/api/demo/alert-studio/overlay/$token/presence")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        let overlayId: string | null = null;
        try {
          const body = (await request.json()) as { overlayId?: unknown };
          if (typeof body?.overlayId === "string" && /^[0-9a-f-]{36}$/i.test(body.overlayId)) {
            overlayId = body.overlayId;
          }
        } catch {
          // Older overlays sent no body; that still counts as a heartbeat.
        }
        if (!demoAlertsEnabled() || !touchAlertOverlay(params.token, overlayId)) {
          return Response.json({ error: "not_found" }, { status: 404 });
        }
        return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
