import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/marks/$token/status")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { setSharedMarkStatus } = await import("@/lib/markPoints.share.server");
        let body: { id?: string; status?: string } = {};
        try {
          body = (await request.json()) as { id?: string; status?: string };
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }
        const result = await setSharedMarkStatus(request, params.token, body.id ?? "", body.status ?? "");
        if (!result.ok) {
          const status = result.reason === "gate" ? 401 : result.reason === "bad_status" ? 400 : 404;
          return Response.json({ error: result.reason }, { status });
        }
        return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
