export const GOAL_LAYOUTS = [
  "classic",
  "compact",
  "bold",
  "glass",
  "ring",
  "segments",
  "scoreboard",
  "cinema",
] as const;
export type GoalLayout = (typeof GOAL_LAYOUTS)[number];

export const WHEEL_LAYOUTS = [
  "classic",
  "compact",
  "bare",
  "show",
  "bottom",
  "studio",
  "spotlight",
  "orbit",
] as const;
export type WheelLayout = (typeof WHEEL_LAYOUTS)[number];

export const EVENT_LABEL_LAYOUTS = [
  "island",
  "ticker",
  "stack",
  "cycle",
  "floating",
  "timeline",
  "spotlight",
  "ribbon",
] as const;
export type EventLabelLayout = (typeof EVENT_LABEL_LAYOUTS)[number];

export const CHROME_LAYOUTS = [
  "glass",
  "direct",
  "bold",
  "lower-third",
  "message",
  "pill",
  "split",
  "featured",
] as const;
export type ChromeLayout = (typeof CHROME_LAYOUTS)[number];

export const VIEWER_LAYOUTS = [
  "island",
  "bar",
  "digits",
  "live",
  "digital",
  "lower-third",
  "hud",
  "ambient",
] as const;
export type ViewerLayout = (typeof VIEWER_LAYOUTS)[number];

export const POLL_LAYOUTS = [
  "default",
  "compact",
  "cards",
  "columns",
  "ballot",
  "leaderboard",
  "donut",
  "split",
] as const;
export const PREDICTION_LAYOUTS = [
  "classic",
  "compact",
  "split",
  "particle-clash",
  "scoreboard",
  "duel",
  "ribbon",
  "odds",
] as const;
export const SCHEDULE_LAYOUTS = [
  "glass",
  "direct",
  "bold",
  "agenda",
  "timeline",
  "calendar",
  "roadmap",
  "spotlight",
] as const;

