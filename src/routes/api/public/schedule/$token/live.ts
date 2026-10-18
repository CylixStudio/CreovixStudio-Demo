import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/schedule/$token/live")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { publicScheduleJson } = await import("@/lib/schedule.server");
        const data = await publicScheduleJson(params.token);
        if (!data) return Response.json({ error: "schedule_not_found" }, { status: 404 });
        return Response.json(data, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
