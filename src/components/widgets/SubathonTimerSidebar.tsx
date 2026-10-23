import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy, FlaskConical, ListChecks, Link2, Sparkles, Timer } from "lucide-react";

import { DarkSelect } from "@/components/ui/dark-select";
import { InfoTip } from "@/components/ui/info-tip";
import { OverlayView } from "@/components/overlay/OverlayView";
import { SubathonElementControlPanel } from "@/components/widgets/SubathonElementControlPanel";
import {
  CollapsibleSection,
  SettingsWell,
  SwitchField,
  subathonFieldClass as fieldClass,
  subathonLabelClass as labelClass,
} from "@/components/widgets/SubathonUi";
import { TestSimulatePanel } from "@/components/widgets/TestSimulatePanel";
import { WidgetRulesPanel } from "@/components/widgets/WidgetRulesPanel";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import {
  OVERLAY_ANIMATIONS,
  OVERLAY_FONTS,
  OVERLAY_FONT_STYLESHEET,
  OVERLAY_LAYOUTS,
  OVERLAY_TIME_FORMATS,
  parseOverlayTheme,
  type OverlayLayout,
  type OverlayTheme,
} from "@/lib/overlayTheme";
import type { TimerFrame } from "@/lib/timer";
import { cn } from "@/lib/utils";
import { LayoutCards } from "@/components/widgets/builderUi";

type TabId = "layout" | "display" | "extra";
type ExtraSectionId = "motion" | "timer" | "rules" | "test" | "obs";

const TABS: { id: TabId; labelKey: TranslationKey }[] = [
  { id: "layout", labelKey: "sub.tab.layout" },
  { id: "display", labelKey: "sub.tab.display" },
  { id: "extra", labelKey: "sub.tab.extra" },
];

export const LAYOUT_KEY: Record<OverlayLayout, { name: TranslationKey; hint: TranslationKey }> = {
  split_clock: { name: "sub.layout.split_clock", hint: "sub.layout.split_clock.hint" },
  broadcast: { name: "sub.layout.broadcast", hint: "sub.layout.broadcast.hint" },
  island: { name: "sub.layout.island", hint: "sub.layout.island.hint" },
  cute_heart: { name: "sub.layout.cute_heart", hint: "sub.layout.cute_heart.hint" },
  circular_pomodoro: { name: "sub.layout.circular_pomodoro", hint: "sub.layout.circular_pomodoro.hint" },
  multi_ring_countdown: { name: "sub.layout.multi_ring_countdown", hint: "sub.layout.multi_ring_countdown.hint" },
  raw_digits: { name: "sub.layout.raw_digits", hint: "sub.layout.raw_digits.hint" },
};

const TIME_FORMAT_KEY: Record<OverlayTheme["timeFormat"], TranslationKey> = {
  dhms: "sub.timeFormat.dhms",
  hms: "sub.timeFormat.hms",
  ms: "sub.timeFormat.ms",
};

export const ANIMATION_KEY: Record<OverlayTheme["animation"], TranslationKey> = {
  none: "sub.anim.none",
  pulse: "sub.anim.pulse",
  flash: "sub.anim.flash",
  bounce: "sub.anim.bounce",
};

const PREVIEW_SECONDS = 3 * 3600 + 25 * 60 + 45;

