import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-base text-foreground shadow-sm",
          "placeholder:text-muted-foreground/80",
          "focus-visible:outline-none focus-visible:border-[#bee1fc]/50 focus-visible:ring-1 focus-visible:ring-[#bee1fc]/40",
          "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
