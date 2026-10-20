import { createFileRoute } from "@tanstack/react-router";
import { demoAlertsEnabled, regenerateDockToken } from "@/lib/alertStudio.server";

function denied() {
  return Response.json({ error: "not_found" }, { status: 404 });
}

export const Route = createFileRoute("/api/demo/alert-studio/dock-token")({
  server: {
    handlers: {
      POST: async () => {
        if (!demoAlertsEnabled()) return denied();
        const state = await regenerateDockToken();
        return Response.json(state, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
