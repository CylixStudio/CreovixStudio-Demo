/**
 * Demo-only platform event receiver.
 *
 * It mirrors the real webhook pipeline that already exists in this repo
 * (signature verification -> normalization -> per-channel isolation -> queue)
 * but writes only to the isolated demo alert store (.demo-data/alerts). It never
 * touches Supabase, CylixBot receipts, Kick OAuth, or the production webhook
 * routes under /api/public/webhooks.
 *
 * Real Kick/Twitch delivery needs a public HTTPS origin plus configured app
 * credentials and subscriptions, so in the Demo the path is exercised by the
 * signed simulator. Every step below is the real one; only the transport that
 * feeds it is simulated.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { AlertKind, AlertPlatform } from "@/lib/alertStudio";
import { enqueuePlatformAlert } from "@/lib/alertStudio.server";
import { DEMO_CHANNEL_ID, PLATFORM_EVENT_TYPES, type DemoPlatform } from "./alertEvents.shared";

const root = path.join(process.cwd(), ".demo-data", "alerts");
const secretPath = path.join(root, "ingest-secret");
const SIGNATURE_TTL_MS = 5 * 60_000;

export type PlatformEventPayload = {
  platform: DemoPlatform;
  type: string;
  providerEventId: string;
  channelId?: string;
  actor?: string;
  quantity?: number;
  months?: number;
  amount?: number;
  message?: string;
};

let cachedSecret = "";

export function ingestSecret(): string {
  if (cachedSecret) return cachedSecret;
  try {
    const value = fs.readFileSync(secretPath, "utf8").trim();
    if (value) {
      cachedSecret = value;
      return cachedSecret;
    }
  } catch {
    // fall through
  }
  fs.mkdirSync(root, { recursive: true });
  cachedSecret = randomBytes(24).toString("hex");
  fs.writeFileSync(secretPath, cachedSecret, { mode: 0o600 });
  return cachedSecret;
}

export function signIngestBody(rawBody: string, timestamp = Date.now()): string {
  return createHmac("sha256", ingestSecret()).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function verifyIngestSignature(input: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
}): { ok: boolean; reason: string } {
  const { rawBody, timestamp, signature } = input;
  if (!timestamp || !signature) return { ok: false, reason: "missing_signature" };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad_timestamp" };
  if (Math.abs(Date.now() - ts) > SIGNATURE_TTL_MS) return { ok: false, reason: "stale_signature" };
  const expected = createHmac("sha256", ingestSecret()).update(`${timestamp}.${rawBody}`).digest("hex");
  const actual = Buffer.from(signature, "utf8");
  const wanted = Buffer.from(expected, "utf8");
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) {
    return { ok: false, reason: "invalid_signature" };
  }
  return { ok: true, reason: "ok" };
}

function normalize(raw: PlatformEventPayload): AlertKind | null {
  const table = PLATFORM_EVENT_TYPES[raw.platform];
  if (!table) return null;
  return table.find((entry) => entry.type === raw.type)?.alertId ?? null;
}

export async function ingestSignedPlatformEvent(input: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
}): Promise<{
  ok: boolean;
  status: string;
  queued?: boolean;
  message?: string;
  alertId?: string;
}> {
  const verified = verifyIngestSignature(input);
  if (!verified.ok) return { ok: false, status: verified.reason };

  let raw: PlatformEventPayload;
  try {
    raw = JSON.parse(input.rawBody) as PlatformEventPayload;
  } catch {
    return { ok: false, status: "invalid_json" };
  }
  if (raw.platform !== "KICK" && raw.platform !== "TWITCH") {
    return { ok: false, status: "unknown_platform" };
  }
  if (raw.channelId && raw.channelId !== DEMO_CHANNEL_ID) {
    return { ok: false, status: "channel_mismatch" };
  }
  const alertId = normalize(raw);
  if (!alertId) return { ok: false, status: "unsupported_type" };
  if (!raw.providerEventId) return { ok: false, status: "missing_event_id" };

  const result = await enqueuePlatformAlert({
    platform: raw.platform as AlertPlatform,
    providerEventId: raw.providerEventId,
    alertId,
    username: raw.actor?.trim() || "Viewer",
    count: Number.isSafeInteger(raw.quantity) ? Number(raw.quantity) : 1,
    months: Number.isSafeInteger(raw.months) ? Number(raw.months) : 1,
    amount: typeof raw.amount === "number" ? raw.amount : undefined,
    message: raw.message,
  });
  return {
    ok: result.queued,
    status: result.queued ? "queued" : "skipped",
    queued: result.queued,
    message: result.message,
    alertId,
  };
}

export async function simulatePlatformEvent(input: {
  platform: DemoPlatform;
  type: string;
  actor?: string;
  quantity?: number;
  months?: number;
  amount?: number;
  message?: string;
}): Promise<{
  ok: boolean;
  status: string;
  queued?: boolean;
  message?: string;
  alertId?: string;
  providerEventId: string;
}> {
  const providerEventId = `${input.platform.toLowerCase()}-sim-${randomBytes(8).toString("hex")}`;
  const payload: PlatformEventPayload = {
    platform: input.platform,
    type: input.type,
    providerEventId,
    channelId: DEMO_CHANNEL_ID,
    ...(input.actor ? { actor: input.actor } : {}),
    ...(typeof input.quantity === "number" && !Number.isNaN(input.quantity) ? { quantity: input.quantity } : {}),
    ...(typeof input.months === "number" && !Number.isNaN(input.months) ? { months: input.months } : {}),
    ...(typeof input.amount === "number" && !Number.isNaN(input.amount) ? { amount: input.amount } : {}),
    ...(input.message ? { message: input.message } : {}),
  };
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const signature = signIngestBody(rawBody, Number(timestamp));
  const result = await ingestSignedPlatformEvent({ rawBody, timestamp, signature });
  return { ...result, providerEventId };
}