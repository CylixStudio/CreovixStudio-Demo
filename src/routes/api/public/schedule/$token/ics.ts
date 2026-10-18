import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/schedule/$token/ics")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { publicScheduleIcs } = await import("@/lib/schedule.server");
        const origin = new URL(request.url).origin;
        const ics = await publicScheduleIcs(params.token, origin);
        if (!ics) return new Response("schedule_not_found", { status: 404 });
        return new Response(ics, {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'attachment; filename="creovix-schedule.ics"',
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
