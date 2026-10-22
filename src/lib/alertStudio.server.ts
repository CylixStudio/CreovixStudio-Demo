/**
 * Demo-only alert store. Backed by the per-request DemoDb (table demo_kv).
 * Nothing here talks to Supabase, Kick, or Twitch.
 * The Free/Pro switch is a local test. Production must use userHasActivePro
 * and must not copy this switch.
 */
import { kvGet, kvSet } from "@/lib/demoKv.server";
import { DEMO_BUILD } from "@/lib/demoMode";
import {
  ALERT_CATALOG,
  type AlertEvent,
  type AlertKind,
  type AlertPlan,
  type AlertPlatform,
  type AlertStudioState,
  type MediaAsset,
  type MediaSlot,
  emptyPlatformAlerts,
  inspectUpload,
  isAlertToken,
  DEMO_DOCK_CHANNEL_ID,
  mediaLimit,
  normalizeConfig,
  normalizePlatformAlerts,
  normalizeSimulation,
  renderAlertText,
  supportFor,
  alertDefinition,
  isVariationId,
  selectAlertVariation,
  selectableAlert,
} from "@/lib/alertStudio";

// State lives in the demo database (visitor's browser); nothing touches the server disk.
const SETTINGS_KEY = "alerts:settings";
const QUEUE_KEY = "alerts:queue";
const CONTROL_KEY = "alerts:control";

let chain: Promise<unknown> = Promise.resolve();
const listeners = new Set<(event: AlertEvent) => void>();

type StoredSettings = Omit<AlertStudioState, "limitBytes" | "overlaySeenAt">;

function readJson(key: string): unknown {
  const raw = kvGet(key);
  if (raw === null) throw new Error("missing");
  return JSON.parse(raw);
}

function overlaySeenAtNow(): number {
  return Number(kvGet("alerts:overlay-seen")) || 0;
}

// The first-visit overlay token must be a constant, or concurrent requests would each
// invent a different token before anything is saved. The dock channel id is fixed too.
const DEFAULT_OVERLAY_TOKEN = "demo-alerts-cylixdemo0001";

function readStored(): StoredSettings {
  try {
    return normalizeStored(readJson(SETTINGS_KEY));
  } catch {
    const created: StoredSettings = {
      plan: "pro",
      token: DEFAULT_OVERLAY_TOKEN,
      dockChannelId: DEMO_DOCK_CHANNEL_ID,
      simulation: normalizeSimulation(null),
      alerts: emptyPlatformAlerts(),
      media: [],
    };
    writeStored(created);
    return created;
  }
}

function normalizeStored(raw: unknown): StoredSettings {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const plan: AlertPlan = record["plan"] === "free" ? "free" : "pro";
  const token =
    typeof record["token"] === "string" && isAlertToken(record["token"])
      ? record["token"]
      : DEFAULT_OVERLAY_TOKEN;
  const alerts = normalizePlatformAlerts(record["alerts"]);
  const media = Array.isArray(record["media"])
    ? record["media"].flatMap((item): MediaAsset[] => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const alertId = alertDefinition(String(row["alertId"]))?.id;
        const platform = row["platform"] === "TWITCH" ? "TWITCH" : "KICK";
        const slot = row["slot"] === "audio" || row["slot"] === "visual" ? row["slot"] : null;
        const id =
          typeof row["id"] === "string" && /^[0-9a-f-]{36}$/i.test(row["id"]) ? row["id"] : "";
        const ext = typeof row["ext"] === "string" ? row["ext"] : "";
        if (!alertId || !slot || !id || !ext) return [];
        return [
          {
            ...(isVariationId(row["variationId"]) ? { variationId: row["variationId"] } : {}),
            id,
            platform,
            alertId,
            slot,
            name: typeof row["name"] === "string" ? row["name"].slice(0, 80) : "file",
            bytes: Number(row["bytes"]) || 0,
            mime: typeof row["mime"] === "string" ? row["mime"] : "application/octet-stream",
            ext,
          },
        ];
      })
    : [];
  return {
    plan,
    token,
    dockChannelId: DEMO_DOCK_CHANNEL_ID,
    simulation: normalizeSimulation(record["simulation"]),
    alerts,
    media,
  };
}

function writeStored(settings: StoredSettings): void {
  kvSet(SETTINGS_KEY, JSON.stringify(settings));
}

