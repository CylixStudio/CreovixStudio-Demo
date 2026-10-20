import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { DarkSelect } from "@/components/ui/dark-select";
import { EventsMini, ViewerMini, WheelMini } from "@/components/widgets/LayoutMinis";
import {
  ColorField,
  FontField,
  LayoutCards,
  PaneBody,
  PaneSection,
  PaneTabs,
  RangeField,
  paneFieldClass,
  paneLabelClass,
  type Pane,
} from "@/components/widgets/PaneKit";
import { playWheelSpinSound } from "@/components/widgets/SpinWheel";
import { WheelPrizeManager } from "@/components/widgets/WheelPrizeManager";
import {
  GoalWidgetFields,
  configGoalBinding,
  type GoalBinding,
} from "@/components/widgets/GoalWidgetFields";
import { EVENT_LABEL_I18N, EVENT_LABEL_OPTIONS } from "@/lib/eventLabels";
import { useLanguage } from "@/lib/i18n";
import { useWorkspace } from "@/hooks/useWorkspace";
import { lookupChannel } from "@/lib/liveCounter.functions";
import { supabase } from "@/lib/supabase/client";
import {
  draftSpinPrizes,
  parseEventLabelsConfig,
  parseSpinConfig,
  parseSpinCost,
  parseViewerCounterConfig,
  type SpinPrize,
  type ViewerPlatform,
  type WidgetType,
} from "@/lib/widgets";
import {
  EVENT_LABEL_LAYOUTS,
  VIEWER_LAYOUTS,
  WHEEL_LAYOUTS,
  parseEventLabelLayout,
  parseViewerLayout,
  parseWheelLayout,
} from "@/lib/widgetLayouts";

const VIEWER_CHOICES: ViewerPlatform[] = ["KICK", "TWITCH", "YOUTUBE", "X"];

function connectionAvatar(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";
  const record = metadata as Record<string, unknown>;
  const url = record["avatar_url"] ?? record["image"] ?? record["profile_image_url"];
  return typeof url === "string" && /^https?:\/\//i.test(url) ? url : "";
}

