import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Plus } from "lucide-react";
import type { AlertKind } from "@/lib/alertStudio";

interface TestAlertPopoverProps {
  label: string;
  alertId: AlertKind;
  requiresInput: boolean;
  onTest: (customValue?: number) => void;
  disabled?: boolean;
  defaultValue?: number;
  min?: number;
  max?: number;
}

export function TestAlertPopover({
  label,
  alertId,
  requiresInput,
  onTest,
  disabled = false,
  defaultValue = 1,
  min = 1,
  max = 100000,
}: TestAlertPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customValue, setCustomValue] = useState(String(defaultValue));

  if (!requiresInput) {
    // Direct button - no popover
    return (
      <button
        type="button"
        className="alert-button test-button"
        disabled={disabled}
        onClick={() => onTest()}
      >
        <Plus size={17} />
        {label}
      </button>
    );
  }

  // Popover version
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" className="alert-button test-button" disabled={disabled}>
          <Plus size={17} />
          {label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 p-3">
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            <span>Choose type:</span>
          </label>
          <div className="space-y-1.5">
            <DropdownMenuItem
              onClick={() => {
                onTest();
                setIsOpen(false);
              }}
              className="cursor-pointer"
            >
              Auto (默认值)
            </DropdownMenuItem>
            <div className="border-t border-white/10 py-1.5">
              <div className="px-2 py-1.5">
                <label className="text-xs text-muted-foreground">
                  <input
                    type="number"
                    min={min}
                    max={max}
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    className="mr-2 w-16 rounded border border-border bg-background px-2 py-1 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = Number(customValue);
                        if (Number.isSafeInteger(val) && val >= min && val <= max) {
                          onTest(val);
                          setIsOpen(false);
                        }
                      }
                    }}
                  />
                  Custom
                </label>
              </div>
              <DropdownMenuItem
                onClick={() => {
                  const val = Number(customValue);
                  if (Number.isSafeInteger(val) && val >= min && val <= max) {
                    onTest(val);
                    setIsOpen(false);
                  }
                }}
                className="cursor-pointer text-xs"
              >
                Send Custom
              </DropdownMenuItem>
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
