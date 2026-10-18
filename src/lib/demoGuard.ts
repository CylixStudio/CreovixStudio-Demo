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
