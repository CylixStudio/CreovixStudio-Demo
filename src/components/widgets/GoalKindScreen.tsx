import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { WidgetRenderer } from "@/components/widgets/WidgetRenderer";
import { useWidgetStream } from "@/hooks/useWidgetStream";
import { SessionAwareError } from "@/components/widgets/SessionAwareError";
import { useWidgets } from "@/hooks/useWidgets";
import { useWorkspace } from "@/hooks/useWorkspace";
import { notePlanError } from "@/components/subscription/upgradePlan";
import { createWidget, widgetErrorText } from "@/lib/createWidget";
import { saveWidgetSettingsLocal as saveWidgetSettings } from "@/lib/widgetSave";
import { useLanguage } from "@/lib/i18n";
import type { StandaloneTool } from "@/lib/standaloneTools";
import { SIGNED_OUT_ERROR } from "@/lib/supabase/sessionError";
import { isTestMode } from "@/lib/testMode";
import { isSplitGoalKind, parseSplitGoalConfig, type SplitGoalKind } from "@/lib/widgets";
import { parseGoalLayout } from "@/lib/widgetLayouts";
import { StandaloneWidgetFields } from "@/components/widgets/StandaloneWidgetFields";
import { TestSimulatePanel } from "@/components/widgets/TestSimulatePanel";
import { DemoLayoutPlanSwitch } from "@/components/widgets/DemoLayoutPlanSwitch";

function initialConfig(kind: SplitGoalKind, raw: unknown): Record<string, unknown> {
  const stored =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return { ...stored, ...parseSplitGoalConfig(kind, raw), layout: parseGoalLayout(raw) };
}

export function GoalKindScreen({ spec, userId }: { spec: StandaloneTool; userId: string }) {
  const kind = spec.type;
  if (!isSplitGoalKind(kind)) return null;
  return <GoalKindForm spec={spec} userId={userId} kind={kind} />;
}

function GoalKindForm({
  spec,
  userId,
  kind,
}: {
  spec: StandaloneTool;
  userId: string;
  kind: SplitGoalKind;
}) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const widgets = useWidgets();
  const workspace = useWorkspace(userId);
  const existing = widgets.data?.widgets.find((widget) => widget.type === kind) ?? null;
  const [draft, setDraft] = useState<Record<string, unknown>>(() =>
    initialConfig(kind, existing?.config),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const stream = useWidgetStream(existing?.public_token ?? null);

  useEffect(() => {
    if (!existing || hydratedId === existing.id) return;
    setDraft(initialConfig(kind, existing.config));
    setHydratedId(existing.id);
  }, [existing, hydratedId, kind]);

  const set = (key: string, value: unknown) => setDraft((prev) => ({ ...prev, [key]: value }));
  const parsed = parseSplitGoalConfig(kind, draft);
  const config = { ...draft, ...parsed, layout: parseGoalLayout(draft) };
  const title = parsed.title;
  const save = async () => {
    if (isTestMode()) {
      setError(SIGNED_OUT_ERROR);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let widgetId = existing?.id;
      if (!widgetId) {
        const created = await createWidget({
          userId,
          subathonId: workspace.data?.subathons[0]?.id ?? null,
          type: kind,
          name: spec.name,
        });
        widgetId = created.id;
      }
      await saveWidgetSettings({
        data: { widgetId, name: title.trim() || spec.name, config },
      });
      await queryClient.invalidateQueries({ queryKey: ["widgets"] });
      await navigate({ to: "/widgets" });
    } catch (err) {
      if (!notePlanError(err)) setError(widgetErrorText(err, t("goal.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_1fr]">
      <form
        className="surface-card surface-card-pad space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <SessionAwareError error={error} signedOutLabel={t("tools.signedOut")} />
        <DemoLayoutPlanSwitch userId={userId} />
        <StandaloneWidgetFields type={kind} config={draft} set={set}
          testPanel={existing ? <TestSimulatePanel widgetId={existing.id} widgetType={kind} config={draft} /> : undefined} />
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-muted-foreground"
            onClick={() => void navigate({ to: "/widgets" })}
          >
            {t("goal.cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {existing ? t("goal.save") : t("goal.create")}
          </button>
        </div>
      </form>
      <div className="grid min-h-[240px] place-items-center rounded-2xl border border-white/10 bg-[repeating-conic-gradient(#16171d_0%_25%,#101116_0%_50%)] bg-[length:32px_32px] p-6">
        <WidgetRenderer
          type={kind}
          config={config}
          frame={null}
          remaining={0}
          goal={null}
          events={stream.events}
          spin={null}
        />
      </div>
    </div>
  );
}
