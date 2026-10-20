import type { ReactNode } from "react";

import { DarkSelect } from "@/components/ui/dark-select";
import { useLanguage } from "@/lib/i18n";
import { OVERLAY_FONTS } from "@/lib/overlayTheme";

export type Pane = "layout" | "display" | "extra";

export const paneLabelClass =
  "text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground";
export const paneFieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
export const paneInlineFieldClass =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

export function FontField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useLanguage();
  const known = OVERLAY_FONTS.some((font) => font.value === value);
  return (
    <label className="block">
      <span className={paneLabelClass}>{t("std.font")}</span>
      <DarkSelect
        className="mt-2"
        value={value}
        onValueChange={onChange}
        aria-label={t("std.font")}
        options={[
          ...OVERLAY_FONTS.map((font) => ({ value: font.value, label: font.label })),
          ...(known ? [] : [{ value, label: value.split(",")[0]?.replace(/['"]/g, "") ?? value }]),
        ]}
      />
    </label>
  );
}

export function PaneTabs({
  value,
  onChange,
  label,
}: {
  value: Pane;
  onChange: (next: Pane) => void;
  label: string;
}) {
  const { t } = useLanguage();
  const tabs: [Pane, string][] = [
    ["layout", t("std.tab.layout")],
    ["display", t("std.tab.display")],
    ["extra", t("std.tab.extra")],
  ];
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-1 rounded-xl border border-white/8 bg-black/20 p-1"
    >
      {tabs.map(([id, text]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          data-pane={id}
          onClick={() => onChange(id)}
          className={`flex-1 rounded-lg px-2 py-1.5 text-[0.72rem] font-semibold ${
            value === id
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function PaneBody({ children }: { children: ReactNode }) {
  return <div className="surface-inset space-y-4 p-4">{children}</div>;
}

export function PaneSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function SwitchField({
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
        aria-label={label}
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

export function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (next: number) => void;
}) {
  return (
    <label className="block">
      <span className={paneLabelClass}>
        {label} ({value}
        {suffix})
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        className="mt-3 w-full accent-primary"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const safe = /^#([0-9a-f]{6})$/i.test(value) ? value : expandHex(value);
  return (
    <label className="flex min-w-0 items-center justify-between gap-3 text-xs text-muted-foreground">
      <span className="min-w-0">{label}</span>
      <input
        type="color"
        value={safe}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-background"
      />
    </label>
  );
}

function expandHex(value: string): string {
  const match = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  if (!match) return "#ffffff";
  return `#${match[1]}${match[1]}${match[2]}${match[2]}${match[3]}${match[3]}`;
}

export type LayoutCardOption = { id: string; label: string; mini: ReactNode };

/** Small design cards. Each mini preview is drawn from the same markup the overlay renders. */
export function LayoutCards({
  value,
  options,
  onChange,
  columns = 2,
}: {
  value: string;
  options: LayoutCardOption[];
  onChange: (id: string) => void;
  columns?: 2 | 3;
}) {
  return (
    <div
      className={`grid items-stretch gap-2 ${columns === 3 ? "grid-cols-3" : "grid-cols-2"}`}
      role="group"
    >
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            data-layout-id={option.id}
            onClick={() => onChange(option.id)}
            className={`flex h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-black/20 text-start transition-colors hover:border-primary/50 ${
              selected ? "border-primary" : "border-border"
            }`}
          >
            <div
              className="bg-[repeating-conic-gradient(#1b1b1b_0%_25%,#111_0%_50%)] bg-[length:12px_12px]"
              dir="ltr"
              aria-hidden
            >
              {option.mini}
            </div>
            <span className="flex min-h-11 items-center px-2 py-1.5 text-xs font-semibold leading-snug break-words">
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
