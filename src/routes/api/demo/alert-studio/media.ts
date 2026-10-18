import { createFileRoute } from "@tanstack/react-router";

import {
  isVariationId,
  PRO_MEDIA_BYTES,
  type AlertPlatform,
  type MediaSlot,
} from "@/lib/alertStudio";
import { demoAlertsEnabled, readAlertStudio, storeAlertMedia } from "@/lib/alertStudio.server";

export const Route = createFileRoute("/api/demo/alert-studio/media")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!demoAlertsEnabled()) return Response.json({ error: "not_found" }, { status: 404 });
        if (Number(request.headers.get("content-length")) > PRO_MEDIA_BYTES + 65536)
          return Response.json({ message: "حجم الملف يتجاوز الحد الأقصى 60 MB." }, { status: 413 });
        const form = await request.formData();
        const file = form.get("file");
        const alertId = form.get("alertId");
        const slot = form.get("slot");
        const platform = form.get("platform");
        const variationId = form.get("variationId");
        if (variationId !== null && !isVariationId(variationId))
          return Response.json({ message: "تنويعة غير صالحة." }, { status: 400 });
        if (
          !(file instanceof File) ||
          typeof alertId !== "string" ||
          (slot !== "visual" && slot !== "audio") ||
          (platform !== "KICK" && platform !== "TWITCH")
        ) {
          return Response.json({ message: "اختر ملفًا صالحًا." }, { status: 400 });
        }
        const studio = readAlertStudio();
        if (file.size > studio.limitBytes)
          return Response.json(
            {
              message: `حجم الملف يتجاوز حد ${studio.plan === "free" ? "Free 5 MB" : "Pro 60 MB"}.`,
            },
            { status: 413 },
          );
        const saved = await storeAlertMedia({
          platform: platform as AlertPlatform,
          alertId,
          slot: slot as MediaSlot,
          ...(variationId ? { variationId } : {}),
          filename: file.name,
          bytes: new Uint8Array(await file.arrayBuffer()),
        });
        if (!saved.ok) return Response.json({ message: saved.message }, { status: 400 });
        return Response.json(saved, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
