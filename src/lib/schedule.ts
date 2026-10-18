export type ScheduleSlot = {
  id: string;
  weekday: number;
  /** YYYY-MM-DD for a one-off day; null repeats every matching weekday. */
  occursOn: string | null;
  startMinutes: number;
  durationMinutes: number;
  game: string;
  title: string;
  notes: string;
  coverUrl: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleSettings = {
  shareToken: string;
  timezone: string;
  title: string;
  reminderNote: string;
};

export type ScheduleState = {
  settings: ScheduleSettings;
  slots: ScheduleSlot[];
};

export type ScheduleSlotInput = {
  id?: string;
  weekday: number;
  occursOn: string | null;
  startMinutes: number;
  durationMinutes: number;
  game: string;
  title: string;
  notes: string;
  coverUrl: string;
  enabled: boolean;
};

/** ~60KB cap so test-mode localStorage can hold a month of readable posters. */
export const COVER_MAX_CHARS = 80_000;

export const WEEKDAYS_SUNDAY_FIRST = [0, 1, 2, 3, 4, 5, 6] as const;
export const ICS_BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettings = {
  shareToken: "test-schedule",
  timezone: "UTC",
  title: "Stream schedule",
  reminderNote: "",
};

const TEST_KEY = "creovix:stream-schedule";

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(raw: string): Date | null {
  const match = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function sanitizeOccursOn(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().slice(0, 10);
  return parseIsoDate(trimmed) ? trimmed : null;
}

export function weekdayFromIso(iso: string): number {
  const parsed = sanitizeOccursOn(iso);
  if (!parsed) return 1;
  const [yearRaw, monthRaw, dayRaw] = parsed.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return 1;
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function zonedIsoDate(timeZone: string, from = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(from);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return y && m && d ? `${y}-${m}-${d}` : toIsoDate(from);
}

export function isCoverDataUrl(value: string): boolean {
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value.trim());
}

export function sanitizeCoverUrl(raw: string, allowDataUrl = true): string {
  const value = raw.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value) && value.length <= 2048) return value;
  if (allowDataUrl && isCoverDataUrl(value) && value.length <= COVER_MAX_CHARS) return value;
  return "";
}

/** 3:4 JPEG data URL so calendar posters stay readable after compression. */
export async function compressCoverFile(file: File, width = 240, height = 320): Promise<string> {
  if (!file.type.startsWith("image/")) return "";
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    const srcRatio = bitmap.width / bitmap.height;
    const destRatio = width / height;
    let sx = 0;
    let sy = 0;
    let sw = bitmap.width;
    let sh = bitmap.height;
    if (srcRatio > destRatio) {
      sw = bitmap.height * destRatio;
      sx = (bitmap.width - sw) / 2;
    } else {
      sh = bitmap.width / destRatio;
      sy = (bitmap.height - sh) / 2;
    }
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
    bitmap.close();
    let quality = 0.8;
    let url = canvas.toDataURL("image/jpeg", quality);
    while (url.length > COVER_MAX_CHARS && quality > 0.4) {
      quality -= 0.1;
      url = canvas.toDataURL("image/jpeg", quality);
    }
    return url.length > COVER_MAX_CHARS ? "" : url;
  } catch {
    return "";
  }
}

export function emptySlotDraft(anchor: Date | string = new Date()): ScheduleSlotInput {
  const date = typeof anchor === "string" ? (parseIsoDate(anchor) ?? new Date()) : anchor;
  const occursOn = toIsoDate(date);
  return {
    weekday: weekdayFromIso(occursOn),
    occursOn,
    startMinutes: 18 * 60,
    durationMinutes: 180,
    game: "",
    title: "",
    notes: "",
    coverUrl: "",
    enabled: true,
  };
}

export function slotOnDate(slot: Pick<ScheduleSlot, "weekday" | "occursOn">, date: Date | string): boolean {
  const iso = typeof date === "string" ? date : toIsoDate(date);
  if (slot.occursOn) return slot.occursOn === iso;
  return slot.weekday === weekdayFromIso(iso);
}

export type MonthCell = { date: Date; iso: string; inMonth: boolean; isToday: boolean };

export function monthGrid(year: number, month: number, weekdays: number[], todayIso?: string): MonthCell[] {
  const first = new Date(year, month, 1);
  const startPad = weekdays.indexOf(first.getDay());
  const pad = startPad < 0 ? 0 : startPad;
  const start = new Date(year, month, 1 - pad);
  const today = todayIso ?? toIsoDate(new Date());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const iso = toIsoDate(date);
    return {
      date,
      iso,
      inMonth: date.getMonth() === month,
      isToday: iso === today,
    };
  });
}

