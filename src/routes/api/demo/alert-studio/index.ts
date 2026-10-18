import { createFileRoute } from "@tanstack/react-router";

import { demoAlertsEnabled, readAlertStudio, updateAlertStudio } from "@/lib/alertStudio.server";

function denied() {
  return Response.json({ error: "not_found" }, { status: 404 });
}

export const Route = createFileRoute("/api/demo/alert-studio/")({
  server: {
    handlers: {
      GET: async () => {
        if (!demoAlertsEnabled()) return denied();
        return Response.json(readAlertStudio(), { headers: { "cache-control": "no-store" } });
      },
      PUT: async ({ request }) => {
        if (!demoAlertsEnabled()) return denied();
        const body = (await request.json()) as {
          plan?: "free" | "pro";
          alerts?: Record<string, unknown>;
          simulation?: unknown;
        };
        const saved = await updateAlertStudio(body);
        return Response.json(saved, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
