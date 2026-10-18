import type { PermissionKey, SectionId, SectionLevel } from "./types";

/**
 * Permission definitions. Only tools that exist in CylixStudio Demo are listed, and each
 * permission maps to an operation the tool really performs. Alerts are intentionally absent:
 * they stay Admin-only (Early Access) and can never be granted through a team.
 */

type Copy = { ar: string; en: string };

export type PermissionDef = { key: PermissionKey; label: Copy };

export type SectionDef = {
  id: SectionId;
  label: Copy;
  description: Copy;
  permissions: readonly PermissionDef[];
  /** Route prefixes that belong to the section. */
  routes: readonly string[];
};

const p = (section: SectionId, action: string, ar: string, en: string): PermissionDef => ({
  key: `${section}.${action}` as PermissionKey,
  label: { ar, en },
});

export const SECTIONS: readonly SectionDef[] = [
  {
    id: "commands",
    label: { ar: "أوامر الشات", en: "Chat Commands" },
    description: { ar: "الأوامر المخصصة والافتراضية وتنبيهات الشات", en: "Custom and default commands and chat alerts" },
    routes: ["/custom-commands"],
    permissions: [
      p("commands", "view", "عرض", "View"),
      p("commands", "create", "إنشاء", "Create"),
      p("commands", "edit", "تعديل", "Edit"),
      p("commands", "delete", "حذف", "Delete"),
      p("commands", "toggle", "تفعيل / تعطيل", "Enable / Disable"),
    ],
  },
  {
    id: "timers",
    label: { ar: "مؤقتات الرسائل", en: "Message Timers" },
    description: { ar: "الرسائل المتكررة في الشات", en: "Recurring chat messages" },
    routes: ["/custom-commands"],
    permissions: [
      p("timers", "view", "عرض", "View"),
      p("timers", "add", "إضافة", "Add"),
      p("timers", "edit", "تعديل", "Edit"),
      p("timers", "delete", "حذف", "Delete"),
    ],
  },
  {
    id: "points",
    label: { ar: "نقاط الولاء", en: "Loyalty Points" },
    description: { ar: "ترتيب المشاهدين ورصيد النقاط", en: "Viewer ranking and point balances" },
    routes: ["/loyalty"],
    permissions: [
      p("points", "view", "عرض الأرصدة", "View balances"),
      p("points", "add", "إضافة نقاط", "Add points"),
      p("points", "remove", "خصم نقاط / حذف عضو", "Remove points / delete member"),
    ],
  },
  {
    id: "shop",
    label: { ar: "متجر الولاء", en: "Loyalty Shop" },
    description: { ar: "المنتجات وسجل المبيعات", en: "Products and the sales log" },
    routes: ["/loyalty"],
    permissions: [
      p("shop", "view", "عرض المنتجات والمبيعات", "View products & sales"),
      p("shop", "add", "إضافة منتجات", "Add products"),
      p("shop", "edit", "تعديل المنتجات", "Edit products"),
      p("shop", "delete", "حذف المنتجات", "Delete products"),
    ],
  },
  {
    id: "marks",
    label: { ar: "نقاط العلامات", en: "Mark Points" },
    description: { ar: "لحظات البث المميزة", en: "Highlighted stream moments" },
    routes: ["/mark-points"],
    permissions: [
      p("marks", "view", "عرض", "View"),
      p("marks", "add", "إضافة", "Add"),
      p("marks", "edit", "تعديل / اعتماد", "Edit / approve"),
      p("marks", "delete", "حذف", "Delete"),
    ],
  },
  {
    id: "activity",
    label: { ar: "سجل النشاط", en: "Activity Feed" },
    description: { ar: "أحداث البث السابقة", en: "Past stream events" },
    routes: ["/activity-feed"],
    permissions: [p("activity", "view", "عرض السجل", "View history")],
  },
  {
    id: "widgets",
    label: { ar: "الويدجتات", en: "Widgets" },
    description: { ar: "العدادات والأهداف والمؤقتات وأوفرلاي OBS", en: "Counters, goals, timers and OBS overlays" },
    routes: ["/live-counter", "/widgets", "/subathons", "/tools", "/giveaway", "/media-requests"],
    permissions: [
      p("widgets", "view", "عرض", "View"),
      p("widgets", "edit", "تعديل الإعدادات", "Edit settings"),
      p("widgets", "test", "اختبار الأحداث", "Run tests"),
    ],
  },
  {
    id: "schedule",
    label: { ar: "الجدول", en: "Schedule" },
    description: { ar: "جدول البث الأسبوعي", en: "Weekly stream schedule" },
    routes: ["/schedule"],
    permissions: [
      p("schedule", "view", "عرض", "View"),
      p("schedule", "create", "إنشاء", "Create"),
      p("schedule", "edit", "تعديل", "Edit"),
      p("schedule", "delete", "حذف", "Delete"),
    ],
  },
  {
    id: "bio",
    label: { ar: "رابط البايو", en: "Link in Bio" },
    description: { ar: "الصفحة العامة للروابط", en: "Public links page" },
    routes: ["/link-in-bio"],
    permissions: [
      p("bio", "view", "عرض", "View"),
      p("bio", "links", "تعديل الروابط", "Edit links"),
      p("bio", "appearance", "تعديل المظهر", "Edit appearance"),
    ],
  },
  {
    id: "analytics",
    label: { ar: "التحليلات", en: "Analytics" },
    description: { ar: "إحصائيات القناة", en: "Channel statistics" },
    routes: ["/analytics"],
    permissions: [p("analytics", "view", "عرض", "View")],
  },
];

