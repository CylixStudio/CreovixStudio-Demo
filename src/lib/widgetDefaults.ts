import { DEFAULT_OVERLAY_THEME } from "@/lib/overlayTheme";
import { goalTypePreset, type GoalTypeId } from "@/lib/goalTypes";
import {
  DEFAULT_STYLE,
  parseChatConfig,
  parseGoalConfig,
  parseEmoteRainConfig,
  parseSpinConfig,
  parseSpotlightConfig,
  parseStreamEventsScheduleConfig,
  parseTappersConfig,
  parseTapGoalConfig,
  parseKicksGoalConfig,
  parseViewerCounterConfig,
  parseEventLabelsConfig,
  parseSplitGoalConfig,
  parsePollConfig,
  parsePredictionConfig,
  type WidgetType,
} from "@/lib/widgets";

export function defaultConfig(type: WidgetType, goalType?: GoalTypeId): Record<string, unknown> {
  switch (type) {
    case "SUBATHON_TIMER":
      return { ...DEFAULT_OVERLAY_THEME };
    case "CHAT_BOX":
      return { ...parseChatConfig(null) };
    case "GOAL_BAR": {
      const preset = goalTypePreset(goalType);
      return {
        ...parseGoalConfig(null),
        goalType: preset.id,
        label: preset.overlayLabel,
        accentColor: preset.accentColor,
      };
    }
    case "SPIN_WHEEL":
      return { ...parseSpinConfig(null) };
    case "EMOTE_RAIN":
      return { ...parseEmoteRainConfig(null) };
    case "CHAT_SPOTLIGHT":
      return { ...parseSpotlightConfig(null) };
    case "STREAM_EVENTS_SCHEDULE":
      return { ...parseStreamEventsScheduleConfig(null) };
    case "TIKTOK_TAPPERS":
      return { ...parseTappersConfig(null) };
    case "TIKTOK_TAP_GOAL":
      return { ...parseTapGoalConfig(null) };
    case "KICKS_GOAL":
      return { ...parseKicksGoalConfig(null) };
    case "VIEWER_COUNTER":
      return { ...parseViewerCounterConfig(null) };
    case "EVENT_LABELS":
      return { ...parseEventLabelsConfig(null) };
    case "DONATION_GOAL":
      return { ...parseSplitGoalConfig("DONATION_GOAL", null) };
    case "FOLLOWER_GOAL":
      return { ...parseSplitGoalConfig("FOLLOWER_GOAL", null) };
    case "SUBSCRIBER_GOAL":
      return { ...parseSplitGoalConfig("SUBSCRIBER_GOAL", null) };
    case "CUSTOM_GOAL":
      return { ...parseSplitGoalConfig("CUSTOM_GOAL", null) };
    case "POLL":
      return { ...parsePollConfig(null) };
    case "PREDICTION":
      return { ...parsePredictionConfig(null) };
    default:
      return { ...DEFAULT_STYLE };
  }
}
