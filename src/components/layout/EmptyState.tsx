import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** TanStack route path — renders a Link CTA when set (takes priority over onAction). */
  actionTo?: "/settings" | (string & {});
  className?: string;
  children?: ReactNode;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionTo,
  className,
  children,
}: EmptyStateProps) {
  const showAction = Boolean(actionLabel && (actionTo || onAction));

  return (
    <div
      className={cn(
        "grid place-items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-12 text-center",
        className,
      )}
      role="status"
    >
      {Icon ? (
        <span className="grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-muted-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
      ) : null}

      <div className="max-w-md space-y-1.5">
        <h3 className="text-[0.95rem] font-semibold tracking-tight text-foreground">{title}</h3>
        {description ? (
          <p className="text-[0.82rem] leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {showAction ? (
        actionTo ? (
          <Button asChild className="mt-1">
            <Link to={actionTo}>{actionLabel}</Link>
          </Button>
        ) : (
          <Button type="button" className="mt-1" onClick={onAction}>
            {actionLabel}
          </Button>
        )
      ) : null}

      {children}
    </div>
  );
}
