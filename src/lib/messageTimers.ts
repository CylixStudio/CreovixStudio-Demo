import type { ChatCommandPlatform } from "@/lib/customCommands";

export type MessageTimer = {
  id: string;
  message: string;
  intervalMinutes: number;
  enabled: boolean;
  platforms: ChatCommandPlatform[];
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MessageTimerInput = {
  id?: string;
  message: string;
  intervalMinutes: number;
  enabled: boolean;
  platforms: ChatCommandPlatform[];
};

const TEST_KEY = "creovix:message-timers";

export function sanitizeTimerMessage(raw: string): string {
  return raw.trim().slice(0, 480);
}

export function sanitizeIntervalMinutes(raw: number): number {
  return Math.min(Math.max(Math.round(raw) || 15, 1), 1440);
}

export function emptyTimerDraft(): MessageTimerInput {
  return {
    message: "",
    intervalMinutes: 15,
    enabled: true,
    platforms: ["KICK"],
  };
}

export function timerIsDue(timer: MessageTimer, now = Date.now()): boolean {
  if (!timer.enabled || !timer.message) return false;
  const last = timer.lastSentAt ? Date.parse(timer.lastSentAt) : 0;
  return now - last >= timer.intervalMinutes * 60_000;
}

function emptyState(): MessageTimer[] {
  return [];
}

export function loadTestTimers(): MessageTimer[] {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(TEST_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as MessageTimer[];
    return Array.isArray(parsed) ? parsed : emptyState();
  } catch {
    return emptyState();
  }
}

function persistTestTimers(timers: MessageTimer[]) {
  window.localStorage.setItem(TEST_KEY, JSON.stringify(timers));
}

export function upsertTestTimer(input: MessageTimerInput): MessageTimer[] {
  const timers = loadTestTimers();
  const now = new Date().toISOString();
  const message = sanitizeTimerMessage(input.message);
  if (!message) throw new Error("message_required");
  const existing = input.id ? timers.find((timer) => timer.id === input.id) : undefined;
  const row: MessageTimer = {
    id: existing?.id ?? crypto.randomUUID(),
    message,
    intervalMinutes: sanitizeIntervalMinutes(input.intervalMinutes),
    enabled: Boolean(input.enabled),
    platforms: input.platforms.length ? input.platforms : ["KICK"],
    lastSentAt: existing?.lastSentAt ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  persistTestTimers([row, ...timers.filter((timer) => timer.id !== row.id)]);
  return loadTestTimers();
}

export function setTestTimerEnabled(id: string, enabled: boolean): MessageTimer[] {
  const timers = loadTestTimers().map((timer) =>
    timer.id === id ? { ...timer, enabled, updatedAt: new Date().toISOString() } : timer,
  );
  persistTestTimers(timers);
  return timers;
}

export function deleteTestTimer(id: string): MessageTimer[] {
  persistTestTimers(loadTestTimers().filter((timer) => timer.id !== id));
  return loadTestTimers();
}

/** Test-mode tick: marks due timers as sent without posting to Kick. */
export function tickTestTimers(): MessageTimer[] {
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const timers = loadTestTimers().map((timer) =>
    timerIsDue(timer, now) ? { ...timer, lastSentAt: iso, updatedAt: iso } : timer,
  );
  persistTestTimers(timers);
  return timers;
}
