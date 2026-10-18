import { createFileRoute } from "@tanstack/react-router";

import { handleOAuthCallback } from "@/lib/oauthHandlers.server";

export const Route = createFileRoute("/api/auth/$provider/callback")({
  server: {
    handlers: {
      GET: async ({ request, params }) => handleOAuthCallback(request, params.provider),
    },
  },
});
