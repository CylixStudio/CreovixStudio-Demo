import { BuilderCard, BuilderTabs, LayoutCards, RangeField } from "@/components/widgets/builderUi";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { DeleteWidgetDialog } from "@/components/widgets/DeleteWidgetDialog";
import { StandaloneWidgetFields } from "@/components/widgets/StandaloneWidgetFields";
import { LayoutPicker } from "@/components/widgets/LayoutPicker";
import { TestSimulatePanel } from "@/components/widgets/TestSimulatePanel";
import { WidgetRenderer } from "@/components/widgets/WidgetRenderer";
import { wheelSpinLockMs } from "@/components/widgets/SpinWheel";
import { SubathonElementControlPanel } from "@/components/widgets/SubathonElementControlPanel";
import { SubathonTimerSidebar } from "@/components/widgets/SubathonTimerSidebar";
import { SpotlightControlPanel } from "@/components/widgets/SpotlightControlPanel";
import { StreamEventsScheduleControlPanel } from "@/components/widgets/StreamEventsScheduleControlPanel";
import { PollControlPanel } from "@/components/widgets/PollControlPanel";
import { PredictionControlPanel } from "@/components/widgets/PredictionControlPanel";
import { PredictionParticleSettings } from "@/components/widgets/PredictionParticleSettings";
import { PredictionParticleTest } from "@/components/widgets/PredictionParticleTest";
import { parsePredictionConfig } from "@/lib/widgets";
import { parsePollRuntime, parsePredictionRuntime } from "@/lib/interactiveWidgets";
import { isDynamicGoalWidget, isSplitGoalKind, parseSpotlightConfig, parseStreamEventsScheduleState } from "@/lib/widgets";
import { STANDALONE_TOOLS } from "@/lib/standaloneTools";
import { supabase } from "@/lib/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { syncGoalFollowers } from "@/lib/goals.functions";
import { notePlanError, requestUpgrade } from "@/components/subscription/upgradePlan";
import { ChatThemePicker } from "@/components/widgets/ChatThemePicker";
import { KickSubscriberBadgesField } from "@/components/widgets/KickSubscriberBadgesField";
import { saveWidgetSettingsLocal as saveWidgetSettings } from "@/lib/widgetSave";
import { useWidgetStream } from "@/hooks/useWidgetStream";
import { useSubscription } from "@/hooks/useSubscription";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  chatUsesRoyalCompact,
  parseRoyalCompactSettings,
  ROYAL_COMPACT_THEME_ID,
  type RoyalCompactSettings,
} from "@/lib/royalCompact";
import { OVERLAY_FONT_STYLESHEET, parseOverlayTheme } from "@/lib/overlayTheme";
import { useLanguage } from "@/lib/i18n";
import { ensureWidgetSubathon, widgetErrorText } from "@/lib/createWidget";
import { isDemoBuild } from "@/lib/demoMode";
import { deleteDemoWidget, loadDemoState, saveDemoWidget, setDemoGoalCurrent, setDemoWidgetState } from "@/lib/demoStore";
import { SIGNED_OUT_ERROR, isMissingViewerSession } from "@/lib/supabase/sessionError";
import { isTestMode } from "@/lib/testMode";
import { parseChromeLayout, CHROME_LAYOUTS } from "@/lib/widgetLayouts";
import { SessionAwareError } from "@/components/widgets/SessionAwareError";
import { widgetOverlayUrl } from "@/lib/widgetOverlayUrl";
import { DarkSelect } from "@/components/ui/dark-select";
import { InfoTip } from "@/components/ui/info-tip";
import {
  CHAT_LAYOUTS,
  WIDGET_LABEL,
  parseChatConfig,
  parseEmoteRainConfig,
  parseGoalConfig,
  parseSpinConfig,
  pickWeightedPrize,
  parseStreamEventsScheduleConfig,
  parseTappersConfig,
  parseTapGoalConfig,
  TAPGOAL_DESIGNS,
  TAPPERS_LAYOUTS,

  TAPPERS_LIMITS,
  type WidgetType,
} from "@/lib/widgets";

type WidgetRecord = {
  id: string;
  name: string;
  type: WidgetType;
  config: Record<string, unknown>;
  state: Record<string, unknown>;
  public_token: string;
  is_enabled: boolean;
  subathon_id: string | null;
};

type GoalRecord = {
  id: string;
  title: string;
  unit: string;
  target_value: number;
  current_value: number;
};

