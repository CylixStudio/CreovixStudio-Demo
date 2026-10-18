import { createFileRoute } from "@tanstack/react-router";

import { ingestSignedPlatformEvent } from "@/lib/alertEvents.server";
import { demoAlertsEnabled } from "@/lib/alertStudio.server";

/**
 * Verified event receiver (Demo). Signature-checked before anything else, then
 * normalized and queued exactly like the production webhooks — but into the
 * isolated demo store. Rejects stale/replayed or foreign-channel events.
 */
export const Route = createFileRoute("/api/demo/alert-studio/events")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          { ok: true, listener: "demo-alert-events", status: "listening" },
          { headers: { "cache-control": "no-store" } },
        ),
      POST: async ({ request }) => {
        if (!demoAlertsEnabled()) return Response.json({ error: "not_found" }, { status: 404 });
        const rawBody = await request.text();
        const result = await ingestSignedPlatformEvent({
          rawBody,
          timestamp: request.headers.get("demo-alert-timestamp"),
          signature: request.headers.get("demo-alert-signature"),
        });
        return Response.json(result, {
          status: result.ok ? 200 : 202,
          headers: { "cache-control": "no-store" },
        });
      },
    },
  },
});
