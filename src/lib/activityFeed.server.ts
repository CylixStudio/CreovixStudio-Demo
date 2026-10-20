import { getDemoDb } from "@/demo/context";
import type { Row } from "@/demo/db";
import {
  alertDefinition,
  selectableAlert,
  supportFor,
  type AlertKind,
  type AlertPlatform,
} from "@/lib/alertStudio";
import { enqueueAlertTest } from "@/lib/alertStudio.server";
import { isAllowedPlatformEvent } from "@/lib/platformEvents";
import { readReplyMeta } from "@/lib/replyAlert";
import { isStoredTestRow, readTestDisplay } from "@/lib/testAlert";
import type { ActivityFeedEvent } from "./activityFeed";

/**
 * Dock activity source. It reads the same demo `events` / `target_events` tables the
 * Activity Feed page reads, so both screens show one history. The alert queue is
 * never treated as history: Clear Queue cannot remove a record from here.
 */

const FEED_LIMIT = 200;

function readMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  for (const key of ["message", "text", "comment", "user_message", "body"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 400);
  }
  return null;
}

function toFeedEvent(row: Row): ActivityFeedEvent {
  const payload = row["raw_payload"];
  const reply = readReplyMeta(payload);
  const display = readTestDisplay(payload);
  const test = isStoredTestRow({ event_type: String(row["event_type"]), raw_payload: payload });
  const amount = row["amount"] == null ? null : Number(row["amount"]);
  const quantity = row["quantity"] == null ? 1 : Number(row["quantity"]);
  return {
    id: String(row["id"]),
    platform: String(row["platform"]),
    event_type: String(row["event_type"]),
    actor_name: typeof row["actor_name"] === "string" ? row["actor_name"] : null,
    amount: display?.amount ?? amount,
    currency: display?.currency ?? (typeof row["currency"] === "string" ? row["currency"] : null),
    quantity: display?.quantity ?? quantity,
    seconds_added: test ? 0 : Number(row["seconds_added"] ?? 0),
    message: readMessage(payload),
    created_at: String(row["created_at"]),
    isReply: reply.isReply,
    replyQuote: reply.quote,
    ...(test ? { isTest: true as const } : {}),
  };
}

function loadRecords(): ActivityFeedEvent[] {
  const db = getDemoDb();
  const rows: Row[] = [
    ...db.rows("events"),
    ...db.rows("target_events").map((row) => ({ ...row, seconds_added: 0, raw_payload: {} })),
  ];
  const byId = new Map<string, ActivityFeedEvent>();
  for (const row of rows) {
    if (!row["id"] || !row["created_at"]) continue;
    const event = toFeedEvent(row);
    byId.set(event.id, event);
  }
  return [...byId.values()]
    .filter((event) => isAllowedPlatformEvent(event.platform, event.event_type))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, FEED_LIMIT);
}

type ReplayPlan = {
  alertId: AlertKind;
  platform: AlertPlatform;
  username: string;
  count: number;
  months: number;
  amount?: number;
  message?: string;
};

/**
 * Maps a stored activity record onto the alert it would have produced. Only Kick and
 * Twitch have alert definitions, so records from other sources are not replayable.
 */
function replayPlan(event: ActivityFeedEvent): ReplayPlan | null {
  if (event.platform !== "KICK" && event.platform !== "TWITCH") return null;
  const platform: AlertPlatform = event.platform;
  const quantity = Math.max(1, Math.round(Number(event.quantity) || 1));
  const amount = event.amount != null && Number.isFinite(event.amount) ? event.amount : null;
  let alertId: AlertKind;
  let count = 1;
  let kicksAmount: number | undefined;
  switch (event.event_type) {
    case "FOLLOW":
      alertId = "follow";
      break;
    case "SUBSCRIPTION":
      alertId = "subscription";
      break;
    case "GIFT_SUB":
      alertId = "gift";
      count = quantity;
      break;
    case "RAID":
      alertId = "raid";
      count = quantity;
      break;
    case "BITS":
      if (platform === "KICK") {
        alertId = "kicks";
        kicksAmount = amount ?? quantity;
      } else {
        alertId = "cheer";
        count = amount ?? quantity;
      }
      break;
    default:
      return null;
  }
  const definition = alertDefinition(alertId);
  if (!definition || !selectableAlert(definition, platform)) return null;
  if (supportFor(definition, platform).level === "unavailable") return null;
  return {
    alertId,
    platform,
    username: event.actor_name?.trim() ?? "",
    count,
    months: 1,
    ...(kicksAmount !== undefined ? { amount: kicksAmount } : {}),
    ...(event.message ? { message: event.message } : {}),
  };
}

export async function readDemoActivityFeed(): Promise<
  (ActivityFeedEvent & { replayAvailable: boolean })[]
> {
  return loadRecords().map((event) => ({ ...event, replayAvailable: replayPlan(event) !== null }));
}

export type ReplayResult =
  | { queued: true }
  | { queued: false; reason: "not_found" | "not_replayable" | "rejected" };

/**
 * Replays one stored record as a fresh alert. The id must exist in the activity
 * source above, so a caller cannot enqueue arbitrary payloads. The enqueue goes
 * through the normal alert path (saved settings, variations, queue), nothing is
 * written to the record, and the result reflects whether the queue accepted it.
 */
export async function replayDemoActivityEvent(eventId: string): Promise<ReplayResult> {
  const record = loadRecords().find((event) => event.id === eventId);
  if (!record) return { queued: false, reason: "not_found" };
  const plan = replayPlan(record);
  if (!plan) return { queued: false, reason: "not_replayable" };
  const result = await enqueueAlertTest(plan);
  return result.queued ? { queued: true } : { queued: false, reason: "rejected" };
}
