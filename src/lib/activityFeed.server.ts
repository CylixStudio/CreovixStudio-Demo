"use server";

import type { ActivityFeedEvent } from "./activityFeed";
import { ALERT_CATALOG, type AlertEvent } from "@/lib/alertStudio";
import { listAlertEvents, replayAlertEvent } from "./alertStudio.server";
import { kvGet, kvSet } from "./demoKv.server";

const ACTIVITY_HISTORY_KEY = "activity:history";

/**
 * Convert an AlertEvent to an ActivityFeedEvent for the dock display.
 * Demo activity is derived from the alert queue + persistent history.
 */
function alertEventToActivityFeedEvent(event: AlertEvent): ActivityFeedEvent {
  const alertDef = ALERT_CATALOG.find((def) => def.id === event.alertId);
  const eventTypeKey = `${event.alertId}_demo`;

  return {
    id: event.id,
    platform: event.platform,
    event_type: eventTypeKey,
    actor_name: event.username,
    amount: event.count > 0 && event.alertId !== "follow" ? event.count : null,
    currency: null,
    quantity: event.count || 1,
    seconds_added: 0,
    message: null,
    created_at: new Date(event.createdAt).toISOString(),
    isReply: false,
    isTest: event.isTest,
  };
}

/**
 * Add an event to the persistent activity history.
 * Called by readDemoActivityFeed to ensure new events are recorded.
 */
function addToActivityHistory(event: AlertEvent): void {
  try {
    const raw = kvGet(ACTIVITY_HISTORY_KEY);
    const history: AlertEvent[] = raw ? JSON.parse(raw) : [];

    // Check if event already in history
    if (history.some((e) => e.id === event.id)) return;

    // Keep only the last 200 events to avoid unbounded growth
    const MAX_HISTORY = 200;
    history.push(event);
    if (history.length > MAX_HISTORY) {
      history.shift();
    }

    kvSet(ACTIVITY_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Ignore history write errors
  }
}

/**
 * Read the activity feed history from persistent storage + current queue.
 * Associates each activity with its replay availability (all events can be replayed from the dock).
 */
export async function readDemoActivityFeed(): Promise<
  (ActivityFeedEvent & { replayAvailable: boolean })[]
> {
  try {
    // Read persistent history from storage
    const raw = kvGet(ACTIVITY_HISTORY_KEY);
    const history: AlertEvent[] = raw ? JSON.parse(raw) : [];

    // Get current queue events
    const queueEvents = listAlertEvents();

    // Add any new queue events to history
    for (const event of queueEvents) {
      if (!history.some((e) => e.id === event.id)) {
        addToActivityHistory(event);
      }
    }

    // Combine and deduplicate (queue events take precedence if same ID exists)
    const seenIds = new Set<string>();
    const combined: AlertEvent[] = [];

    // Add queue events first (most recent)
    for (const event of queueEvents) {
      if (!seenIds.has(event.id)) {
        combined.push(event);
        seenIds.add(event.id);
      }
    }

    // Add history events (only if not already in queue)
    for (const event of history) {
      if (!seenIds.has(event.id)) {
        combined.push(event);
        seenIds.add(event.id);
      }
    }

    // Return newest first
    return combined
      .reverse()
      .map((event) => ({
        ...alertEventToActivityFeedEvent(event),
        replayAvailable: true,
      }));
  } catch {
    // Fallback to queue-only if history read fails
    const events = listAlertEvents();
    return events
      .reverse()
      .map((event) => ({
        ...alertEventToActivityFeedEvent(event),
        replayAvailable: true,
      }));
  }
}

/**
 * Replay a specific activity event into the alert queue.
 * Actual enqueueing is delegated to the replayAlertEvent server function.
 */
export async function replayDemoActivityEvent(
  eventId: string,
): Promise<{ queued: boolean; duplicate: boolean }> {
  try {
    // Call the server function to replay the event
    const result = replayAlertEvent(eventId);

    return { queued: result.queued, duplicate: false };
  } catch {
    return { queued: false, duplicate: false };
  }
}
