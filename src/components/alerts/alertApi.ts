import type {
  AlertConfig,
  AlertKind,
  AlertPlatform,
  AlertSimulation,
  AlertStudioState,
} from "@/lib/alertStudio";

export const alertStudioKey = ["demo-alert-studio"] as const;

export async function loadAlertStudio(): Promise<AlertStudioState> {
  const response = await fetch("/api/demo/alert-studio", { cache: "no-store" });
  if (!response.ok) throw new Error("alerts.loadFail");
  return response.json() as Promise<AlertStudioState>;
}

export async function saveAlertStudio(body: {
  plan?: AlertStudioState["plan"];
  alerts?: Partial<Record<AlertPlatform, Partial<Record<AlertKind, AlertConfig>>>>;
  simulation?: AlertSimulation;
}): Promise<AlertStudioState> {
  const response = await fetch("/api/demo/alert-studio", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as AlertStudioState & { message?: string };
  if (!response.ok) throw new Error("alerts.saveFail");
  return payload;
}

export function overlayUrl(origin: string, token: string): string {
  return `${origin}/overlay/demo-alerts/${token}`;
}

export function dockUrl(origin: string, token: string): string {
  return `${origin}/activity-feed/dock/${token}`;
}
