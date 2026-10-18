import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/link-in-bio/$slug/live")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { publicLinkInBioJson } = await import("@/lib/linkInBio.server");
        const data = await publicLinkInBioJson(params.slug);
        if (!data) return Response.json({ error: "bio_not_found" }, { status: 404 });
        return Response.json(data, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
