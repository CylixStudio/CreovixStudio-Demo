import { DEMO_BUILD } from "@/lib/demoMode";

const BLOCKED_HOST = /(^|\.)supabase\.co$|ymvgxarznjqotnaaiida/i;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function blocked(url: string): boolean {
  if (!DEMO_BUILD) return false;
  if (url.includes("ymvgxarznjqotnaaiida")) return true;
  try {
    const host = new URL(url, "http://localhost").hostname;
    return BLOCKED_HOST.test(host);
  } catch {
    return url.toLowerCase().includes("supabase.co");
  }
}

/** Stops the demo process from opening a socket to Supabase. */
export function installDemoNetworkGuard(): void {
  if (!DEMO_BUILD) return;
  const marker = globalThis as { __cylixDemoGuard?: boolean };
  if (marker.__cylixDemoGuard) return;
  marker.__cylixDemoGuard = true;
  const original = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    if (blocked(url)) {
      return new Response(JSON.stringify({ error: "demo_blocked_production" }), {
        status: 403,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    }
    return original(input, init);
  }) as typeof fetch;
}

installDemoNetworkGuard();

const SAME_ORIGIN_PREFIXES = ["/_serverFn/", "/api/"];

/**
 * Browser only: carries the visitor's saved demo tables to the stateless server and
 * folds whatever the server changed back into localStorage.
 */
function installDemoStateBridge(): void {
  if (!DEMO_BUILD || typeof window === "undefined") return;
  const marker = window as unknown as { __cylixDemoBridge?: boolean };
  if (marker.__cylixDemoBridge) return;
  marker.__cylixDemoBridge = true;
  const original = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    let target: URL;
    try {
      target = new URL(requestUrl(input), window.location.href);
    } catch {
      return original(input, init);
    }
    if (target.origin !== window.location.origin || !SAME_ORIGIN_PREFIXES.some((p) => target.pathname.startsWith(p))) {
      return original(input, init);
    }
    const {
      DEMO_ACTOR_HEADER,
      DEMO_CHANNEL_HEADER,
      DEMO_PATCH_HEADER,
      DEMO_REQUEST_HEADER,
      DEMO_TEAM_HEADER,
      decodeOverlay,
      encodeOverlay,
      readStoredOverlay,
    } = await import("@/demo/overlay");
    const team = await import("@/features/channel-team/storage");
    const actor = team.readClientActor();
    const overlay = readStoredOverlay();
    const extra: Record<string, string> = {
      [DEMO_CHANNEL_HEADER]: actor.channelId,
      [DEMO_ACTOR_HEADER]: btoa(JSON.stringify(actor)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    };
    if (Object.keys(overlay.tables).length > 0) extra[DEMO_REQUEST_HEADER] = await encodeOverlay(overlay);
    let nextInput = input;
    let nextInit = init;
    if (input instanceof Request && !init) {
      const headers = new Headers(input.headers);
      for (const [name, value] of Object.entries(extra)) headers.set(name, value);
      nextInput = new Request(input, { headers });
    } else {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      for (const [name, value] of Object.entries(extra)) headers.set(name, value);
      nextInit = { ...init, headers };
    }
    const response = await original(nextInput, nextInit);
    const patch = response.headers.get(DEMO_PATCH_HEADER);
    if (patch) {
      const decoded = await decodeOverlay(patch);
      if (decoded) (await import("@/demo/context")).mergeServerPatch(decoded);
    }
    const report = response.headers.get(DEMO_TEAM_HEADER);
    if (report) await (await import("@/features/channel-team/report")).applyGuardReport(report);
    return response;
  }) as typeof fetch;
}

installDemoStateBridge();
