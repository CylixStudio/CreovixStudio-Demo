import { createFileRoute } from "@tanstack/react-router";

import { handleOAuthCallback } from "@/lib/oauthHandlers.server";

/** TikTok developer portal uses this path (not `/api/auth/tiktok/callback`). */
export const Route = createFileRoute("/api/auth/callback/tiktok")({
  server: {
    handlers: {
      GET: async ({ request }) => handleOAuthCallback(request, "tiktok"),
    },
  },
});
