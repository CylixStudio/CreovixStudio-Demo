import { createFileRoute } from "@tanstack/react-router";

import { DEMO_CHANNEL_ID, PLATFORM_EVENT_TYPES, type DemoPlatform } from "@/lib/alertEvents.shared";
import { ingestSignedPlatformEvent, simulatePlatformEvent } from "@/lib/alertEvents.server";
import { demoAlertsEnabled } from "@/lib/alertStudio.server";

/**
 * Platform event simulator (Demo). Builds a realistic Kick/Twitch payload,
 * signs it and pushes it through the verified receiver, so the full path
 * (verify -> normalize -> isolate -> match -> variations -> queue -> OBS) is
 * genuinely exercised instead of faking the result.
 */
export const Route = createFileRoute("/api/demo/alert-studio/simulate")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          { channelId: DEMO_CHANNEL_ID, events: PLATFORM_EVENT_TYPES },
          { headers: { "cache-control": "no-store" } },
        ),
      POST: async ({ request }) => {
        if (!demoAlertsEnabled()) return Response.json({ error: "not_found" }, { status: 404 });
        const body = (await request.json().catch(() => ({}))) as {
          platform?: string;
          type?: string;
          actor?: string;
          quantity?: number;
          months?: number;
          amount?: number;
          message?: string;
        };
        const platform: DemoPlatform = body.platform === "TWITCH" ? "TWITCH" : "KICK";
        const known = PLATFORM_EVENT_TYPES[platform].some((entry) => entry.type === body.type);
        if (!known) {
          return Response.json({ error: "unsupported_type" }, { status: 400 });
        }
        const result = await simulatePlatformEvent({
          platform,
          type: body.type!,
          ...(typeof body.actor === "string" && body.actor.trim() ? { actor: body.actor.trim() } : {}),
          ...(typeof body.quantity === "number" && !Number.isNaN(body.quantity) ? { quantity: body.quantity } : {}),
          ...(typeof body.months === "number" && !Number.isNaN(body.months) ? { months: body.months } : {}),
          ...(typeof body.amount === "number" && !Number.isNaN(body.amount) ? { amount: body.amount } : {}),
          ...(typeof body.message === "string" && body.message.trim() ? { message: body.message.trim() } : {}),
        });
        return Response.json(result, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
