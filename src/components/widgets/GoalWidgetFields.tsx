import { useState, type ReactNode } from "react";

import {
  ColorField,
  FontField,
  LayoutCards,
  PaneBody,
  PaneSection,
  PaneTabs,
  RangeField,
  SwitchField,
  paneFieldClass,
  paneLabelClass,
  type Pane,
} from "@/components/widgets/PaneKit";
import { GoalMini } from "@/components/widgets/LayoutMinis";
import { useLanguage } from "@/lib/i18n";
import {
  parseGoalConfig,
  parseKicksGoalConfig,
  parseSplitGoalConfig,
  isSplitGoalKind,
  type WidgetType,
} from "@/lib/widgets";
import { GOAL_LAYOUTS, parseGoalLayout } from "@/lib/widgetLayouts";

export type GoalKind = "donation" | "follower" | "subscriber" | "kicks" | "bar";

export type GoalBinding = {
  title: string;
  unit: string;
  target: number;
  current: number;
  showUnit: boolean;
  onChange: (
    patch: Partial<{ title: string; unit: string; target: number; current: number }>,
  ) => void;
  /** Applies progress straight away. Without it the new value is only written to the draft. */
  onBump?: (delta: number) => void;
};

export function goalKindFor(type: WidgetType, config: Record<string, unknown>): GoalKind {
  if (type === "KICKS_GOAL") return "kicks";
  if (type === "DONATION_GOAL") return "donation";
  if (type === "FOLLOWER_GOAL") return "follower";
  if (type === "SUBSCRIBER_GOAL") return "subscriber";
  if (type === "GOAL_BAR") {
    const goalType = config["goalType"];
    if (goalType === "DONATION") return "donation";
    if (goalType === "FOLLOWER") return "follower";
    if (goalType === "SUBSCRIBER") return "subscriber";
  }
  return "bar";
}

/** Goals that keep title, target and current inside the widget config itself. */
export function configGoalBinding(
  type: WidgetType,
  config: Record<string, unknown>,
  set: (key: string, value: unknown) => void,
): GoalBinding {
  const parsed =
    type === "KICKS_GOAL"
      ? { ...parseKicksGoalConfig(config), unit: "" }
      : isSplitGoalKind(type)
        ? parseSplitGoalConfig(type, config)
        : { ...parseKicksGoalConfig(config), unit: "" };
  const showUnit = type === "DONATION_GOAL" || type === "CUSTOM_GOAL";
  const rawUnit = typeof config["unit"] === "string" ? config["unit"] : parsed.unit;
  return {
    title: typeof config["title"] === "string" ? config["title"] : parsed.title,
    unit: rawUnit,
    target: parsed.target,
    current: parsed.current,
    showUnit,
    onChange: (patch) => {
      for (const [key, value] of Object.entries(patch)) set(key, value);
    },
    onBump: (delta) => set("current", Math.max(0, parsed.current + delta)),
  };
}

const QUICK_AMOUNTS = [1, 5, 10, 25, 50, 100];

