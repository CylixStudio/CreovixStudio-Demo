import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/mod-queue/$token/queue")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { resolveModOwner, loadModQueue } = await import("@/lib/modQueue.server");
        const owner = await resolveModOwner(params.token);
        if (!owner) return Response.json({ error: "invalid_token" }, { status: 404 });
        const data = await loadModQueue(owner.user_id);
        return Response.json(data, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
