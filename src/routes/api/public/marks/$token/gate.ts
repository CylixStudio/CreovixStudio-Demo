import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/marks/$token/gate")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { unlockMarkShare } = await import("@/lib/markPoints.share.server");
        let body: { username?: string } = {};
        try {
          body = (await request.json()) as { username?: string };
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }
        const result = await unlockMarkShare(request, params.token, body.username ?? "");
        if (!result.ok) {
          const status = result.reason === "not_found" ? 404 : 403;
          return Response.json({ error: result.reason }, { status });
        }
        return Response.json(
          { ok: true },
          { headers: { "Cache-Control": "no-store", "Set-Cookie": result.setCookie } },
        );
      },
    },
  },
});
