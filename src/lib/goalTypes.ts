/**
 * Goal presets powering the unified "Custom goal" widget. Each preset drives
 * the goal row defaults (title/unit/target), the widget config (label + accent)
 * and the OBS browser-source query parameters.
 */

export type GoalTypeId = "DONATION" | "FOLLOWER" | "SUBSCRIBER" | "CUSTOM";

export type GoalTypePreset = {
  id: GoalTypeId;
  emoji: string;
  labelEn: string;
    /** Default overlay label. */
  overlayLabel: string;
  /** Goal row title. */
  title: string;
  unit: string;
  target: number;
  /** Sample current value used only for the miniature preview. */
  previewCurrent: number;
  accentColor: string;
  /** Event types that increment this goal. */
  triggers: string[];
};

export const GOAL_TYPES: GoalTypePreset[] = [
  {
    id: "DONATION",
    emoji: "💰",
    labelEn: "Donation goal",
    overlayLabel: "DONATION GOAL",
    title: "Donation goal",
    unit: "USD",
    target: 500,
    previewCurrent: 360,
    accentColor: "#7C3AED",
    triggers: ["DONATION", "BITS"],
  },
  {
    id: "FOLLOWER",
    emoji: "👤",
    labelEn: "Follower goal",
    overlayLabel: "FOLLOWER GOAL",
    title: "Follower goal",
    unit: "followers",
    target: 1000,
    previewCurrent: 850,
    accentColor: "#22D3EE",
    triggers: ["FOLLOW"],
  },
  {
    id: "SUBSCRIBER",
    emoji: "⭐",
    labelEn: "Subscriber goal",
    overlayLabel: "SUB GOAL",
    title: "Subscriber goal",
    unit: "subs",
    target: 50,
    previewCurrent: 42,
    accentColor: "#F59E0B",
    triggers: ["SUBSCRIPTION", "GIFT_SUB"],
  },
  {
    id: "CUSTOM",
    emoji: "🎯",
    labelEn: "Custom goal",
    overlayLabel: "CUSTOM GOAL",
    title: "Custom goal",
    unit: "points",
    target: 100,
    previewCurrent: 46,
    accentColor: "#34D399",
    triggers: ["MANUAL"],
  },
];

export const DEFAULT_GOAL_TYPE: GoalTypeId = "DONATION";

export function goalTypePreset(id: string | null | undefined): GoalTypePreset {
  return (
    GOAL_TYPES.find((preset) => preset.id === id) ??
    GOAL_TYPES.find((preset) => preset.id === DEFAULT_GOAL_TYPE)!
  );
}

/** Query string appended to the OBS browser source URL for a goal widget. */
export function goalOverlayParams(id: GoalTypeId) {
  const preset = goalTypePreset(id);
  return `?goal=${preset.id.toLowerCase()}&unit=${encodeURIComponent(preset.unit)}`;
}