export function GoalWidgetFields({
  type,
  config,
  set,
  binding,
  progressExtra,
  testPanel,
}: {
  type: WidgetType;
  config: Record<string, unknown>;
  set: (key: string, value: unknown) => void;
  binding: GoalBinding;
  progressExtra?: ReactNode;
  testPanel?: ReactNode;
}) {
  const { t } = useLanguage();
  const [pane, setPane] = useState<Pane>("layout");
  const [custom, setCustom] = useState("");
  const style = parseGoalConfig(config);
  const layout = parseGoalLayout(config);
  const kind = goalKindFor(type, config);
  const classic = layout === "classic";
  const applyCustom = () => {
    const value = Number(custom);
    if (!Number.isFinite(value) || value === 0) return;
    if (binding.onBump) binding.onBump(value);
    else binding.onChange({ current: Math.max(0, binding.current + value) });
    setCustom("");
  };

  return (
    <div className="space-y-3" data-widget-panes="goal">
      <PaneTabs value={pane} onChange={setPane} label={t("std.tabs.aria")} />

      {pane === "layout" ? (
        <PaneBody>
          <PaneSection title={t("std.layout.title")} hint={t("std.layout.goal.hint")}>
            <LayoutCards
              value={layout}
              onChange={(id) => set("layout", parseGoalLayout({ layout: id }))}
              options={GOAL_LAYOUTS.map((id) => ({
                id,
                label: t(`layout.goal.${id}`),
                mini: (
                  <GoalMini
                    layout={id}
                    kind={kind}
                    config={config}
                    title={binding.title || "—"}
                    unit={binding.unit}
                  />
                ),
              }))}
            />
          </PaneSection>
        </PaneBody>
      ) : pane === "display" ? (
        <PaneBody>
          <label className="block">
            <span className={paneLabelClass}>{t("widget.kicks.title")}</span>
            <input
              className={`${paneFieldClass} mt-2`}
              value={binding.title}
              onChange={(event) => binding.onChange({ title: event.target.value })}
            />
          </label>
          {binding.showUnit ? (
            <label className="block">
              <span className={paneLabelClass}>
                {t(kind === "donation" ? "goal.field.currency" : "goal.field.unit")}
              </span>
              <input
                className={`${paneFieldClass} mt-2`}
                value={binding.unit}
                maxLength={16}
                onChange={(event) => binding.onChange({ unit: event.target.value })}
              />
            </label>
          ) : null}
          <PaneSection title={t("std.display.typography")}>
            <FontField value={style.fontFamily} onChange={(next) => set("fontFamily", next)} />
            {classic ? (
              <RangeField
                label={t("std.fontSize")}
                value={style.fontSize}
                min={20}
                max={120}
                suffix="px"
                onChange={(next) => set("fontSize", next)}
              />
            ) : null}
          </PaneSection>
          <PaneSection title={t("std.display.colors")}>
            <ColorField
              label={t("widget.kicks.accent")}
              value={style.accentColor}
              onChange={(next) => set("accentColor", next)}
            />
            <ColorField
              label={t("widget.kicks.text")}
              value={style.textColor}
              onChange={(next) => set("textColor", next)}
            />
            {classic ? (
              <>
                <ColorField
                  label={t("widget.kicks.track")}
                  value={style.backgroundColor}
                  onChange={(next) => set("backgroundColor", next)}
                />
                <RangeField
                  label={t("std.opacity")}
                  value={style.backgroundOpacity}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(next) => set("backgroundOpacity", next)}
                />
              </>
            ) : null}
          </PaneSection>
        </PaneBody>
      ) : (
        <PaneBody>
          <SwitchField
            label={t("std.goal.showPercent")}
            checked={style.showPercent}
            onChange={(next) => set("showPercent", next)}
          />
          <PaneSection title={t("std.goal.progress")} hint={t("std.goal.progressHint")}>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={paneLabelClass}>{t("goal.field.target")}</span>
                <input
                  type="number"
                  min={1}
                  className={`${paneFieldClass} mt-2`}
                  value={binding.target}
                  onChange={(event) => binding.onChange({ target: Number(event.target.value) })}
                />
              </label>
              <label className="block">
                <span className={paneLabelClass}>{t("goal.field.current")}</span>
                <input
                  type="number"
                  min={0}
                  className={`${paneFieldClass} mt-2`}
                  value={binding.current}
                  onChange={(event) => binding.onChange({ current: Number(event.target.value) })}
                />
              </label>
            </div>
            <p className="font-mono text-xl font-bold tabular-nums" dir="ltr">
              {binding.current.toLocaleString("en-US")}
              <span className="text-sm text-muted-foreground">
                {" "}
                / {binding.target.toLocaleString("en-US")}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:border-primary hover:text-primary"
                  onClick={() =>
                    binding.onBump
                      ? binding.onBump(amount)
                      : binding.onChange({ current: binding.current + amount })
                  }
                >
                  +{amount}
                </button>
              ))}
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:border-primary hover:text-primary"
                onClick={() =>
                  binding.onBump
                    ? binding.onBump(-5)
                    : binding.onChange({ current: Math.max(0, binding.current - 5) })
                }
              >
                −5
              </button>
            </div>
            <div className="flex gap-2">
              <input
                inputMode="decimal"
                placeholder={t("std.goal.custom")}
                aria-label={t("std.goal.custom")}
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyCustom();
                  }
                }}
                className={`${paneFieldClass} flex-1`}
              />
              <button
                type="button"
                onClick={applyCustom}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
              >
                {t("std.goal.apply")}
              </button>
            </div>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() =>
                binding.onBump ? binding.onBump(-binding.current) : binding.onChange({ current: 0 })
              }
            >
              {t("std.goal.reset")}
            </button>
            {progressExtra}
          </PaneSection>
          {testPanel ? <PaneSection title={t("std.goal.test")}>{testPanel}</PaneSection> : null}
        </PaneBody>
      )}
    </div>
  );
}
