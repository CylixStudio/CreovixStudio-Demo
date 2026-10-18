import { createFileRoute } from "@tanstack/react-router";

import "@/lib/demoGuard";
import { DEMO_BUILD } from "@/lib/demoMode";
import { demoStateRevision, readDemoFile, waitForDemoState, writeDemoFile } from "@/lib/demoStore.server";
import { normalizeDemoFile } from "@/lib/demoState";
import { drainCommandsTraces } from "@/lib/publicCommandsCache";

function demoHeaders(): HeadersInit {
  return {
    "cache-control": "no-store",
    "x-demo-rev": String(demoStateRevision()),
  };
}

export const Route = createFileRoute("/api/demo/state")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!DEMO_BUILD) return Response.json({ error: "not_found" }, { status: 404 });
        const url = new URL(request.url);
        if (url.searchParams.get("traces") === "commands") {
          return Response.json({ traces: drainCommandsTraces() }, { headers: { "cache-control": "no-store" } });
        }
        if (url.searchParams.get("wait") === "1") {
          const since = Number(url.searchParams.get("since"));
          if (Number.isFinite(since)) {
            await waitForDemoState(since, request.signal);
            if (request.signal.aborted) return new Response(null, { status: 204 });
          }
        }
        return Response.json(readDemoFile(), { headers: demoHeaders() });
      },
      PUT: async ({ request }) => {
        if (!DEMO_BUILD) return Response.json({ error: "not_found" }, { status: 404 });
        const body = normalizeDemoFile(await request.json());
        const saved = writeDemoFile(body);
        return Response.json(saved, { headers: demoHeaders() });
      },
    },
  },
});
