import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export const subathonFieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
export const subathonLabelClass =
  "text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground";

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean | undefined;
  className?: string | undefined;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-primary" : "bg-white/20",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-white transition-all",
          checked ? "start-[22px]" : "start-0.5",
        )}
      />
    </button>
  );
}

export function SwitchField({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint ? <span className="block text-[10px] text-muted-foreground">{hint}</span> : null}
      </span>
      <Switch checked={checked} onChange={onChange} label={label} disabled={disabled} className="mt-0.5" />
    </div>
  );
}

export function SettingsWell({
  title,
  hint,
  children,
}: {
  title?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="surface-inset space-y-4 p-4">
      {title ? (
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function CollapsibleSection({
  title,
  hint,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="surface-inset overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-start transition-colors hover:bg-white/[0.03]"
      >
        {icon ? (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          {hint ? <span className="block text-[11px] text-muted-foreground">{hint}</span> : null}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? <div className="border-t border-white/8 p-3.5">{children}</div> : null}
    </section>
  );
}
