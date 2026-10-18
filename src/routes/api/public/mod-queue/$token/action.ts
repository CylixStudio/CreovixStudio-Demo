import { createFileRoute } from "@tanstack/react-router";

const ACTIONS = ["APPROVE", "REJECT", "SKIP", "DELETE", "PLAY", "PAUSE", "RESUME", "SET_MODE"] as const;

export const Route = createFileRoute("/api/public/mod-queue/$token/action")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const { resolveModOwner, runModAction } = await import("@/lib/modQueue.server");
        const owner = await resolveModOwner(params.token);
        if (!owner) return Response.json({ error: "invalid_token" }, { status: 404 });
        let body: { action?: string; requestId?: string; mode?: string };
        try { body = (await request.json()) as typeof body; } catch { return Response.json({ error: "invalid_body" }, { status: 400 }); }
        const action = ACTIONS.find((entry) => entry === body.action);
        if (!action) return Response.json({ error: "invalid_action" }, { status: 400 });
        const result = await runModAction(owner.user_id, {
          action,
          requestId: typeof body.requestId === "string" ? body.requestId.slice(0, 64) : null,
          mode: typeof body.mode === "string" ? body.mode : null,
        });
        return Response.json(result, { status: result.ok ? 200 : 400, headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
