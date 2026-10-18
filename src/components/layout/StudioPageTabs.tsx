import { cn } from "@/lib/utils";

export type StudioPageTab<T extends string> = {
  id: T;
  label: string;
};

export function StudioPageTabs<T extends string>({
  value,
  onChange,
  items,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  items: readonly StudioPageTab<T>[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 inline-flex flex-wrap gap-1 rounded-xl border border-border/60 bg-secondary/40 p-1",
        className,
      )}
      role="tablist"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          className={cn(
            "rounded-lg px-3.5 py-1.5 text-[0.82rem] font-medium tracking-tight",
            "transition-[color,background-color,box-shadow,transform] duration-200 ease-out",
            value === item.id
              ? "bg-zinc-800 text-foreground shadow-sm shadow-black/30 ring-1 ring-white/8"
              : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