export const Route = createFileRoute("/_authenticated/widgets/$widgetId/")({
  head: () => ({
    meta: [
      { title: "CylixStudio — Widget Builder" },
      {
        name: "description",
        content:
          "Customise fonts, colours, layout and behaviour for your OBS widget with a live preview.",
      },
      { property: "og:title", content: "CylixStudio — Widget Builder" },
      {
        property: "og:description",
        content: "Design your overlay widget and copy its OBS browser-source URL.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: OVERLAY_FONT_STYLESHEET }],
  }),
  component: WidgetBuilder,
});

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
const labelClass = "text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground";

function WidgetBuilder() {
  const { user } = Route.useRouteContext();
  const userId = user?.id ?? "";
  const signedOutViewer = !isDemoBuild() && (userId.length === 0 || isTestMode());
  const { widgetId } = Route.useParams();
  const queryClient = useQueryClient();
  const { t, lang } = useLanguage();
  const { data: workspace } = useWorkspace(userId);
  const subscription = useSubscription(userId);
  const proActive = isDemoBuild() || subscription.data?.isActive === true;
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const widgetQuery = useQuery({
    queryKey: ["widget", widgetId],
    enabled: Boolean(widgetId) && !signedOutViewer,
    queryFn: async () => {
      if (isDemoBuild()) {
        const state = await loadDemoState();
        const found = state.widgets.find((item) => item.id === widgetId);
        if (!found) return null;
        const goal = state.goals.find((item) => item.widget_id === widgetId) ?? null;
        return {
          widget: found as unknown as WidgetRecord,
          goal: goal
            ? ({
                id: goal.id,
                title: goal.title,
                unit: goal.unit,
                target_value: Number(goal.target_value),
                current_value: Number(goal.current_value),
              } as GoalRecord)
            : null,
        };
      }
      try {
      const [widget, goal] = await Promise.all([
        supabase
          .from("widgets")
          .select("id, name, type, config, state, public_token, is_enabled, subathon_id")
          .eq("id", widgetId)
          .single(),
        supabase
          .from("goals")
          .select("id, title, unit, target_value, current_value")
          .eq("widget_id", widgetId)
          .maybeSingle(),
      ]);
      if (widget.error) {
        if (isMissingViewerSession(widget.error)) return null;
        throw widget.error;
      }
      if (!widget.data) return null;
      return {
        widget: widget.data as unknown as WidgetRecord,
        goal: goal.data
          ? ({
              ...goal.data,
              target_value: Number(goal.data.target_value),
              current_value: Number(goal.data.current_value),
            } as GoalRecord)
          : null,
      };
      } catch (caught) {
        if (isMissingViewerSession(caught)) return null;
        throw caught;
      }
    },
  });

  const widget = widgetQuery.data?.widget ?? null;
  const goalRow = widgetQuery.data?.goal ?? null;

  const [name, setName] = useState("");
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [goalDraft, setGoalDraft] = useState({ title: "", unit: "USD", target: 0, current: 0 });
  const [chatPane, setChatPane] = useState<"layout" | "display" | "extra">("display");
  const [tapGoalPane, setTapGoalPane] = useState<"layout" | "display" | "extra">("display");
  const [tappersPane, setTappersPane] = useState<"layout" | "display" | "extra">("display");
  const [emoteRainPane, setEmoteRainPane] = useState<"layout" | "display" | "extra">("display");
  const [spotlightPane, setSpotlightPane] = useState<"layout" | "display" | "extra">("display");
  const [schedulePane, setSchedulePane] = useState<"layout" | "display" | "extra">("display");
  const [pollPane, setPollPane] = useState<"layout" | "display" | "extra">("display");
  const [predictionPane, setPredictionPane] = useState<"layout" | "display" | "extra">("display");
  const subathonSeeded = useRef<string | null>(null);
  const goalHydrated = useRef<string | null>(null);

  useEffect(() => {
    if (!widget) return;
    setName(widget.name);
    setConfig({ ...(widget.config ?? {}) });
    // Hydrate once per widget. A later refetch must not wipe prizes typed in the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget?.id]);

  useEffect(() => {
    if (!goalRow) return;
    if (goalHydrated.current === goalRow.id) {
      setGoalDraft((prev) => ({ ...prev, current: goalRow.current_value }));
      return;
    }
    goalHydrated.current = goalRow.id;
    setGoalDraft({
      title: goalRow.title,
      unit: goalRow.unit,
      target: goalRow.target_value,
      current: goalRow.current_value,
    });
  }, [goalRow?.id, goalRow]);

  useEffect(() => {
    if (!widget || widget.type !== "SUBATHON_TIMER") return;
    if (subathonSeeded.current === widget.id && widget.subathon_id) return;
    let cancelled = false;
    void ensureWidgetSubathon(widget.id, { seedTimer: true })
      .then(() => {
        if (cancelled) return;
        subathonSeeded.current = widget.id;
        if (!widget.subathon_id) {
          void queryClient.invalidateQueries({ queryKey: ["widget", widgetId] });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(widgetErrorText(err, "Could not prepare the subathon timer."));
      });
    return () => {
      cancelled = true;
    };
  }, [queryClient, widget, widgetId]);

  const stream = useWidgetStream(widget?.is_enabled ? (widget?.public_token ?? null) : null);
  const saveWidget = saveWidgetSettings;

  const save = useMutation({
    mutationFn: async () => {
      if (isDemoBuild()) {
        await saveDemoWidget({
          widgetId,
          name: name.trim() || WIDGET_LABEL[widget!.type],
          config,
          goal: goalRow
            ? {
                id: goalRow.id,
                title: goalDraft.title,
                unit: goalDraft.unit,
                target: goalDraft.target,
                current: goalDraft.current,
              }
            : null,
        });
        return;
      }
      await saveWidget({
        data: {
          widgetId,
          name: name.trim() || WIDGET_LABEL[widget!.type],
          config,
          goal: goalRow
            ? {
                id: goalRow.id,
                title: goalDraft.title,
                unit: goalDraft.unit,
                target: goalDraft.target,
                current: goalDraft.current,
              }
            : null,
        },
      });
    },
    onError: (err: Error) => {
      if (notePlanError(err)) return;
      const message = widgetErrorText(err, "Could not save this widget.");
      setError(message);
      if (!isMissingViewerSession(message)) toast.error(message);
    },
    onSuccess: async () => {
      setError(null);
      toast.success("Widget saved");
      await queryClient.invalidateQueries({ queryKey: ["widget", widgetId] });
      await queryClient.invalidateQueries({ queryKey: ["widgets"] });
    },
  });

  const navigate = useNavigate();

  useEffect(() => {
    if (!widget || !isSplitGoalKind(widget.type)) return;
    const spec = STANDALONE_TOOLS.find((tool) => tool.type === widget.type);
    if (!spec) return;
    void navigate({ to: "/tools/$tool", params: { tool: spec.slug }, replace: true });
  }, [navigate, widget]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const remove = useMutation({
    mutationFn: async () => {
      if (isDemoBuild()) {
        await deleteDemoWidget(widgetId);
        return;
      }
      const { error: writeError } = await supabase.from("widgets").delete().eq("id", widgetId);
      if (writeError) throw writeError;
    },
    onError: (err: Error) => {
      setConfirmDelete(false);
      const message = widgetErrorText(err, "Could not delete this widget.");
      setError(message);
      if (!isMissingViewerSession(message)) toast.error(message);
    },
    onSuccess: async () => {
      setConfirmDelete(false);
      await queryClient.invalidateQueries({ queryKey: ["widgets"] });
      navigate({ to: "/dashboard" });
    },
  });

  const runSyncFollowers = useServerFn(syncGoalFollowers);
  const syncFollowers = useMutation({
    mutationFn: async () => runSyncFollowers({ data: { widgetId } }),
    onError: (err: Error) => {
      const message = widgetErrorText(err, "Could not sync followers.");
      setError(message);
      if (!isMissingViewerSession(message)) toast.error(message);
    },
    onSuccess: async (result) => {
      setError(null);
      if ("total" in result && typeof result.total === "number") {
        setGoalDraft((prev) => ({ ...prev, current: result.total }));
      }
      await queryClient.invalidateQueries({ queryKey: ["widget", widgetId] });
    },
  });

  const spinPrizes = useMemo(() => parseSpinConfig(config).prizes, [config]);
  const [wheelTurning, setWheelTurning] = useState(false);
  const wheelTimer = useRef<number | null>(null);

  const spin = useMutation({
    mutationFn: async () => {
      const result = pickWeightedPrize(spinPrizes);
      if (!result) return null;
      const nonce = Date.now();
      if (isDemoBuild()) {
        await setDemoWidgetState(widgetId, { spin: { result, spunAt: new Date().toISOString(), nonce } });
        return result;
      }
      const { error: writeError } = await supabase
        .from("widgets")
        .update({ state: { spin: { result, spunAt: new Date().toISOString(), nonce } } as never })
        .eq("id", widgetId);
      if (writeError) throw writeError;
      return result;
    },
    onError: (err: Error) => {
      const message = widgetErrorText(err, "Could not spin the wheel.");
      setError(message);
      if (!isMissingViewerSession(message)) toast.error(message);
    },
  });

  const requestWheelSpin = () => {
    if (wheelTurning || spin.isPending || spinPrizes.length === 0) return;
    setWheelTurning(true);
    if (wheelTimer.current !== null) window.clearTimeout(wheelTimer.current);
    wheelTimer.current = window.setTimeout(() => {
      setWheelTurning(false);
      wheelTimer.current = null;
    }, wheelSpinLockMs());
    spin.mutate();
  };

  const bumpGoal = async (delta: number) => {
    if (!goalRow || !Number.isFinite(delta) || delta === 0) return;
    const next = Math.max(0, Number((goalDraft.current + delta).toFixed(2)));
    setGoalDraft((prev) => ({ ...prev, current: next }));
    if (isDemoBuild()) {
      await setDemoGoalCurrent(goalRow.id, next);
      await queryClient.invalidateQueries({ queryKey: ["widget", widgetId] });
      return;
    }
    const { error: writeError } = await supabase.from("goals").update({ current_value: next }).eq("id", goalRow.id);
    if (writeError) {
      const message = widgetErrorText(writeError, "Could not update the goal.");
      if (isMissingViewerSession(message)) setError(message);
      else toast.error(message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["widget", widgetId] });
  };

  const copyUrl = async () => {
    if (!widget) return;
    if (!widget.is_enabled) {
      toast.error("Enable the widget before copying an OBS URL.");
      return;
    }
    if (widget.type === "TIKTOK_TAPPERS" || widget.type === "TIKTOK_TAP_GOAL") {
      toast.error("TikTok overlays are Coming Soon until OAuth is ready.");
      return;
    }
    const url = widgetOverlayUrl(window.location.origin, widget.public_token);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("OBS URL copied");
    setTimeout(() => setCopied(false), 1500);
  };

  const set = (key: string, value: unknown) => setConfig((prev) => ({ ...prev, [key]: value }));
  const tabbedStandalone =
    widget?.type === "GOAL_BAR" ||
    widget?.type === "KICKS_GOAL" ||
    widget?.type === "SPIN_WHEEL" ||
    widget?.type === "VIEWER_COUNTER" ||
    widget?.type === "EVENT_LABELS";
  const standaloneTool = widget ? STANDALONE_TOOLS.find((tool) => tool.type === widget.type) : undefined;
  const patchRoyal = (partial: Partial<RoyalCompactSettings>) =>
    setConfig((prev) => ({
      ...prev,
      royalCompact: { ...parseRoyalCompactSettings(prev), ...partial },
    }));


  const miniPreview = (override: Record<string, unknown>) =>
    widget ? (
      <WidgetRenderer
        type={widget.type}
        config={{ ...config, ...override }}
        frame={stream.frame}
        remaining={stream.remaining}
        goal={
          isDynamicGoalWidget(widget.type)
            ? null
            : goalRow
              ? {
                  title: goalDraft.title,
                  unit: goalDraft.unit,
                  target: goalDraft.target,
                  current: goalDraft.current,
                }
              : stream.goal
        }
        events={stream.events}
        spin={stream.spin}
        spotlight={stream.spotlight}
        streamEvents={
          stream.streamEvents ?? (widget ? parseStreamEventsScheduleState(widget.state) : null)
        }
        poll={stream.poll ?? (widget ? parsePollRuntime(widget.state) : null)}
        prediction={widget.type === "PREDICTION" && override["layout"] &&
          (!stream.prediction || stream.prediction.eventName === "demo-fixture" || stream.prediction.status === "idle") ? {
          status: "open", title: lang === "ar" ? "من سيفوز؟" : "Who will win?",
          outcomes: [
            { id: "a", label: "A", points: 7000, voters: 70 },
            { id: "b", label: "B", points: 3000, voters: 30 },
          ], endsAt: null, hideAt: null, winnerId: null, updatedAt: null,
          eventName: "demo-prediction-test", lastMessageId: null, revision: 0,
        } : stream.prediction ?? parsePredictionRuntime(widget.state)}
        tappers={stream.tappers}
        tapGoal={stream.tapGoal}
        chat={stream.chat}
        testMessages={stream.testMessages}
        storedMessages={stream.chatMessages}
        linkStatus={stream.status}
        linkSurface="studio"
        demo
        publicToken={widget.public_token}
        spinning={false}
      />
    ) : null;

  const scheduleStyle =
    widget?.type === "STREAM_EVENTS_SCHEDULE" ? parseStreamEventsScheduleConfig(config) : null;
  const style =
    scheduleStyle ??
    (widget?.type === "GOAL_BAR"
      ? parseGoalConfig(config)
      : widget?.type === "CHAT_BOX"
          ? parseChatConfig(config)
          : widget?.type === "SPIN_WHEEL"
            ? parseSpinConfig(config)
            : widget?.type === "EMOTE_RAIN"
              ? parseEmoteRainConfig(config)
              : parseOverlayTheme(config));

  return (
    <AppShell
      user={user}
      profile={workspace?.profile}
      subathons={workspace?.subathons ?? []}
      title={
        widget
          ? widget.type === "EVENT_LABELS" &&
            ["Event labels", "Latest events", "تسميات الأحداث", "آخر الأحداث"].includes(widget.name)
            ? t("home.tool.eventLabels.name")
            : widget.type === "KICKS_GOAL" && ["Kicks Goal", "هدف الكيكس"].includes(widget.name)
              ? t("home.tool.kicksGoal.name")
              : widget.type === "SPIN_WHEEL" && ["Wheel of fortune", "عجلة الحظ"].includes(widget.name)
                ? t("home.tool.wheel.name")
                : widget.type === "VIEWER_COUNTER" && ["Viewer counter", "عداد المشاهدين"].includes(widget.name)
                  ? t("home.tool.viewerCounter.name")
                  : widget.name
          : "Widget builder"
      }
      subtitle={
        widget
          ? standaloneTool && tabbedStandalone
            ? t(standaloneTool.descriptionKey)
            : WIDGET_LABEL[widget.type]
          : "Loading…"
      }
      actions={
        widget ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!widget.is_enabled || widget.type === "TIKTOK_TAPPERS" || widget.type === "TIKTOK_TAP_GOAL"}
              title={
                !widget.is_enabled
                  ? "Enable the widget to copy an OBS URL"
                  : widget.type === "TIKTOK_TAPPERS" || widget.type === "TIKTOK_TAP_GOAL"
                    ? "TikTok overlays are Coming Soon"
                    : "Copy OBS browser-source URL"
              }
              onClick={() => void copyUrl()}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              Copy OBS URL
            </button>
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {save.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        ) : null
      }
    >
      <SessionAwareError
        error={
          error ??
          (widgetQuery.error ? widgetErrorText(widgetQuery.error, "Could not load this widget.") : null) ??
          (signedOutViewer && !widget ? SIGNED_OUT_ERROR : null)
        }
        signedOutLabel={t("widget.signedOut")}
      />

      {!widget ? (
        signedOutViewer || isMissingViewerSession(widgetQuery.error) ? (
          <div className="grid min-h-[420px] place-items-center rounded-2xl border border-border bg-[repeating-conic-gradient(#161616_0%_25%,#101010_0%_50%)] bg-[length:32px_32px] p-6">
            <WidgetRenderer
              type="CHAT_BOX"
              config={{}}
              frame={null}
              remaining={0}
              goal={null}
              events={[]}
              spin={null}
              chat={null}
              demo
            />
          </div>
        ) : widgetQuery.isError ? null : (
          <p className="text-sm text-muted-foreground">Loading widget…</p>
        )
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,380px)_1fr]">
          <section className="min-w-0 space-y-4 surface-card p-5">
            {widget.type === "SUBATHON_TIMER" ? (
              <SubathonTimerSidebar
                widgetId={widget.id}
                subathonId={widget.subathon_id ?? null}
                publicToken={widget.public_token}
                name={name}
                onNameChange={setName}
                config={config}
                onConfigChange={set}
                frame={stream.frame}
                remaining={stream.remaining}
                onSaveConfig={() => save.mutateAsync()}
                onCopyUrl={() => void copyUrl()}
                copied={copied}
                lang={"en"}
              />
            ) : (
            <>
            <label className="block">
              <span className={labelClass}>Name</span>
              <input
                className={`${fieldClass} mt-2`}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            {widget.type === "GOAL_BAR" && goalRow ? (
              <StandaloneWidgetFields
                type="GOAL_BAR"
                config={config}
                set={set}
                goal={{
                  title: goalDraft.title,
                  unit: goalDraft.unit,
                  target: goalDraft.target,
                  current: goalDraft.current,
                  showUnit: true,
                  onChange: (patch) => setGoalDraft((prev) => ({ ...prev, ...patch })),
                  onBump: (delta) => void bumpGoal(delta),
                }}
                progressExtra={
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => syncFollowers.mutate()}
                      disabled={syncFollowers.isPending}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-primary hover:text-primary disabled:opacity-60"
                    >
                      <RefreshCw
                        className={`size-4 ${syncFollowers.isPending ? "animate-spin" : ""}`}
                        aria-hidden
                      />
                      {syncFollowers.isPending ? t("std.goal.syncing") : t("std.goal.sync")}
                    </button>
                    <p className="text-[10px] text-muted-foreground">{t("std.goal.syncHint")}</p>
                  </div>
                }
                testPanel={<TestSimulatePanel widgetId={widget.id} />}
              />
            ) : null}

            {widget.type === "KICKS_GOAL" ||
            widget.type === "VIEWER_COUNTER" ||
            widget.type === "SPIN_WHEEL" ||
            widget.type === "EVENT_LABELS" ? (
              <StandaloneWidgetFields
                type={widget.type}
                config={config}
                set={set}
                spinning={wheelTurning || spin.isPending}
                onSpin={widget.type === "SPIN_WHEEL" ? requestWheelSpin : undefined}
                testPanel={widget.type === "KICKS_GOAL" ? <TestSimulatePanel widgetId={widget.id} /> : undefined}
              />
            ) : null}

            {widget.type === "CHAT_BOX" ? (
              <div className="space-y-3">
                <BuilderTabs value={chatPane} onChange={setChatPane} label={t("builder.chat.settings")} />

                {chatPane === "layout" ? (
                  <BuilderCard>
                    <div className="block">
                      <h3 className="text-sm font-semibold">{t("builder.chat.layoutTitle")}</h3>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {t("builder.chat.layoutHint")}
                      </p>
                      <div className="mt-3">
                        <ChatThemePicker
                          layout={parseChatConfig(config).chatLayout}
                          royalSelected={chatUsesRoyalCompact(config)}
                          onSelectLayout={(next) =>
                            setConfig((prev) => ({ ...prev, chatLayout: next, themeId: "dark-glass" }))
                          }
                          onSelectRoyal={() => {
                            if (!proActive) {
                              requestUpgrade();
                              return;
                            }
                            setConfig((prev) => ({
                              ...prev,
                              themeId: ROYAL_COMPACT_THEME_ID,
                              // Bubble wins over royal, so choosing Royal leaves the bubble layout.
                              ...(parseChatConfig(prev).chatLayout === "bubble" ? { chatLayout: "glass" } : {}),
                            }));
                          }}
                        />
                      </div>
                      <span className="mt-2 block text-[10px] text-muted-foreground">
                        {chatUsesRoyalCompact(config)
                          ? t("chat.theme.royalHint")
                          : CHAT_LAYOUTS.find((e) => e.value === parseChatConfig(config).chatLayout)?.hint}
                      </span>
                    </div>
                  </BuilderCard>
                ) : chatPane === "display" ? (
                  <BuilderCard>
                    <RangeField
                      label={t("builder.chat.messagesShown")}
                      value={parseChatConfig(config).maxMessages}
                      min={3}
                      max={25}
                      tip={<InfoTip text={t("tooltips.widget.chatMax")} />}
                      onChange={(next) => set("maxMessages", next)}
                    />
                    {chatUsesRoyalCompact(config) ? (
                      <>
                        <label className="block">
                          <span className={labelClass}>{t("chat.theme.density")}</span>
                          <DarkSelect
                            className="mt-2"
                            value={parseRoyalCompactSettings(config).density}
                            onValueChange={(next) =>
                              patchRoyal({ density: next === "normal" ? "normal" : "compact" })
                            }
                            options={[
                              { value: "compact", label: t("chat.theme.density.compact") },
                              { value: "normal", label: t("chat.theme.density.normal") },
                            ]}
                          />
                        </label>
                        <RangeField
                          label={t("builder.chat.textSize")}
                          value={parseRoyalCompactSettings(config).fontSize}
                          min={12}
                          max={28}
                          unit="px"
                          onChange={(next) => patchRoyal({ fontSize: next })}
                        />
                        <RangeField
                          label={t("chat.theme.opacity")}
                          value={parseRoyalCompactSettings(config).bubbleOpacity}
                          min={40}
                          max={100}
                          unit="%"
                          onChange={(next) => patchRoyal({ bubbleOpacity: next })}
                        />
                        <RangeField
                          label={t("builder.chat.messageSpacing")}
                          value={parseRoyalCompactSettings(config).messageGap}
                          min={4}
                          max={20}
                          unit="px"
                          tip={<InfoTip text={t("tooltips.widget.chatGap")} />}
                          onChange={(next) => patchRoyal({ messageGap: next })}
                        />
                        {parseRoyalCompactSettings(config).showAvatar ? (
                          <RangeField
                            label={t("chat.theme.avatarSize")}
                            value={parseRoyalCompactSettings(config).avatarSize}
                            min={24}
                            max={64}
                            unit="px"
                            onChange={(next) => patchRoyal({ avatarSize: next })}
                          />
                        ) : null}
                      </>
                    ) : (
                      <>
                        <RangeField
                          label={t("builder.chat.messageSpacing")}
                          value={parseChatConfig(config).messageGap}
                          min={4}
                          max={20}
                          unit="px"
                          tip={<InfoTip text={t("tooltips.widget.chatGap")} />}
                          onChange={(next) => set("messageGap", next)}
                        />
                        <RangeField
                          label={t("builder.chat.textSize")}
                          value={Math.min(28, Math.max(12, parseChatConfig(config).fontSize))}
                          min={12}
                          max={28}
                          unit="px"
                          onChange={(next) => set("fontSize", next)}
                        />
                      </>
                    )}
                  </BuilderCard>
                ) : (
                  <BuilderCard>
                    <h3 className="text-sm font-semibold">{t("builder.chat.visibility")}</h3>
                    {chatUsesRoyalCompact(config) ? (
                      <ToggleField
                        label={t("chat.theme.showAvatar")}
                        checked={parseRoyalCompactSettings(config).showAvatar}
                        onChange={(next) => patchRoyal({ showAvatar: next })}
                      />
                    ) : null}
                    <ToggleField
                      label={t("builder.chat.showAccountBadges")}
                      hint={t("builder.chat.showAccountBadgesHint")}
                      checked={parseChatConfig(config).showBadges}
                      onChange={(next) => set("showBadges", next)}
                    />
                    <ToggleField
                      label={t("builder.chat.showPlatformBadge")}
                      hint={t("builder.chat.showPlatformBadgeHint")}
                      checked={parseChatConfig(config).showPlatform}
                      onChange={(next) => set("showPlatform", next)}
                    />
                    <div className="border-t border-white/[0.06] pt-4">
                      <KickSubscriberBadgesField
                        userId={userId}
                        config={config}
                        onChange={(tiers) => set("kickSubscriberBadges", tiers)}
                        onUseDefault={(enabled) => set("kickDefaultSubscriberBadge", enabled)}
                      />
                    </div>
                  </BuilderCard>
                )}
              </div>
            ) : null}

            {widget.type === "TIKTOK_TAP_GOAL" ? (
              <div className="space-y-3">
                <BuilderTabs value={tapGoalPane} onChange={setTapGoalPane} label={t("builder.tapgoal.settings")} />
                {tapGoalPane === "layout" ? (
                  <BuilderCard>
                    <LayoutCards
                      ariaLabel={t("builder.layoutPicker")}
                      options={TAPGOAL_DESIGNS.map((entry) => ({
                        value: entry.value,
                        label: t(`builder.tapgoal.design.${entry.value}` as const),
                      }))}
                      value={parseTapGoalConfig(config).design}
                      onSelect={(next) => set("design", next)}
                      renderPreview={(next) => miniPreview({ design: next })}
                    />
                  </BuilderCard>
                ) : tapGoalPane === "display" ? (
                  <BuilderCard>
                    <RangeField
                      label={t("builder.fontSize")}
                      value={style.fontSize}
                      min={12}
                      max={160}
                      unit="px"
                      tip={<InfoTip text={t("tooltips.widget.fontSize")} />}
                      onChange={(next) => set("fontSize", next)}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className={labelClass}>{t("builder.gradientStart")}</span>
                        <input
                          type="color"
                          className="mt-2 h-10 w-full rounded-lg border border-border bg-transparent"
                          value={parseTapGoalConfig(config).gradientFrom}
                          onChange={(event) => set("gradientFrom", event.target.value)}
                        />
                      </label>
                      <label className="block">
                        <span className={labelClass}>{t("builder.gradientEnd")}</span>
                        <input
                          type="color"
                          className="mt-2 h-10 w-full rounded-lg border border-border bg-transparent"
                          value={parseTapGoalConfig(config).gradientTo}
                          onChange={(event) => set("gradientTo", event.target.value)}
                        />
                      </label>
                    </div>
                  </BuilderCard>
                ) : (
                  <BuilderCard>
                    <label className="block">
                      <span className={labelClass}>{t("builder.goalTitle")}</span>
                      <input
                        className={`${fieldClass} mt-2`}
                        value={parseTapGoalConfig(config).title}
                        onChange={(event) => set("title", event.target.value)}
                        placeholder="Goal: 50K Taps for Giveaway!"
                      />
                    </label>
                    <label className="block">
                      <span className={labelClass}>{t("builder.goalTarget")}</span>
                      <input
                        type="number"
                        min={1}
                        step={1000}
                        className={`${fieldClass} mt-2`}
                        value={parseTapGoalConfig(config).target}
                        onChange={(event) => set("target", Number(event.target.value))}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[10000, 50000, 100000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => set("target", preset)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary hover:text-primary"
                        >
                          {preset.toLocaleString("en-US")}
                        </button>
                      ))}
                    </div>
                    <ToggleField
                      label={t("builder.showPercent")}
                      checked={parseTapGoalConfig(config).showPercent}
                      onChange={(next) => set("showPercent", next)}
                    />
                  </BuilderCard>
                )}
              </div>
            ) : null}

            {widget.type === "TIKTOK_TAPPERS" ? (
              <div className="space-y-3">
                <BuilderTabs value={tappersPane} onChange={setTappersPane} label={t("builder.tappers.settings")} />
                {tappersPane === "layout" ? (
                  <BuilderCard>
                    <LayoutCards
                      ariaLabel={t("builder.layoutPicker")}
                      options={TAPPERS_LAYOUTS.map((entry) => ({
                        value: entry.value,
                        label: t(`builder.tappers.layout.${entry.value}` as const),
                      }))}
                      value={parseTappersConfig(config).layout}
                      onSelect={(next) => set("layout", next)}
                      renderPreview={(next) => miniPreview({ layout: next })}
                    />
                  </BuilderCard>
                ) : tappersPane === "display" ? (
                  <BuilderCard>
                    <RangeField
                      label={t("builder.fontSize")}
                      value={style.fontSize}
                      min={12}
                      max={160}
                      unit="px"
                      tip={<InfoTip text={t("tooltips.widget.fontSize")} />}
                      onChange={(next) => set("fontSize", next)}
                    />
                    <ToggleField
                      label={t("builder.showProfilePictures")}
                      checked={parseTappersConfig(config).showAvatars}
                      onChange={(next) => set("showAvatars", next)}
                    />
                  </BuilderCard>
                ) : (
                  <BuilderCard>
                    <label className="block">
                      <span className={labelClass}>{t("builder.title")}</span>
                      <input
                        className={`${fieldClass} mt-2`}
                        value={parseTappersConfig(config).title}
                        onChange={(event) => set("title", event.target.value)}
                      />
                    </label>
                    <label className="block">
                      <span className={labelClass}>{t("builder.topLimit")}</span>
                      <DarkSelect
                        className="mt-2"
                        value={String(parseTappersConfig(config).topLimit)}
                        onValueChange={(next) => set("topLimit", Number(next))}
                        options={TAPPERS_LIMITS.map((limit) => ({
                          value: String(limit),
                          label: t("builder.topN", { n: limit }),
                        }))}
                      />
                    </label>
                  </BuilderCard>
                )}
              </div>
            ) : null}

            {widget.type === "EMOTE_RAIN" ? (
              <div className="space-y-3">
                <BuilderTabs
                  value={emoteRainPane === "layout" ? "display" : emoteRainPane}
                  onChange={setEmoteRainPane}
                  label={t("builder.emoteRain.settings")}
                  panes={["display", "extra"]}
                />
                {emoteRainPane === "extra" ? (
                  <BuilderCard>
                    <RangeField
                      label={t("builder.emoteBurst")}
                      value={parseEmoteRainConfig(config).burst}
                      min={1}
                      max={60}
                      tip={<InfoTip text={t("tooltips.widget.emoteBurst")} />}
                      onChange={(next) => set("burst", next)}
                    />
                    <RangeField
                      label={t("builder.fallDuration")}
                      value={Math.round(parseEmoteRainConfig(config).fallMs / 1000)}
                      min={1}
                      max={15}
                      unit="s"
                      tip={<InfoTip text={t("tooltips.widget.fallDuration")} />}
                      onChange={(next) => set("fallMs", next * 1000)}
                    />
                  </BuilderCard>
                ) : (
                  <BuilderCard>
                    <label className="block">
                      <span className={labelClass}>{t("builder.emotes")}</span>
                      <input
                        className={`${fieldClass} mt-2`}
                        value={parseEmoteRainConfig(config).emotes.join(", ")}
                        onChange={(event) =>
                          set(
                            "emotes",
                            event.target.value.split(",").map((entry) => entry.trim()),
                          )
                        }
                      />
                    </label>
                    <RangeField
                      label={t("builder.emoteSize")}
                      value={parseEmoteRainConfig(config).emoteSize}
                      min={16}
                      max={160}
                      unit="px"
                      onChange={(next) => set("emoteSize", next)}
                    />
                  </BuilderCard>
                )}
              </div>
            ) : null}

            {widget.type === "CHAT_SPOTLIGHT" ? (
              <div className="space-y-3">
                <BuilderTabs value={spotlightPane} onChange={setSpotlightPane} label={t("builder.spotlight.settings")} />
                {spotlightPane === "layout" ? (
                  <BuilderCard>
                    <LayoutCards
                      ariaLabel={t("builder.layoutPicker")}
                      options={CHROME_LAYOUTS.map((id) => ({ value: id, label: t(`layout.chrome.${id}`) }))}
                      value={parseChromeLayout(config)}
                      onSelect={(next) => set("layout", next)}
                      renderPreview={(next) => miniPreview({ layout: next })}
                    />
                  </BuilderCard>
                ) : spotlightPane === "display" ? (
                  <BuilderCard>
                    <RangeField
                      label={t("builder.fontSize")}
                      value={style.fontSize}
                      min={12}
                      max={160}
                      unit="px"
                      tip={<InfoTip text={t("tooltips.widget.fontSize")} />}
                      onChange={(next) => set("fontSize", next)}
                    />
                  </BuilderCard>
                ) : (
                  <BuilderCard>
                    <ToggleField
                      label={t("builder.chat.showPlatformBadge")}
                      hint={t("builder.chat.showPlatformBadgeHint")}
                      checked={parseSpotlightConfig(config).showPlatform}
                      onChange={(next) => set("showPlatform", next)}
                    />
                    <ToggleField
                      label={t("builder.showBadges")}
                      checked={parseSpotlightConfig(config).showBadges}
                      onChange={(next) => set("showBadges", next)}
                    />
                    <div className="border-t border-white/[0.06] pt-4">
                      <SpotlightControlPanel
                        widgetId={widget.id}
                        chat={stream.chat ?? null}
                        testMessages={stream.testMessages}
                        pinned={stream.spotlight ?? null}
                        autoHideMs={parseSpotlightConfig(config).autoHideMs}
                        onAutoHideChange={(next) => set("autoHideMs", next)}
                        lang={lang}
                      />
                    </div>
                  </BuilderCard>
                )}
              </div>
            ) : null}

            {widget.type === "STREAM_EVENTS_SCHEDULE" ? (
              <div className="space-y-3">
                <BuilderTabs value={schedulePane} onChange={setSchedulePane} label={t("builder.schedule.settings")} />
                {schedulePane === "layout" ? (
                  <BuilderCard>
                    <LayoutCards
                      ariaLabel={t("builder.layoutPicker")}
                      options={CHROME_LAYOUTS.map((id) => ({ value: id, label: t(`layout.chrome.${id}`) }))}
                      value={parseChromeLayout(config)}
                      onSelect={(next) => set("layout", next)}
                      renderPreview={(next) => miniPreview({ layout: next })}
                    />
                  </BuilderCard>
                ) : schedulePane === "display" ? (
                  <BuilderCard>
                    <RangeField
                      label={t("builder.fontSize")}
                      value={style.fontSize}
                      min={12}
                      max={160}
                      unit="px"
                      tip={<InfoTip text={t("tooltips.widget.fontSize")} />}
                      onChange={(next) => set("fontSize", next)}
                    />
                  </BuilderCard>
                ) : (
                  <BuilderCard>
                    <StreamEventsScheduleControlPanel
                      widgetId={widget.id}
                      config={config}
                      state={widget.state}
                      onConfigChange={(next) => {
                        setConfig({ ...next });
                      }}
                    />
                  </BuilderCard>
                )}
              </div>
            ) : null}

            {widget.type === "POLL" ? (
              <div className="space-y-3">
                <BuilderTabs
                  value={pollPane === "layout" ? "display" : pollPane}
                  onChange={setPollPane}
                  label={t("builder.poll.settings")}
                  panes={["display", "extra"]}
                />
                {pollPane === "extra" ? (
                  <BuilderCard>
                    <PollControlPanel
                      state={widget.state}
                      live={stream.poll}
                      chat={stream.chat}
                      kickConnected={Boolean(stream.chat?.kickChatroomId)}
                    />
                  </BuilderCard>
                ) : (
                  <BuilderCard>
                    <RangeField
                      label={t("builder.fontSize")}
                      value={style.fontSize}
                      min={12}
                      max={160}
                      unit="px"
                      tip={<InfoTip text={t("tooltips.widget.fontSize")} />}
                      onChange={(next) => set("fontSize", next)}
                    />
                  </BuilderCard>
                )}
              </div>
            ) : null}

            {widget.type === "PREDICTION" ? (
              <div className="space-y-3">
                <BuilderTabs
                  value={predictionPane}
                  onChange={setPredictionPane}
                  label={t("builder.prediction.settings")}
                />
                {predictionPane === "layout" ? (
                  <BuilderCard>
                    <LayoutCards
                      ariaLabel={t("builder.layoutPicker")}
                      options={[
                        { value: "classic", label: lang === "ar" ? "التصميم الأصلي" : "Classic" },
                        { value: "particle-clash", label: lang === "ar" ? "صراع الدوائر" : "Particle Clash",
                          hint: lang === "ar" ? "معاينة اختبار عند غياب التوقع" : "Test preview when no prediction is available" },
                      ]}
                      value={parsePredictionConfig(config).layout}
                      onSelect={next => set("layout", next)}
                      renderPreview={next => miniPreview({ layout: next })}
                    />
                  </BuilderCard>
                ) : predictionPane === "extra" ? (
                  <>
                  {parsePredictionConfig(config).layout === "particle-clash" ? (
                    <PredictionParticleTest widgetId={widget.id}
                      runtime={stream.prediction?.eventName === "demo-fixture" ? parsePredictionRuntime(widget.state) :
                        stream.prediction ?? parsePredictionRuntime(widget.state)} />
                  ) : null}
                  {parsePredictionConfig(config).layout === "particle-clash" ? (
                    <PredictionParticleSettings pane="extra" config={config} onChange={patch => setConfig(current => ({ ...current, ...patch }))} />
                  ) : null}
                  <BuilderCard>
                    <PredictionControlPanel
                      state={widget.state}
                      live={parsePredictionConfig(config).layout === "particle-clash" && stream.prediction?.eventName === "demo-fixture" ? null : stream.prediction}
                      chat={stream.chat}
                      kickConnected={Boolean(stream.chat?.kickChatroomId)}
                    />
                  </BuilderCard>
                  </>
                ) : (
                  <>
                  {parsePredictionConfig(config).layout === "particle-clash" ? (
                    <PredictionParticleSettings pane="display" config={config} onChange={patch => setConfig(current => ({ ...current, ...patch }))} />
                  ) : null}
                  <BuilderCard>
                    <RangeField
                      label={t("builder.fontSize")}
                      value={style.fontSize}
                      min={12}
                      max={160}
                      unit="px"
                      tip={<InfoTip text={t("tooltips.widget.fontSize")} />}
                      onChange={(next) => set("fontSize", next)}
                    />
                  </BuilderCard>
                  </>
                )}
              </div>
            ) : null}

            {widget.type === "STREAM_EVENTS_SCHEDULE" ||
            widget.type === "SPIN_WHEEL" ||
            widget.type === "EVENT_LABELS" ||
            widget.type === "CHAT_BOX" ||
            widget.type === "CHAT_SPOTLIGHT" ||
            tabbedStandalone ||
            widget.type === "VIEWER_COUNTER" ? null : (
              <TestSimulatePanel widgetId={widget.id} />
            )}

            {widget.type === "SPIN_WHEEL" ||
            widget.type === "EVENT_LABELS" ||
            widget.type === "CHAT_BOX" ||
            widget.type === "CHAT_SPOTLIGHT" ||
            widget.type === "STREAM_EVENTS_SCHEDULE" ||
            widget.type === "POLL" ||
            widget.type === "PREDICTION" ||
            widget.type === "VIEWER_COUNTER" ? null : (
            <div className="rounded-xl border border-border bg-background p-4">
              <p className={labelClass}>OBS browser source</p>
              <code className="mt-2 block break-all text-xs text-muted-foreground">
                {`/overlay/${widget.public_token}`}
              </code>
            </div>
            )}

            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-transparent px-4 py-2.5 text-sm font-medium text-red-500 transition-colors hover:border-red-500/30 hover:bg-red-500/10"
            >
              <Trash2 className="size-4" aria-hidden />
              {t("home.delete")}
            </button>
            </>
            )}
          </section>

          <section className={`grid min-h-[420px] min-w-0 place-items-center overflow-hidden rounded-2xl border border-border bg-[repeating-conic-gradient(#161616_0%_25%,#101010_0%_50%)] bg-[length:32px_32px] p-6 ${widget.type === "PREDICTION" && parsePredictionConfig(config).layout === "particle-clash" ? "self-start" : ""}`}>
            <WidgetRenderer
              type={widget.type}
              config={config}
              frame={stream.frame}
              remaining={stream.remaining}
              goal={
                isDynamicGoalWidget(widget.type)
                  ? null
                  : goalRow
                    ? {
                        title: goalDraft.title,
                        unit: goalDraft.unit,
                        target: goalDraft.target,
                        current: goalDraft.current,
                      }
                    : stream.goal
              }
              events={stream.events}
              spin={stream.spin}
              spotlight={stream.spotlight}
              streamEvents={
                stream.streamEvents ??
                (widget ? parseStreamEventsScheduleState(widget.state) : null)
              }
              poll={stream.poll ?? (widget ? parsePollRuntime(widget.state) : null)}
              prediction={stream.prediction ?? (widget ? parsePredictionRuntime(widget.state) : null)}
              tappers={stream.tappers}
              tapGoal={stream.tapGoal}

              chat={stream.chat}
              testMessages={stream.testMessages}
              storedMessages={stream.chatMessages}
              linkStatus={stream.status}
              linkSurface="studio"
              demo
              publicToken={widget.public_token}
              spinning={wheelTurning || spin.isPending}
            />
          </section>
        </div>
      )}

      {confirmDelete ? (
        <DeleteWidgetDialog
          widgetName={widget?.name}
          pending={remove.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => remove.mutate()}
        />
      ) : null}
    </AppShell>
  );
}


function ToggleField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint ? <span className="block text-[10px] text-muted-foreground">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${
            checked ? "start-[22px]" : "start-0.5"
          }`}
        />
      </button>
    </div>
  );
}
