import { isDemoBuild } from "@/lib/demoMode";
import type { DemoFrame } from "@/lib/demoState";
import { updateDemoState } from "@/lib/demoStore";
import type { TimerFrame } from "@/lib/timer";

/** In the demo the preview and overlay read the local frame store, so server timer changes are mirrored there. */
export function publishDemoTimerFrame(widgetId: string, frame: TimerFrame) {
  if (!isDemoBuild()) return;
  void updateDemoState((state) => ({
    ...state,
    frames: { ...state.frames, [widgetId]: frame as unknown as DemoFrame },
  }));
}
