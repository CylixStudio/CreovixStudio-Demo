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
    bold: ["Bold progress", "تقدم عريض"],
    glass: ["Glass strip", "شريط زجاجي"],
    ring: ["Circular progress", "تقدم دائري"],
    segments: ["Floating segments", "مقاطع عائمة"],
    scoreboard: ["Goal scoreboard", "لوحة أرقام الهدف"],
    cinema: ["Cinematic horizon", "أفق سينمائي"],
  },
  viewer: {
    digits: ["Numbers only", "أرقام فقط"],
    island: ["Audience capsule", "كبسولة الجمهور"],
    live: ["Broadcast badge", "شارة البث"],
    digital: ["Slot counter", "عداد الخانات"],
    bar: ["Audience rail", "مسار الجمهور"],
    "lower-third": ["Studio lower third", "شريط الاستوديو"],
    hud: ["Precision HUD", "واجهة القياس"],
    ambient: ["Ambient audience", "هالة الجمهور"],
  },
  wheel: {
    classic: ["Full circle", "دائرة كاملة"],
    compact: ["Pocket wheel", "عجلة صغيرة"],
    bare: ["Minimal premium", "بساطة فاخرة"],
    show: ["Show stage", "منصة العرض"],
    bottom: ["Bottom wheel", "عجلة سفلية"],
    studio: ["Studio backdrop", "خلفية الاستوديو"],
    spotlight: ["Center spotlight", "بؤرة المنتصف"],
    orbit: ["Orbit ring", "حلقة المدار"],
  },
  events: {
    island: ["Title + moving event", "عنوان وحدث متحرك"],
    ticker: ["Horizontal ticker", "شريط متحرك أفقي"],
    timeline: ["Event timeline", "خط زمني للأحداث"],
    stack: ["Live event stack", "حزمة الأحداث"],
    cycle: ["Spotlight last event", "آخر حدث مميز"],
    floating: ["Cards carousel", "دوار البطاقات"],
    spotlight: ["Editorial feed", "سجل أنيق"],
    ribbon: ["Broadcast ribbon", "شريط البث"],
  },
  chrome: {
    glass: ["Floating note", "ملاحظة عائمة"],
    direct: ["Minimal top strip", "شريط علوي مختصر"],
    bold: ["Broadcast panel", "لوحة البث"],
    "lower-third": ["Bottom bar", "شريط سفلي"],
    message: ["Pinned chat bubble", "فقاعة رسالة مثبتة"],
    pill: ["Notification pill", "كبسولة الإشعار"],
    split: ["Split label card", "بطاقة العنوان المنقسم"],
    featured: ["Featured message", "رسالة مميزة"],
  },
  poll: {
    default: ["Classic poll", "استطلاع كلاسيكي"],
    compact: ["Compact list", "قائمة مختصرة"],
    cards: ["Result cards", "بطاقات النتائج"],
    columns: ["Voting columns", "أعمدة التصويت"],
    ballot: ["Ballot tickets", "بطاقات الاقتراع"],
    leaderboard: ["Ranked results", "ترتيب النتائج"],
    donut: ["Vote ring", "حلقة التصويت"],
    split: ["Split stage", "منصة منقسمة"],
  },
  prediction: {
    classic: ["Classic prediction", "توقع كلاسيكي"],
    compact: ["Compact prediction", "توقع مختصر"],
    split: ["Split matchup", "مواجهة منقسمة"],
    "particle-clash": ["Particle Clash", "صراع الدوائر"],
    scoreboard: ["Scoreboard", "لوحة النتائج"],
    duel: ["Duel arena", "ساحة المواجهة"],
    ribbon: ["Prediction ribbon", "شريط التوقع"],
    odds: ["Outcome ledger", "سجل الخيارات"],
  },
  schedule: {
    direct: ["Clean live", "مباشر وبسيط"],
    agenda: ["Compact agenda", "أجندة مختصرة"],
    glass: ["Stream card list", "قائمة بطاقات البث"],
    bold: ["Dual-day board", "لوحة اليومين"],
    timeline: ["Horizontal timeline", "خط زمني أفقي"],
    calendar: ["Calendar strip", "شريط التقويم"],
    roadmap: ["Premium roadmap", "خارطة البث"],
    spotlight: ["Upcoming spotlight", "الفعالية القادمة"],
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
