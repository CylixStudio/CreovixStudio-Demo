import { createFileRoute } from "@tanstack/react-router";

import { alertTokenMatches, claimNextAlert, demoAlertsEnabled } from "@/lib/alertStudio.server";

/**
 * Overlay display claim. Only the active display source is granted the next
 * alert; extra OBS windows receive "standby" so a single alert is never shown
 * twice. The claim also carries the display lease heartbeat.
 */
export const Route = createFileRoute("/api/demo/alert-studio/overlay/$token/claim")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!demoAlertsEnabled() || !alertTokenMatches(params.token)) {
          return Response.json({ error: "not_found" }, { status: 404 });
        }
        const body = (await request.json().catch(() => ({}))) as { overlayId?: unknown };
        const overlayId =
          typeof body.overlayId === "string" && /^[0-9a-f-]{36}$/i.test(body.overlayId)
            ? body.overlayId
            : "";
        if (!overlayId) return Response.json({ error: "missing_overlay" }, { status: 400 });
        return Response.json(claimNextAlert(overlayId), { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
