import { createFileRoute } from "@tanstack/react-router";

import type { AlertPlatform } from "@/lib/alertStudio";
import { demoAlertsEnabled, enqueueAlertTest } from "@/lib/alertStudio.server";

export const Route = createFileRoute("/api/demo/alert-studio/test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!demoAlertsEnabled()) return Response.json({ error: "not_found" }, { status: 404 });
        const body = (await request.json()) as {
          alertId?: string;
          platform?: string;
          username?: string;
          count?: number;
          months?: number;
          amount?: number;
          message?: string;
          config?: unknown;
          requestId?: string;
        };
        const platform: AlertPlatform = body.platform === "TWITCH" ? "TWITCH" : "KICK";
        const result = await enqueueAlertTest({
          alertId: body.alertId ?? "",
          requestId:
            typeof body.requestId === "string" && /^[0-9a-f-]{36}$/i.test(body.requestId)
              ? body.requestId
              : undefined,
          platform,
          username: body.username ?? "",
          count: Number(body.count),
          months: Number(body.months),
          amount: body.amount,
          message: body.message,
          ...(body.config !== undefined ? { config: body.config } : {}),
        });
        return Response.json(result, {
          status: result.event ? 200 : 400,
          headers: { "cache-control": "no-store" },
        });
      },
    },
  },
});
