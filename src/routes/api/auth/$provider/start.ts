import { createFileRoute } from "@tanstack/react-router";

import { handleOAuthStart } from "@/lib/oauthHandlers.server";

export const Route = createFileRoute("/api/auth/$provider/start")({
  server: {
    handlers: {
      GET: async ({ request, params }) => handleOAuthStart(request, params.provider),
    },
  },
});
