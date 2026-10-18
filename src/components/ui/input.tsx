import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-1 text-base text-foreground shadow-sm transition-[border-color,box-shadow,background-color] duration-200",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground/80",
          "focus-visible:outline-none focus-visible:border-[#bee1fc]/50 focus-visible:ring-1 focus-visible:ring-[#bee1fc]/40",
          "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "[&:-webkit-autofill]:[-webkit-text-fill-color:theme(colors.zinc.100)] [&:-webkit-autofill]:[transition:background-color_9999s_ease-in-out_0s]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
