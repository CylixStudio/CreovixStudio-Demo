/** Saved layout IDs are shared by the editor, draw persistence, and OBS source. */
export const GIVEAWAY_LAYOUTS = [
  {
    value: "glass",
    en: "Glass",
    ar: "زجاجي",
    hintEn: "A calm floating gallery",
    hintAr: "معرض هادئ وعائم",
  },
  {
    value: "direct",
    en: "Direct",
    ar: "مباشر",
    hintEn: "Clean participant rows",
    hintAr: "صفوف مشاركين واضحة",
  },
  {
    value: "bold",
    en: "Bold",
    ar: "بارز",
    hintEn: "A graphic winner headline",
    hintAr: "عنوان فائز بارز",
  },
  {
    value: "spotlight",
    en: "Spotlight",
    ar: "الأضواء",
    hintEn: "A focused circular stage",
    hintAr: "منصة دائرية مركّزة",
  },
  {
    value: "podium",
    en: "Podium",
    ar: "المنصة",
    hintEn: "An elevated winner pedestal",
    hintAr: "منصة مرتفعة للفائز",
  },
  {
    value: "ticket",
    en: "Ticket",
    ar: "التذكرة",
    hintEn: "A prize ticket with a claim stub",
    hintAr: "تذكرة جائزة مع قسم للتأكيد",
  },
  {
    value: "split",
    en: "Split",
    ar: "منقسم",
    hintEn: "Participant rail beside the winner",
    hintAr: "قائمة مشاركين بجانب الفائز",
  },
  {
    value: "ribbon",
    en: "Ribbon",
    ar: "الشريط",
    hintEn: "A broadcast-style lower third",
    hintAr: "شريط بث أفقي",
  },
] as const;

export type GiveawayLayout = (typeof GIVEAWAY_LAYOUTS)[number]["value"];

export function normalizeGiveawayLayout(value: unknown): GiveawayLayout {
  return GIVEAWAY_LAYOUTS.find((layout) => layout.value === value)?.value ?? "glass";
}
