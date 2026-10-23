import { loadDemoState, saveDemoWidget } from "@/lib/demoStore";

type SaveInput = {
  widgetId: string;
  name?: string;
  config: Record<string, unknown>;
  goal?: { id: string; title: string; unit: string; target: number; current: number } | null;
};

/** Demo build: widget settings are saved in the visitor's browser, never on the server. */
export async function saveWidgetSettingsLocal({ data }: { data: SaveInput }): Promise<{ ok: true }> {
  const state = await loadDemoState();
  const widget = state.widgets.find((entry) => entry.id === data.widgetId);
  if (!widget) throw new Error("Widget not found");
  await saveDemoWidget({
    widgetId: data.widgetId,
    name: data.name?.trim() || widget.name,
    config: data.config,
    ...(data.goal !== undefined ? { goal: data.goal } : {}),
  });
  return { ok: true };
}
