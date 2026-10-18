import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type DarkSelectOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

type DarkSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: DarkSelectOption[];
  placeholder?: string;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
  "aria-label"?: string;
};

/**
 * Fully styled dark-mode select. Replaces native <select> everywhere so the
 * options never render with the browser's default white popup.
 */
export function DarkSelect({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  contentClassName,
  disabled,
  ...rest
}: DarkSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled ?? false}>
      <SelectTrigger className={cn("h-11", className)} aria-label={rest["aria-label"]}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled ?? false}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
