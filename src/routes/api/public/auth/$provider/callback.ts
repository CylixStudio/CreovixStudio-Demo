import { createFileRoute } from "@tanstack/react-router";

import { handleOAuthCallback } from "@/lib/oauthHandlers.server";

/** Legacy path — Kick/Twitch must register `/api/auth/{provider}/callback`, not this URL. */
export const Route = createFileRoute("/api/public/auth/$provider/callback")({
  server: {
    handlers: {
      GET: async ({ request, params }) => handleOAuthCallback(request, params.provider),
    },
  },
});
