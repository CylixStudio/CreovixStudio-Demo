import { updateDemoState } from "@/lib/demoStore";

type SaveInput = {
  widgetId: string;
  name?: string;
  config: Record<string, unknown>;
  goal?: { id: string; title: string; unit: string; target: number; current: number } | null;
};

/** Demo build: widget settings are saved in the visitor's browser, never on the server. */
export async function saveWidgetSettingsLocal({ data }: { data: SaveInput }): Promise<{ ok: true }> {
  let found = false;
  await updateDemoState((state) => {
    found = state.widgets.some((widget) => widget.id === data.widgetId);
    return {
      ...state,
      widgets: state.widgets.map((widget) =>
        widget.id === data.widgetId
          ? { ...widget, name: data.name?.trim() || widget.name, config: data.config }
          : widget,
      ),
      goals: data.goal
        ? state.goals.map((goal) =>
            goal.id === data.goal?.id
              ? {
                  ...goal,
                  title: data.goal.title,
                  unit: data.goal.unit,
                  target_value: data.goal.target,
                  current_value: data.goal.current,
                }
              : goal,
          )
        : state.goals,
    };
  });
  if (!found) throw new Error("Widget not found");
  return { ok: true };
}
