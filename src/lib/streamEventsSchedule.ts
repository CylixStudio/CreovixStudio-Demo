/**
 * Smart broadcast events schedule — pure timing math.
 * Events are sequential segments from stream start; skip/prev adjust bonus elapsed.
 */

export type StreamScheduleEvent = {
  id: string;
  title: string;
  /** Planned length of this segment in seconds (≥ 30). */
  durationSeconds: number;
};

export type StreamEventsRuntime = {
  /** Wall-clock ISO when the stream clock started. Null = waiting / loading. */
  startedAt: string | null;
  /**
   * Extra seconds added to real elapsed (skip current → add remaining;
   * go previous → subtract previous duration). Can be negative.
   */
  bonusElapsedSeconds: number;
  revision: number;
};

export type StreamScheduleSnapshot =
  | {
      status: "waiting";
      events: StreamScheduleEvent[];
      streamElapsedSeconds: number;
    }
  | {
      status: "active";
      events: StreamScheduleEvent[];
      index: number;
      current: StreamScheduleEvent;
      next: StreamScheduleEvent | null;
      remainingSeconds: number;
      segmentElapsedSeconds: number;
      streamElapsedSeconds: number;
      phase: "on_stream" | "up_next";
      urgency: "calm" | "warn" | "critical";
      isLast: boolean;
    }
  | {
      status: "finished";
      events: StreamScheduleEvent[];
      streamElapsedSeconds: number;
    };

export function newScheduleEventId(): string {
  return `evt_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function defaultScheduleEvents(): StreamScheduleEvent[] {
  return [
    { id: newScheduleEventId(), title: "Just Chatting", durationSeconds: 20 * 60 },
    { id: newScheduleEventId(), title: "Main Game", durationSeconds: 45 * 60 },
    { id: newScheduleEventId(), title: "Viewer Games", durationSeconds: 25 * 60 },
    { id: newScheduleEventId(), title: "Q&A / Wrap", durationSeconds: 15 * 60 },
  ];
}

export function clampDurationSeconds(value: unknown, fallback = 600): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(24 * 3600, Math.max(30, Math.round(n)));
}

export function normalizeScheduleEvents(raw: unknown): StreamScheduleEvent[] {
  if (!Array.isArray(raw)) return defaultScheduleEvents();
  const out: StreamScheduleEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = typeof row["title"] === "string" ? row["title"].trim().slice(0, 80) : "";
    if (!title) continue;
    out.push({
      id: typeof row["id"] === "string" && row["id"] ? row["id"] : newScheduleEventId(),
      title,
      durationSeconds: clampDurationSeconds(
        row["durationSeconds"] ??
          (row["durationMinutes"] != null ? Number(row["durationMinutes"]) * 60 : undefined),
      ),
    });
    if (out.length >= 40) break;
  }
  return out.length > 0 ? out : defaultScheduleEvents();
}

export function parseStreamEventsRuntime(raw: unknown): StreamEventsRuntime {
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const nested =
    source["streamEvents"] && typeof source["streamEvents"] === "object"
      ? (source["streamEvents"] as Record<string, unknown>)
      : source;
  const startedAt =
    typeof nested["startedAt"] === "string" && nested["startedAt"].trim()
      ? nested["startedAt"]
      : null;
  const bonus = Number(nested["bonusElapsedSeconds"] ?? 0);
  const revision = Number(nested["revision"] ?? 0);
  return {
    startedAt,
    bonusElapsedSeconds: Number.isFinite(bonus) ? bonus : 0,
    revision: Number.isFinite(revision) ? Math.max(0, Math.floor(revision)) : 0,
  };
}

export function effectiveElapsedSeconds(
  runtime: StreamEventsRuntime,
  nowMs: number = Date.now(),
): number | null {
  if (!runtime.startedAt) return null;
  const started = Date.parse(runtime.startedAt);
  if (!Number.isFinite(started)) return null;
  const real = Math.max(0, (nowMs - started) / 1000);
  return Math.max(0, real + runtime.bonusElapsedSeconds);
}

export function resolveStreamSchedule(
  events: StreamScheduleEvent[],
  runtime: StreamEventsRuntime,
  nowMs: number = Date.now(),
): StreamScheduleSnapshot {
  const list = events.length > 0 ? events : defaultScheduleEvents();
  const elapsed = effectiveElapsedSeconds(runtime, nowMs);
  if (elapsed == null) {
    return { status: "waiting", events: list, streamElapsedSeconds: 0 };
  }

  let cursor = 0;
  for (let i = 0; i < list.length; i++) {
    const duration = list[i]!.durationSeconds;
    const end = cursor + duration;
    if (elapsed < end) {
      const remaining = end - elapsed;
      const segmentElapsed = elapsed - cursor;
      const urgency = remaining <= 30 ? "critical" : remaining <= 120 ? "warn" : "calm";
      return {
        status: "active",
        events: list,
        index: i,
        current: list[i]!,
        next: list[i + 1] ?? null,
        remainingSeconds: remaining,
        segmentElapsedSeconds: segmentElapsed,
        streamElapsedSeconds: elapsed,
        phase: segmentElapsed < 8 && i > 0 ? "up_next" : "on_stream",
        urgency,
        isLast: i === list.length - 1,
      };
    }
    cursor = end;
  }

  return {
    status: "finished",
    events: list,
    streamElapsedSeconds: elapsed,
  };
}

/** Seconds to add to bonus so the clock lands at the end of the current segment. */
export function skipBonusDelta(
  events: StreamScheduleEvent[],
  runtime: StreamEventsRuntime,
  nowMs = Date.now(),
): number {
  const snap = resolveStreamSchedule(events, runtime, nowMs);
  if (snap.status !== "active") return 0;
  return snap.remainingSeconds + 0.05;
}

/** Seconds to subtract from bonus to return to the start of the previous segment. */
export function previousBonusDelta(
  events: StreamScheduleEvent[],
  runtime: StreamEventsRuntime,
  nowMs = Date.now(),
): number {
  const snap = resolveStreamSchedule(events, runtime, nowMs);
  if (snap.status === "waiting") return 0;
  if (snap.status === "finished") {
    const last = events[events.length - 1];
    return last ? -last.durationSeconds : 0;
  }
  if (snap.index <= 0) {
    return -snap.segmentElapsedSeconds;
  }
  const prev = events[snap.index - 1]!;
  return -(snap.segmentElapsedSeconds + prev.durationSeconds);
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}:${String(mm).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function formatUptime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${m}:${String(r).padStart(2, "0")}`;
}
