import fs from "node:fs";
import path from "node:path";

import { demoRevisionGate } from "@/lib/demoRevision";
import { emptyDemoFile, normalizeDemoFile, type DemoFile } from "@/lib/demoState";

const filePath = path.join(process.cwd(), ".demo-data", "state.json");

let chain: Promise<unknown> = Promise.resolve();

export function readDemoFile(): DemoFile {
  try {
    return normalizeDemoFile(JSON.parse(fs.readFileSync(filePath, "utf8")));
  } catch {
    return emptyDemoFile();
  }
}

export function demoStateRevision(): number {
  return demoRevisionGate.current();
}

export function waitForDemoState(since: number, signal: AbortSignal, timeoutMs = 20_000): Promise<number> {
  return demoRevisionGate.wait(since, signal, timeoutMs);
}

export function writeDemoFile(state: DemoFile): DemoFile {
  const next = normalizeDemoFile(state);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(next));
  demoRevisionGate.bump();
  return next;
}

export function updateDemoFile(mutator: (state: DemoFile) => DemoFile): Promise<DemoFile> {
  const run = chain.then(() => writeDemoFile(mutator(readDemoFile())));
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function saveDemoWidgetSettings(data: {
  widgetId: string;
  name?: string;
  config: Record<string, unknown>;
  goal?: { id: string; title: string; unit: string; target: number; current: number } | null;
}): Promise<{ ok: true }> {
  const saved = await updateDemoFile((state) => ({
    ...state,
    widgets: state.widgets.map((widget) =>
      widget.id === data.widgetId
        ? {
            ...widget,
            name: data.name?.trim() || widget.name,
            config: data.config,
          }
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
  }));
  if (!saved.widgets.some((widget) => widget.id === data.widgetId)) {
    throw new Error("Widget not found");
  }
  return { ok: true as const };
}