/** Layout | Display | Extra settings for the goal, wheel, viewer-count and latest-events widgets. */
export function StandaloneWidgetFields({
  type,
  config,
  set,
  onSpin,
  spinning,
  goal,
  progressExtra,
  testPanel,
}: {
  type: WidgetType;
  config: Record<string, unknown>;
  set: (key: string, value: unknown) => void;
  onSpin?: (() => void) | undefined;
  spinning?: boolean;
  /** Goal rows that live outside the config (the goal bar). Other goals read the config. */
  goal?: GoalBinding;
  progressExtra?: ReactNode;
  testPanel?: ReactNode;
}) {
  const { t } = useLanguage();
  const [pane, setPane] = useState<Pane>("layout");
  const sessionUser = useQuery({
    queryKey: ["auth-user-id"],
    staleTime: 60_000,
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? "",
  });
  const workspace = useWorkspace(sessionUser.data ?? "");
  const viewer = parseViewerCounterConfig(config);
  const prizes = useMemo<SpinPrize[]>(() => draftSpinPrizes(config), [config]);
  const [lookupNote, setLookupNote] = useState<string | null>(null);
  const [lookupCount, setLookupCount] = useState<number | null>(null);

  const writePrizes = (next: SpinPrize[]) => {
    set("prizes", next);
    set(
      "entries",
      next.map((prize) => prize.label.trim()).filter((label) => label.length > 0),
    );
    set("prizesSeeded", true);
  };

  const linked = useMemo(() => {
    const rows = workspace.data?.connections ?? [];
    const preferred = workspace.data?.profile?.default_platform;
    const active = rows.filter((row) => row.is_active && row.username);
    const match =
      active.find((row) => row.platform === preferred) ??
      active.find((row) => VIEWER_CHOICES.includes(row.platform as ViewerPlatform)) ??
      null;
    if (!match?.username || !VIEWER_CHOICES.includes(match.platform as ViewerPlatform)) return null;
    return {
      platform: match.platform as ViewerPlatform,
      channel: match.username,
      avatar: connectionAvatar(match.metadata),
    };
  }, [workspace.data?.connections, workspace.data?.profile?.default_platform]);

  useEffect(() => {
    if (type !== "VIEWER_COUNTER" || !linked) return;
    if (viewer.platform === linked.platform && viewer.channel === linked.channel) return;
    set("platform", linked.platform);
    set("channel", linked.channel);
  }, [linked, set, type, viewer.channel, viewer.platform]);

  useEffect(() => {
    if (type !== "SPIN_WHEEL" || !linked?.avatar) return;
    const source = config["logoSource"] === "custom" ? "custom" : "channel";
    if (source !== "channel") return;
    if (config["channelLogoUrl"] === linked.avatar) return;
    set("channelLogoUrl", linked.avatar);
    set("logoSource", "channel");
  }, [config, linked, set, type]);

  if (type === "SPIN_WHEEL") {
    const cost = parseSpinCost(config);
    const spinStyle = parseSpinConfig(config);
    const named = prizes.some((prize) => prize.label.trim().length > 0);
    const customLogo = config["logoSource"] === "custom";
    const logoUrl = customLogo
      ? typeof config["customLogoUrl"] === "string"
        ? config["customLogoUrl"]
        : ""
      : typeof config["channelLogoUrl"] === "string"
        ? config["channelLogoUrl"]
        : "";
    return (
      <div className="space-y-3" data-widget-panes="wheel">
        <PaneTabs value={pane} onChange={setPane} label={t("std.tabs.aria")} />
        {pane === "layout" ? (
          <PaneBody>
            <PaneSection title={t("std.layout.title")} hint={t("std.layout.wheel.hint")}>
              <LayoutCards
                columns={3}
                value={parseWheelLayout(config)}
                onChange={(id) => set("layout", id)}
                options={WHEEL_LAYOUTS.map((id) => ({
                  id,
                  label: t(`layout.wheel.${id}`),
                  mini: <WheelMini layout={id} />,
                }))}
              />
            </PaneSection>
          </PaneBody>
        ) : pane === "display" ? (
          <PaneBody>
            <label className="block">
              <span className={paneLabelClass}>{t("widget.wheel.title")}</span>
              <input
                className={`${paneFieldClass} mt-2`}
                value={typeof config["title"] === "string" ? config["title"] : spinStyle.title}
                onChange={(event) => set("title", event.target.value)}
              />
            </label>
            <FontField value={spinStyle.fontFamily} onChange={(next) => set("fontFamily", next)} />
            <PaneSection title={t("std.wheel.logoSection")}>
              <label className="block">
                <span className={paneLabelClass}>{t("widget.wheel.logo")}</span>
                <DarkSelect
                  className="mt-2"
                  value={customLogo ? "custom" : "channel"}
                  onValueChange={(next) => set("logoSource", next)}
                  aria-label={t("widget.wheel.logo")}
                  options={[
                    { value: "channel", label: t("widget.wheel.logoChannel") },
                    { value: "custom", label: t("widget.wheel.logoCustom") },
                  ]}
                />
              </label>
              {customLogo ? (
                <label className="block">
                  <span className={paneLabelClass}>{t("widget.wheel.logoUpload")}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className={`${paneFieldClass} mt-2`}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file || file.size > 180_000) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === "string") set("customLogoUrl", reader.result);
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              ) : linked?.avatar ? (
                <img src={linked.avatar} alt="" className="size-12 rounded-full object-cover" />
              ) : (
                <p className="text-xs text-muted-foreground">{t("widget.viewer.accountMissing")}</p>
              )}
            </PaneSection>
            {logoUrl ? null : (
              <PaneSection title={t("std.wheel.hub")} hint={t("std.wheel.hubHint")}>
                <ColorField
                  label={t("std.wheel.hubFill")}
                  value={spinStyle.backgroundColor}
                  onChange={(next) => set("backgroundColor", next)}
                />
                <ColorField
                  label={t("std.wheel.hubRing")}
                  value={spinStyle.accentColor}
                  onChange={(next) => set("accentColor", next)}
                />
              </PaneSection>
            )}
          </PaneBody>
        ) : (
          <PaneBody>
            <WheelPrizeManager prizes={prizes} onChange={writePrizes} />
            <PaneSection title={t("std.wheel.chat")}>
              <label className="block">
                <span className={paneLabelClass}>{t("widget.wheel.cost")}</span>
                <input
                  type="number"
                  min={0}
                  className={`${paneFieldClass} mt-2`}
                  value={cost}
                  onChange={(event) =>
                    set("spinCost", Math.max(0, Number(event.target.value) || 0))
                  }
                />
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {t("widget.wheel.costHint")}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {t("widget.wheel.commands")}
                </p>
              </label>
            </PaneSection>
            {onSpin ? (
              <PaneSection title={t("std.wheel.spinSection")} hint={t("std.wheel.spinHint")}>
                <button
                  type="button"
                  onClick={() => {
                    if (spinning || !named) return;
                    playWheelSpinSound();
                    onSpin();
                  }}
                  disabled={spinning || !named}
                  className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {spinning ? "…" : t("widget.wheel.spin")}
                </button>
              </PaneSection>
            ) : null}
          </PaneBody>
        )}
      </div>
    );
  }

  if (type === "VIEWER_COUNTER") {
    const layout = parseViewerLayout(config);
    return (
      <div className="space-y-3" data-widget-panes="viewer">
        <PaneTabs value={pane} onChange={setPane} label={t("std.tabs.aria")} />
        {pane === "layout" ? (
          <PaneBody>
            <PaneSection title={t("std.layout.title")} hint={t("std.layout.viewer.hint")}>
              <LayoutCards
                columns={3}
                value={layout}
                onChange={(id) => set("layout", id)}
                options={VIEWER_LAYOUTS.map((id) => ({
                  id,
                  label: t(`layout.viewer.${id}`),
                  mini: <ViewerMini layout={id} config={config} />,
                }))}
              />
            </PaneSection>
          </PaneBody>
        ) : pane === "display" ? (
          <PaneBody>
            <PaneSection title={t("std.display.typography")}>
              <FontField value={viewer.fontFamily} onChange={(next) => set("fontFamily", next)} />
              <RangeField
                label={t("std.fontSize")}
                value={viewer.fontSize}
                min={24}
                max={160}
                suffix="px"
                onChange={(next) => set("fontSize", next)}
              />
            </PaneSection>
            <PaneSection title={t("std.display.colors")}>
              <ColorField
                label={t("widget.kicks.text")}
                value={viewer.textColor}
                onChange={(next) => set("textColor", next)}
              />
              {layout === "digits" ? null : (
                <ColorField
                  label={t("std.color.accent")}
                  value={viewer.accentColor}
                  onChange={(next) => set("accentColor", next)}
                />
              )}
            </PaneSection>
          </PaneBody>
        ) : (
          <PaneBody>
            <p className="text-sm text-foreground">
              {linked
                ? `${linked.platform} · ${linked.channel}`
                : t("widget.viewer.accountMissing")}
            </p>
            <label className="block">
              <span className={paneLabelClass}>{t("widget.viewer.metric")}</span>
              <DarkSelect
                className="mt-2"
                value={viewer.metric}
                onValueChange={(next) => set("metric", next)}
                aria-label={t("widget.viewer.metric")}
                options={[
                  { value: "viewers", label: t("widget.viewer.viewers") },
                  { value: "followers", label: t("widget.viewer.followers") },
                ]}
              />
            </label>
            <button
              type="button"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              onClick={() => {
                setLookupNote(null);
                void lookupChannel({
                  data: { platform: viewer.platform, username: viewer.channel },
                })
                  .then((snapshot) => {
                    const count =
                      viewer.metric === "followers" ? snapshot.followers : snapshot.viewers;
                    setLookupCount(count);
                    setLookupNote(snapshot.note);
                  })
                  .catch((error: unknown) => {
                    setLookupCount(null);
                    setLookupNote(
                      error instanceof Error ? error.message : t("widget.viewer.comingSoon"),
                    );
                  });
              }}
            >
              {t("widget.viewer.preview")}
            </button>
            {lookupCount !== null ? (
              <p className="text-sm tabular-nums" dir="ltr">
                {lookupCount.toLocaleString("en-US")}
              </p>
            ) : null}
            {lookupNote ? <p className="text-xs text-muted-foreground">{lookupNote}</p> : null}
          </PaneBody>
        )}
      </div>
    );
  }

  if (type === "EVENT_LABELS") {
    const parsed = parseEventLabelsConfig(config);
    const selected = new Set(parsed.labels);
    const layout = parseEventLabelLayout(config);
    return (
      <div className="space-y-3" data-widget-panes="events">
        <PaneTabs value={pane} onChange={setPane} label={t("std.tabs.aria")} />
        {pane === "layout" ? (
          <PaneBody>
            <PaneSection title={t("std.layout.title")} hint={t("std.layout.events.hint")}>
              <LayoutCards
                value={layout}
                onChange={(id) => set("layout", id)}
                options={EVENT_LABEL_LAYOUTS.map((id) => ({
                  id,
                  label: t(`layout.events.${id}`),
                  mini: <EventsMini layout={id} config={config} />,
                }))}
              />
            </PaneSection>
          </PaneBody>
        ) : pane === "display" ? (
          <PaneBody>
            {layout === "cycle" ? null : (
              <label className="block">
                <span className={paneLabelClass}>{t("widget.labels.title")}</span>
                <input
                  className={`${paneFieldClass} mt-2`}
                  value={typeof config["title"] === "string" ? config["title"] : parsed.title}
                  onChange={(event) => set("title", event.target.value)}
                />
              </label>
            )}
            <PaneSection title={t("std.events.shown")} hint={t("std.events.shownHint")}>
              <DarkSelect
                value="__add"
                onValueChange={(next) => {
                  if (
                    next === "__add" ||
                    selected.has(next as (typeof EVENT_LABEL_OPTIONS)[number])
                  )
                    return;
                  set("labels", [...parsed.labels, next]);
                }}
                aria-label={t("widget.labels.options")}
                options={[
                  { value: "__add", label: t("widget.labels.add") },
                  ...EVENT_LABEL_OPTIONS.filter((option) => !selected.has(option)).map(
                    (option) => ({
                      value: option,
                      label: t(EVENT_LABEL_I18N[option]),
                    }),
                  ),
                ]}
              />
              <div className="flex flex-wrap gap-2">
                {[...selected].map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="rounded-full border border-white/10 px-2.5 py-1 text-xs hover:border-red-500/40"
                    onClick={() =>
                      set(
                        "labels",
                        parsed.labels.filter((id) => id !== option),
                      )
                    }
                  >
                    {t(EVENT_LABEL_I18N[option])} ×
                  </button>
                ))}
              </div>
              {layout === "island" || layout === "cycle" ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("widget.labels.liveHint")}
                </p>
              ) : null}
            </PaneSection>
            <PaneSection title={t("std.display.typography")}>
              <FontField value={parsed.fontFamily} onChange={(next) => set("fontFamily", next)} />
              <RangeField
                label={t("std.fontSize")}
                value={parsed.fontSize}
                min={16}
                max={100}
                suffix="px"
                onChange={(next) => set("fontSize", next)}
              />
            </PaneSection>
            <PaneSection title={t("std.display.colors")}>
              <ColorField
                label={t("widget.kicks.text")}
                value={parsed.textColor}
                onChange={(next) => set("textColor", next)}
              />
              {layout === "cycle" ? null : (
                <ColorField
                  label={t("std.color.accent")}
                  value={parsed.accentColor}
                  onChange={(next) => set("accentColor", next)}
                />
              )}
            </PaneSection>
          </PaneBody>
        ) : (
          <PaneBody>
            <label className="block">
              <span className={paneLabelClass}>{t("std.events.language")}</span>
              <DarkSelect
                className="mt-2"
                value={parsed.language ?? "auto"}
                onValueChange={(next) => set("language", next)}
                aria-label={t("std.events.language")}
                options={[
                  { value: "auto", label: t("std.events.lang.auto") },
                  { value: "ar", label: t("std.events.lang.ar") },
                  { value: "en", label: t("std.events.lang.en") },
                ]}
              />
            </label>
          </PaneBody>
        )}
      </div>
    );
  }

  if (
    type === "KICKS_GOAL" ||
    type === "GOAL_BAR" ||
    type === "DONATION_GOAL" ||
    type === "FOLLOWER_GOAL" ||
    type === "SUBSCRIBER_GOAL" ||
    type === "CUSTOM_GOAL"
  ) {
    return (
      <GoalWidgetFields
        type={type}
        config={config}
        set={set}
        binding={goal ?? configGoalBinding(type, config, set)}
        progressExtra={progressExtra}
        testPanel={testPanel}
      />
    );
  }

  return null;
}