function withLock<T>(work: () => T): Promise<T> {
  const run = chain.then(work);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function demoAlertsEnabled(): boolean {
  return DEMO_BUILD;
}

export function readAlertStudio(): AlertStudioState {
  const stored = readStored();
  return { ...stored, limitBytes: mediaLimit(stored.plan), overlaySeenAt: overlaySeenAtNow() };
}

export function saveAlertStudio(patch: {
  plan?: AlertPlan;
  alerts?: Partial<Record<AlertPlatform, Record<string, unknown>>>;
  simulation?: unknown;
}): AlertStudioState {
  const current = readStored();
  const plan = patch.plan === "free" || patch.plan === "pro" ? patch.plan : current.plan;
  const alerts = {
    KICK: { ...current.alerts.KICK },
    TWITCH: { ...current.alerts.TWITCH },
  };
  if (patch.alerts) {
    for (const platform of ["KICK", "TWITCH"] as const) {
      const group = patch.alerts[platform];
      if (!group) continue;
      for (const definition of ALERT_CATALOG) {
        if (group[definition.id] !== undefined) {
          alerts[platform][definition.id] = normalizeConfig(group[definition.id], definition);
          if (supportFor(definition, platform).level === "unavailable")
            alerts[platform][definition.id].enabled = false;
        }
      }
    }
  }
  const next: StoredSettings = {
    plan,
    token: current.token,
    dockChannelId: DEMO_DOCK_CHANNEL_ID,
    simulation:
      patch.simulation !== undefined ? normalizeSimulation(patch.simulation) : current.simulation,
    alerts,
    media: current.media,
  };
  writeStored(next);
  return { ...next, limitBytes: mediaLimit(plan), overlaySeenAt: overlaySeenAtNow() };
}

export function updateAlertStudio(
  patch: Parameters<typeof saveAlertStudio>[0],
): Promise<AlertStudioState> {
  return withLock(() => saveAlertStudio(patch));
}

function readQueue(): AlertEvent[] {
  try {
    const parsed = readJson(QUEUE_KEY) as AlertEvent[];
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.id === "string")
      : [];
  } catch {
    return [];
  }
}

// Queue capacity. Events beyond this cap are dropped oldest-first so a paused
// or disconnected display can never build an unbounded backlog. The alert that
// is currently on screen is always preserved.
const ALERT_QUEUE_CAPACITY = 50;

function trimQueue(events: AlertEvent[], keepId: string | null): AlertEvent[] {
  if (events.length <= ALERT_QUEUE_CAPACITY) return events;
  const keep = keepId ? events.find((event) => event.id === keepId) : undefined;
  const rest = events.filter((event) => event.id !== keepId);
  const room = ALERT_QUEUE_CAPACITY - (keep ? 1 : 0);
  const tail = rest.slice(-room);
  return keep ? [...tail, keep] : tail;
}

function writeQueue(events: AlertEvent[], keepId?: string | null): void {
  const preserved = keepId !== undefined ? keepId : (readControl().current?.id ?? null);
  kvSet(QUEUE_KEY, JSON.stringify(trimQueue(events, preserved)));
}

export function listAlertEvents(): AlertEvent[] {
  return readQueue().filter((event) => {
    const definition = alertDefinition(event.alertId);
    return definition && selectableAlert(definition, event.platform);
  });
}

export function ackAlertEvent(id: string): void {
  writeQueue(readQueue().filter((event) => event.id !== id));
}

export function acknowledgeAlert(id: string): Promise<void> {
  return withLock(() => {
    ackAlertEvent(id);
    const control = readControl();
    if (control.current?.id === id) {
      control.current = null;
      writeControl(control);
      broadcastControl(controlSignal("state"));
    }
  });
}

// ===== Alert Control =====
// Server-side control for the OBS alert queue, shared by every dashboard tab and
// OBS source. Pause/resume, skip and clear live here so they survive a dashboard
// reload and behave identically across devices. Durable fields persist to
// control.json; only the live overlay heartbeats stay in memory because they
// describe current connections rather than stored state.

// How long an overlay may hold the display lease before another source may take
// over. Longer than any alert (delay + duration) so normal playback never loses
// the lease mid-alert.
const OVERLAY_LEASE_MS = 12_000;
// How long a claim may stay unacknowledged before the server treats the display
// as gone and consumes the stuck event so the queue keeps moving.
const CLAIM_TIMEOUT_MS = 45_000;

type AlertControl = {
  paused: boolean;
  // Silences audio and speech on the demo overlay; visuals keep playing.
  muted: boolean;
  current: { id: string; overlayId: string; startedAt: number } | null;
  // Overlay id that currently owns the display lease. Extra OBS windows stay on
  // standby so one alert is never consumed twice.
  activeOverlayId: string | null;
};