export const SECTION_BY_ID: Record<SectionId, SectionDef> = Object.fromEntries(
  SECTIONS.map((section) => [section.id, section]),
) as Record<SectionId, SectionDef>;

export const ALL_KEYS: readonly PermissionKey[] = SECTIONS.flatMap((section) => section.permissions.map((perm) => perm.key));

const KEY_SET = new Set<string>(ALL_KEYS);

export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === "string" && KEY_SET.has(value);
}

export function sectionOfKey(key: PermissionKey): SectionId {
  return key.split(".")[0] as SectionId;
}

export function viewKeyOf(section: SectionId): PermissionKey {
  return `${section}.view` as PermissionKey;
}

export function sectionKeys(section: SectionId): PermissionKey[] {
  return SECTION_BY_ID[section].permissions.map((perm) => perm.key);
}

/** Drops unknown keys and makes sure any granted action also grants the section's view key. */
export function normalizeKeys(keys: readonly string[]): PermissionKey[] {
  const wanted = new Set(keys.filter(isPermissionKey));
  for (const key of [...wanted]) wanted.add(viewKeyOf(sectionOfKey(key)));
  return ALL_KEYS.filter((key) => wanted.has(key));
}

export function sectionLevel(keys: readonly PermissionKey[], section: SectionId): SectionLevel {
  const held = sectionKeys(section).filter((key) => keys.includes(key));
  if (held.length === 0) return "none";
  const all = sectionKeys(section);
  if (held.length === all.length) return all.length === 1 ? "view" : "manage";
  return held.length === 1 && held[0] === viewKeyOf(section) ? "view" : "custom";
}

export function setSectionLevel(keys: readonly PermissionKey[], section: SectionId, level: "none" | "view" | "manage"): PermissionKey[] {
  const rest = keys.filter((key) => sectionOfKey(key) !== section);
  if (level === "none") return normalizeKeys(rest);
  return normalizeKeys([...rest, ...(level === "view" ? [viewKeyOf(section)] : sectionKeys(section))]);
}

export function setKey(keys: readonly PermissionKey[], key: PermissionKey, on: boolean): PermissionKey[] {
  const section = sectionOfKey(key);
  if (on) return normalizeKeys([...keys, key]);
  if (key === viewKeyOf(section)) return setSectionLevel(keys, section, "none");
  return normalizeKeys(keys.filter((item) => item !== key));
}

export function countGranted(keys: readonly PermissionKey[]): number {
  return keys.length;
}

export function permissionLabel(key: PermissionKey): Copy {
  const section = SECTION_BY_ID[sectionOfKey(key)];
  return section.permissions.find((perm) => perm.key === key)?.label ?? { ar: key, en: key };
}

/** Shows the label of the first route-matching section, or null for always-open pages. */
export function sectionsForPath(pathname: string): SectionId[] {
  const hit = SECTIONS.filter((section) => section.routes.some((route) => pathname === route || pathname.startsWith(`${route}/`)));
  return hit.map((section) => section.id);
}

/** Pages only the channel owner can open. */
export const OWNER_ONLY_ROUTES = ["/channel-team", "/subscription"] as const;

/** Alerts stay Admin-only Early Access: a team membership never unlocks them. */
export const ALERTS_ROUTE = "/alerts";

export function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export const PRESETS: ReadonlyArray<{ id: string; label: Copy; keys: readonly PermissionKey[] }> = [
  {
    id: "viewer",
    label: { ar: "مشاهدة فقط", en: "View only" },
    keys: SECTIONS.map((section) => viewKeyOf(section.id)),
  },
  {
    id: "chat-mod",
    label: { ar: "مود الشات", en: "Chat moderator" },
    keys: [...sectionKeys("commands"), ...sectionKeys("timers"), viewKeyOf("activity")],
  },
  {
    id: "community",
    label: { ar: "مدير المجتمع", en: "Community manager" },
    keys: [...sectionKeys("points"), ...sectionKeys("shop"), ...sectionKeys("marks"), viewKeyOf("activity")],
  },
  {
    id: "full",
    label: { ar: "كل الأدوات", en: "All tools" },
    keys: ALL_KEYS,
  },
];
