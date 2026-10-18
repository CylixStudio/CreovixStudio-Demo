const DEFAULT_TTL_MS = 10_000;

const PRIVATE_KEYS = new Set([
  "userId",
  "user_id",
  "access_token",
  "refresh_token",
  "service_role",
  "email",
]);

type FoundPage = {
  found: boolean;
  slug?: unknown;
  displayName?: unknown;
  commands?: unknown;
  timers?: unknown;
};

type Entry<T> = { at: number; value: T };

export type CommandsTrace = {
  cache: "hit" | "miss" | "skip";
  channelMs: number;
  listMs: number;
  totalMs: number;
};

/**
 * One Map per JavaScript realm. A Cloudflare Worker isolate does not see
 * another isolate's Map, so a hit here is not a hit for the next request
 * unless that request lands on the same isolate.
 */
export function createPublicCommandsCache() {
  const entries = new Map<string, Entry<FoundPage>>();

  function read<T extends FoundPage>(slug: string, now: number, ttlMs = DEFAULT_TTL_MS): T | null {
    const key = normalizeKey(slug);
    const row = entries.get(key);
    if (!row) return null;
    if (now - row.at >= ttlMs) {
      entries.delete(key);
      return null;
    }
    return row.value as T;
  }

  function write<T extends FoundPage>(slug: string, value: T, now: number): boolean {
    const key = normalizeKey(slug);
    if (!key || !isCacheablePublicPage(key, value)) {
      entries.delete(key);
      return false;
    }
    entries.set(key, { at: now, value });
    return true;
  }

  return {
    read,
    write,
    clear() {
      entries.clear();
    },
  };
}

const shared = createPublicCommandsCache();
const traces: CommandsTrace[] = [];

function normalizeKey(slug: string): string {
  return slug.trim().toLowerCase();
}

function containsPrivateKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => containsPrivateKey(item));
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (PRIVATE_KEYS.has(key)) return true;
    if (containsPrivateKey(nested)) return true;
  }
  return false;
}

export function isCacheablePublicPage(slug: string, value: FoundPage): boolean {
  if (!value.found) return false;
  if (containsPrivateKey(value)) return false;
  if (value.slug !== slug) return false;
  if (typeof value.displayName !== "string" || value.displayName.trim() === "") return false;
  if (!Array.isArray(value.commands) || !Array.isArray(value.timers)) return false;
  return true;
}

export function readPublicCommandsCache<T extends FoundPage>(
  slug: string,
  now: number,
  ttlMs = DEFAULT_TTL_MS,
): T | null {
  return shared.read<T>(slug, now, ttlMs);
}

/** Returns false when the page is missing, private, incomplete, or for another slug. */
export function writePublicCommandsCache<T extends FoundPage>(slug: string, value: T, now: number): boolean {
  return shared.write(slug, value, now);
}

export function clearPublicCommandsCache(): void {
  shared.clear();
}

export function noteCommandsTrace(trace: CommandsTrace): void {
  traces.push(trace);
  if (traces.length > 40) traces.shift();
}

export function drainCommandsTraces(): CommandsTrace[] {
  return traces.splice(0, traces.length);
}
