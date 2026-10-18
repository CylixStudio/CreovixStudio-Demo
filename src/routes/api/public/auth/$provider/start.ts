import { createFileRoute } from "@tanstack/react-router";

import { handleOAuthStart } from "@/lib/oauthHandlers.server";

/** Legacy path — same handler as `/api/auth/$provider/start`. */
export const Route = createFileRoute("/api/public/auth/$provider/start")({
  server: {
    handlers: {
      GET: async ({ request, params }) => handleOAuthStart(request, params.provider),
    },
  },
});
