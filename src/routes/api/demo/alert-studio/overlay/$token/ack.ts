import { createFileRoute } from "@tanstack/react-router";

import { acknowledgeAlert, alertTokenMatches, demoAlertsEnabled } from "@/lib/alertStudio.server";

export const Route = createFileRoute("/api/demo/alert-studio/overlay/$token/ack")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!demoAlertsEnabled() || !alertTokenMatches(params.token)) {
          return Response.json({ error: "not_found" }, { status: 404 });
        }
        const body = (await request.json()) as { id?: string };
        if (body.id) await acknowledgeAlert(body.id);
        return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
