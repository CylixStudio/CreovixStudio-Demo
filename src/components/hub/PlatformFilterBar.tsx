import type { ReactNode } from "react";
import { InfoTip } from "@/components/ui/info-tip";

export type PlatformFilterOption = {
  id: string;
  label: string;
  /** Platform colour used for the active label. The "all" option has none. */
  color?: string;
  glyph: ReactNode;
};

/** Small coloured dot used as the platform mark in the filter bar. */
export function FilterDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ background: color }}
    />
  );
}

/**
 * Compact platform filter shared by Home and Activity Feed. Clicking the active
 * platform again returns to `allId`. The bar wraps instead of scrolling, so it never
 * creates a horizontal scrollbar on narrow screens.
 */
export function PlatformFilterBar({
  options,
  value,
  onChange,
  allId,
  ariaLabel,
  tip,
  className = "",
}: {
  options: PlatformFilterOption[];
  value: string;
  onChange: (id: string) => void;
  allId: string;
  ariaLabel: string;
  tip?: string | undefined;
  className?: string;
}) {
  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      className={`flex flex-wrap items-center gap-1 px-0.5 ${className}`}
    >
      {tip ? <InfoTip text={tip} /> : null}
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active && option.id !== allId ? allId : option.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.72rem] leading-none transition-colors ${
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            style={active && option.color ? { color: option.color } : undefined}
          >
            {option.glyph}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
