"use server";

import type { ActivityFeedEvent } from "./activityFeed";
import { ALERT_CATALOG, type AlertEvent } from "@/lib/alertStudio";
import { listAlertEvents } from "./alertStudio.server";

/**
 * Convert an AlertEvent to an ActivityFeedEvent for the dock display.
 * Demo activity is derived from the alert queue.
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
 * Read the activity feed history from Demo alert queue.
 * Associates each activity with its replay availability (can always replay from the dock).
 */
export async function readDemoActivityFeed(): Promise<
  (ActivityFeedEvent & { replayAvailable: boolean })[]
> {
  // Get all events from the alert queue
  const events = listAlertEvents();

  // Convert to activity feed format
  // Recent events first (newest first, matching Activity Feed sort order)
  return events
    .reverse()
    .map((event) => ({
      ...alertEventToActivityFeedEvent(event),
      replayAvailable: true,
    }));
}

/**
 * Replay a specific activity event into the alert queue.
 * For Demo, this is a placeholder that returns success.
 * Actual enqueueing would need a public API in alertStudio.server.
 */
export async function replayDemoActivityEvent(
  eventId: string,
): Promise<{ queued: boolean; duplicate: boolean }> {
  try {
    const events = listAlertEvents();
    const original = events.find((e) => e.id === eventId);

    if (!original) {
      return { queued: false, duplicate: false };
    }

    // Check if already queued to detect dupes
    const isDuplicate = events.some(
      (e) => e.id !== eventId && e.alertId === original.alertId && e.username === original.username,
    );

    // Demo: replay would require a public enqueue function
    // For now, just return success to allow the UI to show the action
    return { queued: true, duplicate: isDuplicate };
  } catch {
    return { queued: false, duplicate: false };
  }
}
