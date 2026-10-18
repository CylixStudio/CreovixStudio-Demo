import { buildInitialTeamState } from "./fixtures";
import { effectiveChannelId, resolveActor, withExpiry } from "./resolver";
import type { ActorContext, TeamState } from "./types";

/**
 * Demo Storage: localStorage only. Browsers do not share it, so nothing here is visible to
 * other people or devices. A real deployment replaces this module with server persistence.
 */

export const TEAM_KEY = "cylixstudio-demo:team:v1";
/** Mirror of the effective channel id, read by the demo database layer before it builds a snapshot. */
export const ACTIVE_CHANNEL_KEY = "cylixstudio-demo:channel:v1";
export const TEAM_EVENT = "cylixstudio-demo:team-change";
export const DEFAULT_CHANNEL_ID = "own";

const isBrowser = () => typeof window !== "undefined";

let initial: TeamState | null = null;
let cache: TeamState | null = null;
let cacheRaw: string | null = null;

function seed(): TeamState {
  if (!initial) initial = buildInitialTeamState();
  return initial;
}

function parse(raw: string | null): TeamState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TeamState;
    if (parsed && parsed.v === 1 && Array.isArray(parsed.members) && Array.isArray(parsed.invitations) && Array.isArray(parsed.audit)) {
      return parsed;
    }
  } catch {
    /* fall through to defaults */
  }
  return null;
}

/** Stable snapshot: the same object is returned until the stored value changes. */
export function readTeamState(): TeamState {
  if (!isBrowser()) return seed();
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(TEAM_KEY);
  } catch {
    return cache ?? seed();
  }
  if (cache && raw === cacheRaw) return cache;
  const stored = parse(raw);
  cacheRaw = raw;
  cache = withExpiry(stored ?? seed());
  return cache;
}

export function writeTeamState(next: TeamState): void {
  const state = withExpiry(next);
  cache = state;
  if (!isBrowser()) return;
  try {
    const raw = JSON.stringify(state);
    cacheRaw = raw;
    window.localStorage.setItem(TEAM_KEY, raw);
    window.localStorage.setItem(ACTIVE_CHANNEL_KEY, effectiveChannelId(state));
  } catch {
    /* quota exceeded: keep the in-memory copy */
  }
  window.dispatchEvent(new Event(TEAM_EVENT));
}

export function updateTeamState(mutator: (state: TeamState) => TeamState): TeamState {
  const next = mutator(readTeamState());
  writeTeamState(next);
  return next;
}

export function subscribeTeam(listener: () => void): () => void {
  if (!isBrowser()) return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === TEAM_KEY || event.key === null) listener();
  };
  window.addEventListener(TEAM_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(TEAM_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function serverSnapshot(): TeamState {
  return seed();
}

/** Channel whose data the browser currently works on (defaults to the visitor's own channel). */
export function readActiveChannelId(): string {
  if (!isBrowser()) return DEFAULT_CHANNEL_ID;
  try {
    return window.localStorage.getItem(ACTIVE_CHANNEL_KEY) || DEFAULT_CHANNEL_ID;
  } catch {
    return DEFAULT_CHANNEL_ID;
  }
}

export function readClientActor(): ActorContext {
  return resolveActor(readTeamState());
}
