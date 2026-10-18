import type { ImgHTMLAttributes } from "react";

import logoMarkUrl from "@/assets/Logo/cylix-studio.png";
import logoFullUrl from "@/assets/Logo/cylix-studio-full.png";
import { cn } from "@/lib/utils";

const MARK_SIZE = {
  sm: "size-7",
  md: "size-9",
  lg: "size-12",
  xl: "size-16",
} as const;

const WORDMARK_SIZE = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
  xl: "text-2xl",
} as const;

const FULL_HEIGHT = {
  sm: "h-8",
  md: "h-10",
  lg: "h-12",
  xl: "h-14",
} as const;

export type BrandLogoProps = {
  /** Mark / full-logo height tier. */
  size?: keyof typeof MARK_SIZE;
  /**
   * `mark` — icon only (or icon + CSS wordmark).
   * `full` — official horizontal CylixStudio lockup (icon + wordmark art).
   */
  variant?: "mark" | "full";
  /** Show CSS “CylixStudio” next to the mark (ignored for `full`). */
  showWordmark?: boolean;
  /** Compact mark-only (e.g. collapsed sidebar). */
  markOnly?: boolean;
  className?: string;
  imgClassName?: string;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "width" | "height">;

/**
 * Official CylixStudio branding from `src/assets/Logo`.
 * Prefer `variant="full"` on marketing / login headers; `mark` in tight chrome.
 */
export function BrandLogo({
  size = "md",
  variant = "mark",
  showWordmark = false,
  markOnly = false,
  className,
  imgClassName,
  ...imgProps
}: BrandLogoProps) {
  if (variant === "full") {
    return (
      <span className={cn("inline-flex w-full items-center justify-center", className)}>
        <img
          src={logoFullUrl}
          alt="CylixStudio"
          decoding="async"
          className={cn(
            FULL_HEIGHT[size],
            "w-auto max-w-full object-contain object-center",
            imgClassName,
          )}
          {...imgProps}
        />
      </span>
    );
  }

  const mark = (
    <img
      src={logoMarkUrl}
      alt={markOnly || !showWordmark ? "CylixStudio" : ""}
      width={size === "xl" ? 64 : size === "lg" ? 48 : size === "md" ? 36 : 28}
      height={size === "xl" ? 64 : size === "lg" ? 48 : size === "md" ? 36 : 28}
      decoding="async"
      className={cn(
        MARK_SIZE[size],
        "shrink-0 rounded-lg object-contain",
        imgClassName,
      )}
      {...imgProps}
    />
  );

  if (markOnly || !showWordmark) {
    return (
      <span className={cn("inline-flex shrink-0 items-center", className)}>{mark}</span>
    );
  }

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      {mark}
      <span
        className={cn(
          "truncate font-semibold tracking-tight text-foreground",
          WORDMARK_SIZE[size],
        )}
      >
        CylixStudio
      </span>
    </span>
  );
}

export { logoMarkUrl as brandLogoUrl, logoFullUrl as brandLogoFullUrl };