export function monthLabel(year: number, month: number, _lang?: "en" | "ar"): string {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(
    new Date(year, month, 1),
  );
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const next = new Date(year, month + delta, 1);
  return { year: next.getFullYear(), month: next.getMonth() };
}

export function clampWeekday(value: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(n, 0), 6);
}

export function clampStartMinutes(value: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 18 * 60;
  return Math.min(Math.max(n, 0), 1439);
}

export function clampDuration(value: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 180;
  return Math.min(Math.max(n, 15), 1440);
}

export function formatClock(minutes: number, hour12 = false): string {
  const safe = clampStartMinutes(minutes);
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(mins).padStart(2, "0");
  if (!hour12) return `${hh}:${mm}`;
  const suffix = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${h}:${mm} ${suffix}`;
}

export function parseClock(raw: string): number | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours < 0 || hours > 23 || mins < 0 || mins > 59) return null;
  return hours * 60 + mins;
}

export function weekOrder(_lang?: "en" | "ar"): number[] {
  return [1, 2, 3, 4, 5, 6, 0];
}

export function weekdayLabel(weekday: number, _lang?: "en" | "ar", short = false): string {
  const en = short
    ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return en[clampWeekday(weekday)] ?? "";
}

function emptyTestState(): ScheduleState {
  return {
    settings: { ...DEFAULT_SCHEDULE_SETTINGS, shareToken: "test-schedule" },
    slots: [],
  };
}

function normalizeTestSlot(slot: Partial<ScheduleSlot>): ScheduleSlot | null {
  if (!slot.id || typeof slot.title !== "string" || !slot.title.trim()) return null;
  const occursOn = sanitizeOccursOn(slot.occursOn);
  return {
    id: String(slot.id),
    weekday: occursOn ? weekdayFromIso(occursOn) : clampWeekday(slot.weekday ?? 1),
    occursOn,
    startMinutes: clampStartMinutes(slot.startMinutes ?? 18 * 60),
    durationMinutes: clampDuration(slot.durationMinutes ?? 180),
    game: String(slot.game ?? "").slice(0, 80),
    title: slot.title.trim().slice(0, 80),
    notes: String(slot.notes ?? "").slice(0, 280),
    coverUrl: sanitizeCoverUrl(String(slot.coverUrl ?? "")),
    enabled: Boolean(slot.enabled),
    createdAt: slot.createdAt ?? new Date().toISOString(),
    updatedAt: slot.updatedAt ?? new Date().toISOString(),
  };
}

export function loadTestSchedule(): ScheduleState {
  if (typeof window === "undefined") return emptyTestState();
  try {
    const raw = window.localStorage.getItem(TEST_KEY);
    if (!raw) return emptyTestState();
    const parsed = JSON.parse(raw) as Partial<ScheduleState>;
    return {
      settings: {
        shareToken: parsed.settings?.shareToken || "test-schedule",
        timezone: parsed.settings?.timezone?.trim() || "UTC",
        title: (parsed.settings?.title ?? "Stream schedule").slice(0, 80) || "Stream schedule",
        reminderNote: (parsed.settings?.reminderNote ?? "").slice(0, 280),
      },
      slots: Array.isArray(parsed.slots)
        ? parsed.slots.map((slot) => normalizeTestSlot(slot)).filter((slot): slot is ScheduleSlot => Boolean(slot))
        : [],
    };
  } catch {
    return emptyTestState();
  }
}

function persistTest(state: ScheduleState) {
  try {
    window.localStorage.setItem(TEST_KEY, JSON.stringify(state));
  } catch {
    throw new Error("storage_full");
  }
}

export function saveTestScheduleSettings(patch: Partial<ScheduleSettings>): ScheduleState {
  const state = loadTestSchedule();
  state.settings = {
    ...state.settings,
    ...patch,
    timezone: (patch.timezone ?? state.settings.timezone).trim().slice(0, 64) || "UTC",
    title: (patch.title ?? state.settings.title).trim().slice(0, 80) || "Stream schedule",
    reminderNote: (patch.reminderNote ?? state.settings.reminderNote).trim().slice(0, 280),
  };
  persistTest(state);
  return state;
}

export function upsertTestSlot(input: ScheduleSlotInput): ScheduleState {
  const state = loadTestSchedule();
  const now = new Date().toISOString();
  const title = input.title.trim().slice(0, 80);
  const occursOn = sanitizeOccursOn(input.occursOn);
  const weekday = occursOn ? weekdayFromIso(occursOn) : clampWeekday(input.weekday);
  const row: ScheduleSlot = {
    id: input.id ?? crypto.randomUUID(),
    weekday,
    occursOn,
    startMinutes: clampStartMinutes(input.startMinutes),
    durationMinutes: clampDuration(input.durationMinutes),
    game: input.game.trim().slice(0, 80),
    title,
    notes: input.notes.trim().slice(0, 280),
    coverUrl: sanitizeCoverUrl(input.coverUrl),
    enabled: Boolean(input.enabled),
    createdAt: state.slots.find((slot) => slot.id === input.id)?.createdAt ?? now,
    updatedAt: now,
  };
  state.slots = [row, ...state.slots.filter((slot) => slot.id !== row.id)].sort(
    (a, b) =>
      (a.occursOn ?? "").localeCompare(b.occursOn ?? "") || a.weekday - b.weekday || a.startMinutes - b.startMinutes,
  );
  persistTest(state);
  return state;
}

export function deleteTestSlot(id: string): ScheduleState {
  const state = loadTestSchedule();
  state.slots = state.slots.filter((slot) => slot.id !== id);
  persistTest(state);
  return state;
}

export function publicSchedulePayload(state: ScheduleState) {
  return {
    title: state.settings.title,
    timezone: state.settings.timezone,
    reminderNote: state.settings.reminderNote,
    slots: state.slots
      .filter((slot) => slot.enabled)
      .map((slot) => ({
        id: slot.id,
        weekday: slot.weekday,
        occursOn: slot.occursOn,
        startMinutes: slot.startMinutes,
        durationMinutes: slot.durationMinutes,
        game: slot.game,
        title: slot.title,
        notes: slot.notes,
        coverUrl: slot.coverUrl,
      })),
  };
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function datedStamp(iso: string, startMinutes: number): string {
  const key = sanitizeOccursOn(iso)?.replace(/-/g, "") ?? "19700101";
  const hours = Math.floor(clampStartMinutes(startMinutes) / 60);
  const mins = clampStartMinutes(startMinutes) % 60;
  return `${key}T${pad(hours)}${pad(mins)}00`;
}

/** Next occurrence of weekday+time in the given IANA zone, as a floating local ICS datetime. */
export function nextLocalStamp(weekday: number, startMinutes: number, timeZone: string, from = new Date()): string {
  const day = clampWeekday(weekday);
  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(from.getTime() + offset * 86_400_000);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(candidate);
    const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    if (map[wd] !== day) continue;
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const date = parts.find((p) => p.type === "day")?.value;
    const hours = Math.floor(clampStartMinutes(startMinutes) / 60);
    const mins = clampStartMinutes(startMinutes) % 60;
    if (year && month && date) return `${year}${month}${date}T${pad(hours)}${pad(mins)}00`;
  }
  return `${from.getUTCFullYear()}${pad(from.getUTCMonth() + 1)}${pad(from.getUTCDate())}T${pad(
    Math.floor(startMinutes / 60),
  )}${pad(startMinutes % 60)}00`;
}

export function buildScheduleIcs(state: Pick<ScheduleState, "settings" | "slots">, origin = "https://creovix.studio"): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const tz = state.settings.timezone || "UTC";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CylixStudio//Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(state.settings.title)}`,
    `X-WR-TIMEZONE:${icsEscape(tz)}`,
  ];
  for (const slot of state.slots.filter((item) => item.enabled)) {
    const dtStart = slot.occursOn
      ? datedStamp(slot.occursOn, slot.startMinutes)
      : nextLocalStamp(slot.weekday, slot.startMinutes, tz);
    const hours = Math.floor(slot.durationMinutes / 60);
    const mins = slot.durationMinutes % 60;
    const duration = mins ? `PT${hours}H${mins}M` : `PT${hours}H`;
    const desc = [slot.game, slot.notes].filter(Boolean).join(" — ");
    const event = [
      "BEGIN:VEVENT",
      `UID:${slot.id}@creovix.studio`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${tz}:${dtStart}`,
      `DURATION:${duration}`,
    ];
    if (!slot.occursOn) event.push(`RRULE:FREQ=WEEKLY;BYDAY=${ICS_BYDAY[slot.weekday]}`);
    event.push(
      `SUMMARY:${icsEscape(slot.title)}`,
      desc ? `DESCRIPTION:${icsEscape(desc)}` : "DESCRIPTION:",
      `URL:${origin}/overlay/schedule?token=${state.settings.shareToken}`,
      "END:VEVENT",
    );
    lines.push(...event);
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