const LABELS: Record<string, Record<string, readonly [string, string]>> = {
  goal: {
    classic: ["Classic progress", "التقدم الكلاسيكي"],
    compact: ["Vertical compact", "عمودي مختصر"],
    bold: ["Milestone Summit", "قمم الإنجاز"],
    glass: ["Glass strip", "شريط زجاجي"],
    ring: ["Goal Mosaic", "فسيفساء الهدف"],
    segments: ["Floating segments", "مقاطع عائمة"],
    scoreboard: ["Goal scoreboard", "لوحة أرقام الهدف"],
    cinema: ["Cinematic horizon", "أفق سينمائي"],
  },
  viewer: {
    digits: ["Numbers only", "أرقام فقط"],
    island: ["Audience capsule", "كبسولة الجمهور"],
    live: ["Live Transmission", "لوحة الإرسال"],
    digital: ["Audience Type", "حضور بارز"],
    bar: ["Audience Ledger", "سجل الجمهور"],
    "lower-third": ["Audience Ticket", "تذكرة الجمهور"],
    hud: ["Orbital Capsule", "كبسولة المدار"],
    ambient: ["Ambient audience", "هالة الجمهور"],
  },
  wheel: {
    classic: ["Full circle", "دائرة كاملة"],
    compact: ["Prize Dock", "رصيف الجوائز"],
    bare: ["Floating Prize Rail", "مسار الجوائز العائم"],
    show: ["Game Show Totem", "برج المسابقات"],
    bottom: ["Bottom wheel", "عجلة سفلية"],
    studio: ["Grand Prize Board", "لوحة الجوائز الكبرى"],
    spotlight: ["Winner Podium", "منصة الفائز"],
    orbit: ["Orbit ring", "حلقة المدار"],
  },
  events: {
    island: ["Title + moving event", "عنوان وحدث متحرك"],
    ticker: ["Horizontal ticker", "شريط متحرك أفقي"],
    timeline: ["Event Constellation", "كوكبة الأحداث"],
    stack: ["Featured Moment", "لحظة مميزة"],
    cycle: ["Latest event — text only", "آخر حدث — نص فقط"],
    floating: ["Floating Dispatches", "إشعارات عائمة"],
    spotlight: ["Broadcast Ledger", "دفتر البث"],
    ribbon: ["Cinema Event Strip", "شريط الأحداث السينمائي"],
  },
  chrome: {
    glass: ["Sender Portrait", "بصمة المرسل"],
    direct: ["Corner Dispatch", "إشعار الزاوية"],
    bold: ["Editorial Quote", "اقتباس تحريري"],
    "lower-third": ["Broadcast Subtitle", "ترجمة البث"],
    message: ["Floating Conversation", "محادثة عائمة"],
    pill: ["Notification pill", "كبسولة الإشعار"],
    split: ["Featured Column", "عمود مميز"],
    featured: ["Featured message", "رسالة مميزة"],
  },
  poll: {
    default: ["Classic poll", "استطلاع كلاسيكي"],
    compact: ["Compact list", "قائمة مختصرة"],
    cards: ["Vote Mosaic", "فسيفساء الأصوات"],
    columns: ["Broadcast Podium", "منصة التصويت"],
    ballot: ["Floating Ballots", "أوراق عائمة"],
    leaderboard: ["Typography Standings", "ترتيب بالأرقام"],
    donut: ["Vote Spectrum", "طيف الأصوات"],
    split: ["Versus Lanes", "مسارات المنافسة"],
  },
  prediction: {
    classic: ["Match Scoreboard", "لوحة المباراة"],
    compact: ["Compact prediction", "توقع مختصر"],
    split: ["Cinematic VS", "مواجهة سينمائية"],
    "particle-clash": ["Particle Clash", "صراع الدوائر"],
    scoreboard: ["Scoreboard", "لوحة النتائج"],
    duel: ["Contender Panels", "لوحات المتنافسين"],
    ribbon: ["Prediction ribbon", "شريط التوقع"],
    odds: ["Odds Exchange", "بورصة التوقعات"],
  },
  schedule: {
    direct: ["Clean live", "مباشر وبسيط"],
    agenda: ["TV Program Guide", "دليل برامج البث"],
    glass: ["Stream card list", "قائمة بطاقات البث"],
    bold: ["Program Chapters", "فصول البث"],
    timeline: ["Horizontal timeline", "خط زمني أفقي"],
    calendar: ["Running Order Cards", "بطاقات تسلسل البث"],
    roadmap: ["Vertical Time Rail", "مسار زمني عمودي"],
    spotlight: ["Next Feature", "الفقرة التالية"],
  },
};

export function widgetLayoutLabel(family: string, id: string, lang: "ar" | "en"): string {
  return LABELS[family]?.[id]?.[lang === "ar" ? 1 : 0] ?? id;
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

function pick<T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T {
  const value = asRecord(raw)["layout"];
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** Missing layout stays classic so overlays already on stream do not jump. */
export function parseGoalLayout(raw: unknown): GoalLayout {
  return pick(raw, GOAL_LAYOUTS, "classic");
}

export function parseWheelLayout(raw: unknown): WheelLayout {
  const value = asRecord(raw)["layout"];
  if (value === "glow") return "classic";
  return pick(raw, WHEEL_LAYOUTS, "classic");
}

/** Glass single-line overlays become the Dynamic Island. */
export function parseEventLabelLayout(raw: unknown): EventLabelLayout {
  const value = asRecord(raw)["layout"];
  if (value === "glass") return "island";
  return pick(raw, EVENT_LABEL_LAYOUTS, "island");
}

export function parseChromeLayout(raw: unknown): ChromeLayout {
  return pick(raw, CHROME_LAYOUTS, "glass");
}

export function parseViewerLayout(raw: unknown): ViewerLayout {
  const value = asRecord(raw)["layout"];
  if (value === "glass") return "island";
  if (value === "bold") return "bar";
  if (value === "direct") return "digits";
  return pick(raw, VIEWER_LAYOUTS, "island");
}

export function chromeLayoutClass(layout: ChromeLayout): string {
  if (layout === "direct")
    return "border border-zinc-700 bg-zinc-950 shadow-none backdrop-blur-none";
  if (layout === "bold") return "border-2 border-white/25 shadow-[0_18px_50px_rgba(0,0,0,0.45)]";
  return "";
}