export type AlertControlSignal = {
  type: "state" | "skip" | "clear";
  paused: boolean;
  muted: boolean;
  currentId: string | null;
  pendingCount: number;
  skipId?: string | null;
};

// Live connection heartbeats: overlayId -> last-seen timestamp. Persisted because the
// demo server is stateless between requests.
const overlayBeats = {
  get(id: string): number | undefined {
    return beatsRead()[id];
  },
  set(id: string, at: number): void {
    const beats = beatsRead();
    for (const [key, value] of Object.entries(beats)) if (at - value > 60_000) delete beats[key];
    beats[id] = at;
    kvSet("alerts:beats", JSON.stringify(beats));
  },
};

function beatsRead(): Record<string, number> {
  try {
    return JSON.parse(kvGet("alerts:beats") ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

const controlListeners = new Set<(signal: AlertControlSignal) => void>();

function readControl(): AlertControl {
  try {
    const raw = readJson(CONTROL_KEY) as Record<string, unknown>;
    const current = raw["current"];
    const currentRecord =
      current && typeof current === "object" ? (current as Record<string, unknown>) : null;
    return {
      paused: raw["paused"] === true,
      muted: raw["muted"] === true,
      current:
        currentRecord && typeof currentRecord["id"] === "string"
          ? {
              id: currentRecord["id"],
              overlayId:
                typeof currentRecord["overlayId"] === "string" ? currentRecord["overlayId"] : "",
              startedAt: Number(currentRecord["startedAt"]) || Date.now(),
            }
          : null,
      activeOverlayId:
        typeof raw["activeOverlayId"] === "string" ? (raw["activeOverlayId"] as string) : null,
    };
  } catch {
    return { paused: false, muted: false, current: null, activeOverlayId: null };
  }
}

function writeControl(control: AlertControl): void {
  kvSet(CONTROL_KEY, JSON.stringify(control));
}

function pendingEvents(control: AlertControl, queue: AlertEvent[]): AlertEvent[] {
  return queue.filter((event) => event.id !== control.current?.id);
}

function controlSignal(
  type: AlertControlSignal["type"],
  extra?: Partial<AlertControlSignal>,
): AlertControlSignal {
  const control = readControl();
  const queue = readQueue();
  return {
    type,
    paused: control.paused,
    muted: control.muted,
    currentId: control.current?.id ?? null,
    pendingCount: pendingEvents(control, queue).length,
    ...extra,
  };
}

function broadcastControl(signal: AlertControlSignal): void {
  for (const listener of controlListeners) listener(signal);
}

export function subscribeAlertControl(listener: (signal: AlertControlSignal) => void): () => void {
  controlListeners.add(listener);
  return () => controlListeners.delete(listener);
}

/** Live queue state for the dashboard (paused, on-screen alert, pending list). */
export function getAlertControlState(): {
  paused: boolean;
  muted: boolean;
  current: AlertEvent | null;
  pending: AlertEvent[];
} {
  const control = readControl();
  const queue = readQueue();
  const current = control.current
    ? (queue.find((event) => event.id === control.current!.id) ?? null)
    : null;
  return {
    paused: control.paused,
    muted: control.muted,
    current,
    pending: pendingEvents(control, queue),
  };
}

/**
 * Register an OBS overlay heartbeat. The first overlay to check in becomes the
 * active display; the lease only moves when the holder stops checking in.
 */
export function touchAlertOverlay(token: string, overlayId?: string | null): boolean {
  if (readStored().token !== token) return false;
  kvSet("alerts:overlay-seen", String(Date.now()));
  if (!overlayId) return true;
  const now = Date.now();
  overlayBeats.set(overlayId, now);
  const control = readControl();
  const holderBeat = control.activeOverlayId ? (overlayBeats.get(control.activeOverlayId) ?? 0) : 0;
  const leaseFree =
    !control.activeOverlayId ||
    control.activeOverlayId === overlayId ||
    now - holderBeat > OVERLAY_LEASE_MS;
  if (leaseFree && control.activeOverlayId !== overlayId) {
    writeControl({ ...control, activeOverlayId: overlayId });
    broadcastControl(controlSignal("state"));
  }
  return true;
}

function activeDisplayId(control: AlertControl, now: number): string | null {
  if (!control.activeOverlayId) return null;
  const beat = overlayBeats.get(control.activeOverlayId) ?? 0;
  return now - beat > OVERLAY_LEASE_MS ? null : control.activeOverlayId;
}

export type ClaimResult =
  | { status: "granted"; event: AlertEvent }
  | { status: "paused" }
  | { status: "idle" }
  | { status: "standby" };

/**
 * Ask for the next alert to display. Only the active display source is granted
 * events; extra OBS windows receive "standby" so an alert is never shown twice.
 */
export function claimNextAlert(overlayId: string): ClaimResult {
  const now = Date.now();
  overlayBeats.set(overlayId, now);
  const control = readControl();

  // Recover from a display that claimed an alert and then vanished.
  if (control.current && now - control.current.startedAt > CLAIM_TIMEOUT_MS) {
    writeQueue(readQueue().filter((event) => event.id !== control.current!.id));
    control.current = null;
    writeControl(control);
    broadcastControl(controlSignal("state"));
  }

  const active = activeDisplayId(control, now);
  if (active && active !== overlayId) return { status: "standby" };
  if (!active) {
    control.activeOverlayId = overlayId;
    writeControl(control);
  }

  if (control.paused) return { status: "paused" };

  const queue = readQueue();
  const next = queue.find((event) => event.id !== control.current?.id);
  if (!next) return { status: "idle" };

  control.current = { id: next.id, overlayId, startedAt: now };
  // Persist the lease as well so a takeover after a restart is predictable.
  control.activeOverlayId = overlayId;
  writeControl(control);
  broadcastControl(controlSignal("state"));
  return { status: "granted", event: next };
}

/** Stop the alert on screen and move it out of the queue. */
export function skipCurrentAlert(): Promise<AlertEvent | null> {
  return withLock(() => {
    const control = readControl();
    if (!control.current) return null;
    const queue = readQueue();
    const skipped = queue.find((event) => event.id === control.current!.id) ?? null;
    writeQueue(queue.filter((event) => event.id !== control.current!.id));
    control.current = null;
    writeControl(control);
    broadcastControl(controlSignal("skip", { skipId: skipped?.id ?? null }));
    return skipped;
  });
}

/** Drop every pending alert but keep the one on screen. Returns the removed count. */
export function clearAlertQueue(): Promise<number> {
  return withLock(() => {
    const control = readControl();
    const queue = readQueue();
    const keep = control.current ? queue.filter((event) => event.id === control.current!.id) : [];
    const removed = queue.length - keep.length;
    writeQueue(keep);
    broadcastControl(controlSignal("clear"));
    return removed;
  });
}

export function setAlertPaused(paused: boolean): Promise<boolean> {
  return withLock(() => {
    const control = readControl();
    if (control.paused === paused) return control.paused;
    writeControl({ ...control, paused });
    broadcastControl(controlSignal("state"));
    return paused;
  });
}

export function setAlertMuted(muted: boolean): Promise<boolean> {
  return withLock(() => {
    const control = readControl();
    if (control.muted === muted) return control.muted;
    writeControl({ ...control, muted });
    broadcastControl(controlSignal("state"));
    return muted;
  });
}

export function subscribeAlertEvents(listener: (event: AlertEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Request IDs deduplicate retries; one gift operation always produces one alert.
const recentTests = new Map<
  string,
  { at: number; result: { queued: boolean; message: string; event: AlertEvent | null } }
>();

export function queueAlertTest(input: {
  alertId: string;
  platform: AlertPlatform;
  username: string;
  count: number;
  months: number;
  amount?: number | undefined;
  message?: string | undefined;
  config?: unknown;
  requestId?: string | undefined;
}): { queued: boolean; message: string; event: AlertEvent | null } {
  const duplicate = input.requestId ? recentTests.get(input.requestId) : undefined;
  if (duplicate && Date.now() - duplicate.at < 300000) return duplicate.result;
  const definition = alertDefinition(input.alertId);
  if (!definition || !selectableAlert(definition, input.platform))
    return { queued: false, message: "نوع التنبيه غير معروف.", event: null };
  const support = supportFor(definition, input.platform);
  if (support.level === "unavailable") {
    return { queued: false, message: support.note, event: null };
  }
  if (
    definition.id === "gift" &&
    (!Number.isSafeInteger(input.count) || input.count < 1 || input.count > 100000)
  ) {
    return { queued: false, message: "alerts.positiveCount", event: null };
  }
  const stored = readStored();
  const baseConfig =
    input.config !== undefined
      ? normalizeConfig(input.config, definition)
      : stored.alerts[input.platform][definition.id];
  const simulation = normalizeSimulation({
    username: input.username,
    platform: input.platform,
    count: input.count,
    months: input.months,
    amount: input.amount,
    message: input.message,
  });
  const variation = selectAlertVariation(baseConfig, simulation);
  const config = variation?.config ?? baseConfig;
  const visual =
    stored.media.find(
      (asset) =>
        asset.platform === input.platform &&
        asset.alertId === definition.id &&
        asset.slot === "visual" &&
        asset.variationId === variation?.id,
    ) ?? null;
  const audio =
    stored.media.find(
      (asset) =>
        asset.platform === input.platform &&
        asset.alertId === definition.id &&
        asset.slot === "audio" &&
        asset.variationId === variation?.id,
    ) ?? null;
  const event: AlertEvent = {
    id: crypto.randomUUID(),
    alertId: definition.id,
    platform: input.platform,
    username: simulation.username,
    count: simulation.count,
    months: simulation.months,
    amount: simulation.amount,
    message: simulation.message,
    variationId: variation?.id,
    text: renderAlertText(config.message, {
      ...simulation,
      message: config.hideUserMessage ? "" : simulation.message,
    }),
    config,
    visualId: config.visualSource === "upload" ? (visual?.id ?? null) : null,
    visualMime: config.visualSource === "upload" ? (visual?.mime ?? null) : null,
    visualUrl: config.visualSource === "url" ? config.visualUrl : undefined,
    audioId: config.audioSource === "upload" ? (audio?.id ?? null) : null,
    createdAt: Date.now(),
  };
  if (!baseConfig.enabled || !config.enabled) {
    return { queued: false, message: "التنبيه متوقف، لذلك لم يُرسل إلى OBS.", event };
  }
  const queue = readQueue();
  queue.push(event);
  writeQueue(queue);
  for (const listener of listeners) listener(event);
  const result = { queued: true, message: "أُضيف التنبيه إلى طابور OBS.", event };
  if (input.requestId) {
    if (recentTests.size >= 200) recentTests.delete(recentTests.keys().next().value!);
    recentTests.set(input.requestId, { at: Date.now(), result });
  }
  return result;
}

export function enqueueAlertTest(input: Parameters<typeof queueAlertTest>[0]) {
  return withLock(() => queueAlertTest(input));
}

export async function storeAlertMedia(input: {
  platform: AlertPlatform;
  alertId: string;
  slot: MediaSlot;
  variationId?: string | undefined;
  filename: string;
  bytes: Uint8Array;
}): Promise<
  { ok: true; asset: MediaAsset; studio: AlertStudioState } | { ok: false; message: string }
> {
  const definition = alertDefinition(input.alertId);
  if (!definition) return { ok: false, message: "نوع التنبيه غير معروف." };
  if (supportFor(definition, input.platform).level === "unavailable") {
    return { ok: false, message: supportFor(definition, input.platform).note };
  }
  return withLock(() => {
    // Demo: uploads need durable binary storage, which the database-free demo does not have.
    if (input.bytes.byteLength >= 0) {
      return {
        ok: false as const,
        message: "رفع الملفات غير متاح في الديمو. استخدم رابط URL للصورة أو الصوت.",
      };
    }
    const stored = readStored();
    const checked = inspectUpload(input.bytes, input.filename, input.slot, stored.plan);
    if (!checked.ok) return checked;
    if (input.variationId !== undefined && !isVariationId(input.variationId))
      return { ok: false as const, message: "تنويعة غير صالحة." };
    const id = crypto.randomUUID();
    const previous = stored.media.filter(
      (asset) =>
        asset.platform === input.platform &&
        asset.alertId === definition.id &&
        asset.slot === input.slot &&
        asset.variationId === input.variationId,
    );
    void previous;
    const asset: MediaAsset = {
      ...(input.variationId ? { variationId: input.variationId } : {}),
      id,
      platform: input.platform,
      alertId: definition.id,
      slot: input.slot,
      name: input.filename.replace(/[^\w.\u0600-\u06ff -]/g, "").slice(0, 80) || `file.${checked.ext}`,
      bytes: input.bytes.byteLength,
      mime: checked.mime,
      ext: checked.ext,
    };
    const config = input.variationId
      ? stored.alerts[input.platform][definition.id].variations.find(
          (item) => item.id === input.variationId,
        )?.config
      : stored.alerts[input.platform][definition.id];
    if (config) {
      config[input.slot === "visual" ? "visualSource" : "audioSource"] = "upload";
      config[input.slot === "visual" ? "visualUrl" : "audioUrl"] = "";
    }
    const next: StoredSettings = {
      ...stored,
      media: [...stored.media.filter((item) => !previous.some((old) => old.id === item.id)), asset],
    };
    writeStored(next);
    return {
      ok: true as const,
      asset,
      studio: { ...next, limitBytes: mediaLimit(next.plan), overlaySeenAt: overlaySeenAtNow() },
    };
  });
}

export function readAlertMedia(_id: string): { bytes: Uint8Array; mime: string } | null {
  return null;
}

export function deleteAlertMedia(id: string): AlertStudioState | null {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const stored = readStored();
  const asset = stored.media.find((item) => item.id === id);
  if (!asset) return null;
  const config = asset.variationId
    ? stored.alerts[asset.platform][asset.alertId].variations.find(
        (item) => item.id === asset.variationId,
      )?.config
    : stored.alerts[asset.platform][asset.alertId];
  if (config && config[asset.slot === "visual" ? "visualSource" : "audioSource"] === "upload") {
    config[asset.slot === "visual" ? "visualSource" : "audioSource"] = "none";
  }
  const next = { ...stored, media: stored.media.filter((item) => item.id !== id) };
  writeStored(next);
  return { ...next, limitBytes: mediaLimit(next.plan), overlaySeenAt: overlaySeenAtNow() };
}

export function removeAlertMedia(id: string): Promise<AlertStudioState | null> {
  return withLock(() => deleteAlertMedia(id));
}

/** OBS overlay token (claim, ack, live, presence). */
export function alertTokenMatches(token: string): boolean {
  return readStored().token === token;
}

/** Activity Dock channel id (feed, replay). Only the fixed demo channel is accepted. */
export function dockTokenMatches(token: string): boolean {
  return token === DEMO_DOCK_CHANNEL_ID;
}

/** Queue controls are used by the dashboard (overlay token) and by the Dock (channel id). */
export function controlTokenMatches(token: string): boolean {
  return readStored().token === token || token === DEMO_DOCK_CHANNEL_ID;
}

// ===== Platform event ingest =====
// Normalized platform events (Kick/Twitch) enter the same catalog + variation +
// queue path as test alerts, so OBS renders them identically. Provider event IDs
// are remembered here to reject webhook redelivery, and the queue is shared with
// the dashboard control state, so the queue is never consumed twice.
const recentPlatformEvents = new Map<string, number>();
const PLATFORM_EVENT_TTL_MS = 10 * 60_000;
const PLATFORM_EVENT_WINDOW = 600;

/** Returns true the first time an event id is seen, false on a redelivery. */
function rememberPlatformEvent(providerEventId: string): boolean {
  const now = Date.now();
  for (const [key, at] of recentPlatformEvents) {
    if (now - at > PLATFORM_EVENT_TTL_MS) recentPlatformEvents.delete(key);
  }
  if (recentPlatformEvents.has(providerEventId)) return false;
  if (recentPlatformEvents.size >= PLATFORM_EVENT_WINDOW) {
    recentPlatformEvents.delete(recentPlatformEvents.keys().next().value!);
  }
  recentPlatformEvents.set(providerEventId, now);
  return true;
}

export type PlatformAlertInput = {
  platform: AlertPlatform;
  providerEventId: string;
  alertId: AlertKind;
  username: string;
  count: number;
  months: number;
  amount?: number | undefined;
  message?: string | undefined;
};

/**
 * Enqueue a normalized platform event. Uses the saved alert settings and applies
 * matching variations exactly like a live event. Duplicate provider event ids are
 * ignored so a redelivered webhook cannot trigger the alert twice.
 */
export function ingestPlatformAlert(input: PlatformAlertInput): {
  queued: boolean;
  message: string;
  event: AlertEvent | null;
} {
  if (!input.providerEventId) {
    return { queued: false, message: "missing_event_id", event: null };
  }
  if (!rememberPlatformEvent(`${input.platform}:${input.providerEventId}`)) {
    return { queued: false, message: "duplicate", event: null };
  }
  return queueAlertTest({
    alertId: input.alertId,
    platform: input.platform,
    username: input.username,
    count: input.count,
    months: input.months,
    amount: input.amount,
    message: input.message,
  });
}

export function enqueuePlatformAlert(input: PlatformAlertInput) {
  return withLock(() => ingestPlatformAlert(input));
}
