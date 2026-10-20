import type { ReactNode } from "react";

import { useLanguage } from "@/lib/i18n";

export type BuilderPane = "layout" | "display" | "extra";

const ALL_PANES: BuilderPane[] = ["layout", "display", "extra"];

/**
 * The Layout | Display | Extra switcher shared by every widget builder. Pass `panes`
 * without "layout" for widgets that have no real layout choices (no invented ones).
 */
export function BuilderTabs({
  value,
  onChange,
  label,
  panes = ALL_PANES,
}: {
  value: BuilderPane;
  onChange: (next: BuilderPane) => void;
  label: string;
  panes?: BuilderPane[];
}) {
  const { t } = useLanguage();
  return (
    <div role="tablist" aria-label={label} className="surface-inset flex gap-1 p-1">
      {panes.map((pane) => (
        <button
          key={pane}
          type="button"
          role="tab"
          aria-selected={value === pane}
          onClick={() => onChange(pane)}
          className={`flex-1 rounded-lg px-2 py-1.5 text-[0.72rem] font-semibold transition-colors ${
            value === pane
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t(`builder.tab.${pane}` as const)}
        </button>
      ))}
    </div>
  );
}

/** Card wrapper for the content of one builder tab. */
export function BuilderCard({ children }: { children: ReactNode }) {
  return <div className="surface-card surface-card-pad space-y-4">{children}</div>;
}

/** Slider row: label with the current value, then the range input. */
export function RangeField({
  label,
  value,
  min,
  max,
  unit = "",
  tip,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  tip?: ReactNode;
  onChange: (next: number) => void;
}) {
  return (
    <label className="block">
      <span className="inline-flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label} ({value}
        {unit})
        {tip}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        className="mt-3 w-full accent-primary"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export type LayoutOption = { value: string; label: string; hint?: string };

/**
 * Visual layout picker. Each card shows `renderPreview(option.value)` scaled down; the
 * caller renders the real widget renderer with that layout, so the card is exactly what
 * the overlay will draw. Selecting a card changes the saved layout (and the renderer).
 */
export function LayoutCards({
  options,
  value,
  onSelect,
  renderPreview,
  ariaLabel,
}: {
  options: LayoutOption[];
  value: string;
  onSelect: (value: string) => void;
  renderPreview: (value: string) => ReactNode;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid grid-cols-2 gap-2.5">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(option.value)}
            className={`group min-w-0 overflow-hidden rounded-xl border text-start transition-colors ${
              selected
                ? "border-primary bg-primary/10"
                : "border-white/10 hover:border-white/25"
            }`}
          >
            <span
              aria-hidden
              dir="ltr"
              className="pointer-events-none relative block h-24 overflow-hidden bg-[repeating-conic-gradient(#161616_0%_25%,#101010_0%_50%)] bg-[length:16px_16px]"
            >
              <span className="absolute left-0 top-0 grid h-[333.33%] w-[333.33%] origin-top-left scale-[0.3] place-items-center">
                {renderPreview(option.value)}
              </span>
            </span>
            <span className="block px-2.5 py-2">
              <span className={`block truncate text-xs font-semibold ${selected ? "text-primary" : ""}`}>
                {option.label}
              </span>
              {option.hint ? (
                <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{option.hint}</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}