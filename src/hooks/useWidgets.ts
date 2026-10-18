import { useQuery } from "@tanstack/react-query";

import { isDemoBuild } from "@/lib/demoMode";
import { loadDemoState } from "@/lib/demoStore";
import { supabase } from "@/lib/supabase/client";
import type { WidgetType } from "@/lib/widgets";
import { isTestMode } from "@/lib/testMode";

export type WidgetRow = {
  id: string;
  name: string;
  type: WidgetType;
  config: unknown;
  state: unknown;
  subathon_id: string | null;
  public_token: string;
  is_enabled: boolean;
  created_at: string;
};

export type GoalRow = {
  id: string;
  widget_id: string;
  title: string;
  unit: string;
  target_value: number;
  current_value: number;
};

export function useWidgets() {
  return useQuery({
    queryKey: ["widgets"],
    queryFn: async () => {
      if (isDemoBuild()) {
        const state = await loadDemoState();
        return {
          widgets: state.widgets as WidgetRow[],
          goals: state.goals.map((goal) => ({
            ...goal,
            target_value: Number(goal.target_value),
            current_value: Number(goal.current_value),
          })) as GoalRow[],
        };
      }
      if (isTestMode()) return { widgets: [] as WidgetRow[], goals: [] as GoalRow[] };
      const [widgets, goals] = await Promise.all([
        supabase
          .from("widgets")
          .select("id, name, type, config, state, subathon_id, public_token, is_enabled, created_at")
          .order("created_at", { ascending: true }),
        supabase.from("goals").select("id, widget_id, title, unit, target_value, current_value"),
      ]);
      if (widgets.error) throw widgets.error;
      if (goals.error) throw goals.error;
      return {
        widgets: (widgets.data ?? []) as WidgetRow[],
        goals: (goals.data ?? []).map((goal) => ({
          ...goal,
          target_value: Number(goal.target_value),
          current_value: Number(goal.current_value),
        })) as GoalRow[],
      };
    },
  });
}
