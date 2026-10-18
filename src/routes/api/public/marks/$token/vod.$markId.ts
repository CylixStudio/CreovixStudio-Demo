import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/marks/$token/vod/$markId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { sharedMarkPlaybackForRequest } = await import("@/lib/markPoints.share.server");
        const result = await sharedMarkPlaybackForRequest(request, params.token, params.markId);
        if ("error" in result) {
          const status = result.error === "not_found" ? 404 : 401;
          return Response.json({ error: result.error }, { status, headers: { "Cache-Control": "no-store" } });
        }
        return Response.json(result, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