function useOverlayFonts() {
  useEffect(() => {
    if (document.querySelector(`link[href="${OVERLAY_FONT_STYLESHEET}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = OVERLAY_FONT_STYLESHEET;
    document.head.appendChild(link);
  }, []);
}

/** Renders the real overlay renderer at thumbnail size so the card matches what OBS draws. */
export function LayoutMini({ theme, layout }: { theme: OverlayTheme; layout: OverlayLayout }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const mini: OverlayTheme = {
    ...theme,
    layout,
    fontSize: 44,
    animation: "none",
    showAddedPopups: false,
  };

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const body = bodyRef.current;
    if (!frame || !body) return;
    const fit = () => {
      const w = body.offsetWidth;
      const h = body.offsetHeight;
      if (!w || !h) return;
      setScale(Math.min(0.5, ((frame.clientWidth - 16) / w), ((frame.clientHeight - 12) / h)));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    observer.observe(body);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frameRef}
      className="pointer-events-none relative h-[92px] overflow-hidden bg-[repeating-conic-gradient(#1c1d24_0%_25%,#121318_0%_50%)] bg-[length:12px_12px]"
      aria-hidden
    >
      <div
        ref={bodyRef}
        className="absolute left-1/2 top-1/2 w-max"
        dir="ltr"
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        <OverlayView theme={mini} remaining={PREVIEW_SECONDS} frame={null} />
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
      <input
        type="color"
        className="mt-2 h-9 w-full cursor-pointer rounded-lg border border-border bg-background"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function RangeField({
  label,
  valueLabel,
  tip,
  hint,
  ...input
}: {
  label: string;
  valueLabel: string;
  tip?: string;
  hint?: string;
  min: number;
  max: number;
  value: number;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  return (
    <label className="block">
      <span className={`${labelClass} flex items-center gap-1.5`}>
        {label}
        <span className="text-foreground" dir="ltr">
          {valueLabel}
        </span>
        {tip ? <InfoTip text={tip} /> : null}
      </span>
      <input
        type="range"
        min={input.min}
        max={input.max}
        className="mt-3 w-full accent-primary"
        value={input.value}
        disabled={input.disabled}
        onChange={(event) => input.onChange(Number(event.target.value))}
      />
      {hint ? <span className="mt-1 block text-[10px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function SubathonTimerSidebar({
  widgetId,
  subathonId,
  publicToken,
  name,
  onNameChange,
  config,
  onConfigChange,
  frame,
  remaining,
  onSaveConfig,
  onCopyUrl,
  copied,
}: {
  widgetId: string;
  subathonId: string | null;
  publicToken: string;
  name: string;
  onNameChange: (next: string) => void;
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
  frame: TimerFrame | null;
  remaining: number;
  onSaveConfig: () => Promise<unknown> | void;
  onCopyUrl: () => void;
  copied: boolean;
  lang?: "ar" | "en";
}) {
  const [tab, setTab] = useState<TabId>("layout");
  const [openSections, setOpenSections] = useState<Set<ExtraSectionId>>(() => new Set(["motion"]));
  const { t } = useLanguage();
  const theme = parseOverlayTheme(config);
  useOverlayFonts();

  const toggleSection = (id: ExtraSectionId) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const section = (
    id: ExtraSectionId,
    icon: ReactNode,
    title: TranslationKey,
    hint: TranslationKey,
    children: ReactNode,
  ) => (
    <CollapsibleSection
      title={t(title)}
      hint={t(hint)}
      icon={icon}
      open={openSections.has(id)}
      onToggle={() => toggleSection(id)}
    >
      {children}
    </CollapsibleSection>
  );

  return (
    <div className="space-y-4">
      <label className="block">
        <span className={labelClass}>{t("sub.name")}</span>
        <input
          className={`${fieldClass} mt-2`}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          dir="auto"
        />
      </label>

      <div
        role="tablist"
        aria-label={t("sub.settingsAria")}
        className="flex gap-1 rounded-xl border border-white/8 bg-black/20 p-1"
      >
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => setTab(entry.id)}
            className={cn(
              "flex-1 rounded-lg px-2 py-1.5 text-[0.72rem] font-semibold",
              tab === entry.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(entry.labelKey)}
          </button>
        ))}
      </div>

      {tab === "layout" ? (
        <div className="space-y-4" role="tabpanel">
          <SettingsWell title={t("sub.layout.title")} hint={t("sub.layout.subtitle")}>
            <LayoutCards widgetType="SUBATHON_TIMER" mini ariaLabel={t("layout.picker")}
              value={theme.layout} onSelect={next => onConfigChange("layout", next)}
              options={OVERLAY_LAYOUTS.map(entry => ({ value: entry.value, label: t(LAYOUT_KEY[entry.value].name) }))}
              renderPreview={next => <LayoutMini theme={theme} layout={next as OverlayLayout} />} />
            <p className="text-[10px] text-muted-foreground">{t(LAYOUT_KEY[theme.layout].hint)}</p>
          </SettingsWell>

          <SettingsWell>
            <label className="block">
              <span className={`${labelClass} inline-flex items-center gap-1.5`}>
                {t("sub.timeFormat")}
                <InfoTip text={t("tooltips.subathon.timeFormat")} />
              </span>
              <DarkSelect
                className="mt-2 text-foreground"
                contentClassName="bg-popover text-popover-foreground"
                value={theme.timeFormat}
                onValueChange={(next) => onConfigChange("timeFormat", next)}
                options={OVERLAY_TIME_FORMATS.map((entry) => ({
                  value: entry.value,
                  label: t(TIME_FORMAT_KEY[entry.value]),
                }))}
              />
            </label>
          </SettingsWell>
        </div>
      ) : null}

      {tab === "display" ? (
        <div className="space-y-4" role="tabpanel">
          <SettingsWell title={t("sub.display.typography")}>
            <label className="block">
              <span className={labelClass}>{t("sub.font")}</span>
              <DarkSelect
                className="mt-2 text-foreground"
                contentClassName="bg-popover text-popover-foreground"
                value={theme.fontFamily}
                onValueChange={(next) => onConfigChange("fontFamily", next)}
                options={OVERLAY_FONTS.map((font) => ({
                  value: font.value,
                  label: font.value.startsWith("system-ui") ? t("sub.font.system") : font.label,
                }))}
              />
            </label>
            <RangeField
              label={t("sub.fontSize")}
              valueLabel={`${theme.fontSize}px`}
              hint={t("sub.fontSize.hint")}
              min={16}
              max={220}
              value={theme.fontSize}
              onChange={(next) => onConfigChange("fontSize", next)}
            />
          </SettingsWell>

          <SettingsWell title={t("sub.display.colors")}>
            <div className="grid grid-cols-3 gap-2">
              <ColorField
                label={t("sub.color.accent")}
                value={theme.accentColor}
                onChange={(next) => onConfigChange("accentColor", next)}
              />
              <ColorField
                label={t("sub.color.text")}
                value={theme.textColor}
                onChange={(next) => onConfigChange("textColor", next)}
              />
              <ColorField
                label={t("sub.color.background")}
                value={theme.backgroundColor}
                onChange={(next) => onConfigChange("backgroundColor", next)}
              />
            </div>
            <RangeField
              label={t("sub.opacity")}
              valueLabel={`${theme.backgroundOpacity}%`}
              tip={t("tooltips.subathon.opacity")}
              min={0}
              max={100}
              value={theme.backgroundOpacity}
              disabled={theme.hideBackground}
              onChange={(next) => onConfigChange("backgroundOpacity", next)}
            />
            <SwitchField
              label={t("sub.hideBackground")}
              hint={t("sub.hideBackground.hint")}
              checked={theme.hideBackground}
              onChange={(next) => onConfigChange("hideBackground", next)}
            />
          </SettingsWell>

          <SettingsWell title={t("sub.display.visibility")}>
            <SwitchField
              label={t("sub.showTitle")}
              hint={t("sub.showTitle.hint")}
              checked={theme.showLabel}
              onChange={(next) => onConfigChange("showLabel", next)}
            />
            {theme.showLabel ? (
              <label className="block">
                <span className={labelClass}>{t("sub.titleText")}</span>
                <input
                  className={`${fieldClass} mt-2`}
                  value={theme.label}
                  maxLength={40}
                  dir="auto"
                  onChange={(event) => onConfigChange("label", event.target.value)}
                />
              </label>
            ) : null}
            <SwitchField
              label={t("sub.showStatus")}
              hint={t("sub.showStatus.hint")}
              checked={theme.showStatus}
              onChange={(next) => onConfigChange("showStatus", next)}
            />
          </SettingsWell>
        </div>
      ) : null}

      {tab === "extra" ? (
        <div className="space-y-2.5" role="tabpanel">
          {section(
            "motion",
            <Sparkles className="size-4" aria-hidden />,
            "sub.extra.motion",
            "sub.extra.motion.hint",
            <div className="space-y-4">
              <label className="block">
                <span className={labelClass}>{t("sub.animation")}</span>
                <DarkSelect
                  className="mt-2 text-foreground"
                  contentClassName="bg-popover text-popover-foreground"
                  value={theme.animation}
                  onValueChange={(next) => onConfigChange("animation", next)}
                  options={OVERLAY_ANIMATIONS.map((entry) => ({
                    value: entry.value,
                    label: t(ANIMATION_KEY[entry.value]),
                  }))}
                />
              </label>
              <SwitchField
                label={t("sub.popups")}
                hint={t("sub.popups.hint")}
                checked={theme.showAddedPopups}
                onChange={(next) => onConfigChange("showAddedPopups", next)}
              />
            </div>,
          )}

          {section(
            "timer",
            <Timer className="size-4" aria-hidden />,
            "sub.extra.timer",
            "sub.extra.timer.hint",
            <SubathonElementControlPanel
              widgetId={widgetId}
              subathonId={subathonId}
              frame={frame}
              remaining={remaining}
              config={config}
              onConfigChange={onConfigChange}
              onSaveConfig={onSaveConfig}
              embedded
            />,
          )}

          {section(
            "rules",
            <ListChecks className="size-4" aria-hidden />,
            "sub.extra.rules",
            "sub.extra.rules.hint",
            <WidgetRulesPanel widgetId={widgetId} subathonId={subathonId} compact />,
          )}

          {section(
            "test",
            <FlaskConical className="size-4" aria-hidden />,
            "sub.extra.test",
            "sub.extra.test.hint",
            <TestSimulatePanel widgetId={widgetId} widgetType="SUBATHON_TIMER" />,
          )}

          {section(
            "obs",
            <Link2 className="size-4" aria-hidden />,
            "sub.extra.obs",
            "sub.extra.obs.hint",
            <div>
              <button
                type="button"
                onClick={onCopyUrl}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:border-primary hover:text-primary"
              >
                {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {t("sub.obs.copy")}
              </button>
              <code className="mt-3 block break-all text-xs text-muted-foreground" dir="ltr">
                {`/overlay/${publicToken}`}
              </code>
            </div>,
          )}
        </div>
      ) : null}
    </div>
  );
}
