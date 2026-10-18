import { createFileRoute } from "@tanstack/react-router";

import { demoAlertsEnabled, readAlertMedia, removeAlertMedia } from "@/lib/alertStudio.server";

export const Route = createFileRoute("/api/demo/alert-studio/media/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!demoAlertsEnabled()) return new Response(null, { status: 404 });
        const file = readAlertMedia(params.id);
        if (!file) return new Response(null, { status: 404 });
        return new Response(new Uint8Array(file.bytes), {
          headers: {
            "content-type": file.mime,
            "cache-control": "private, max-age=3600",
            "x-content-type-options": "nosniff",
          },
        });
      },
      DELETE: async ({ params }) => {
        if (!demoAlertsEnabled()) return Response.json({ error: "not_found" }, { status: 404 });
        const studio = await removeAlertMedia(params.id);
        if (!studio) return Response.json({ message: "الملف غير موجود." }, { status: 404 });
        return Response.json(studio, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
