import type { CSSProperties, ComponentProps } from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={
        {
          "--normal-bg": "#18181b",
          "--normal-border": "color-mix(in oklab, #bee1fc 35%, transparent)",
          "--normal-text": "#f4f4f5",
          "--success-bg": "#18181b",
          "--success-border": "color-mix(in oklab, #bee1fc 40%, transparent)",
          "--success-text": "#f4f4f5",
          "--error-bg": "#1c1414",
          "--error-border": "color-mix(in oklab, #f87171 45%, transparent)",
          "--error-text": "#fecaca",
          "--warning-bg": "#18181b",
          "--warning-border": "color-mix(in oklab, #bee1fc 35%, transparent)",
          "--warning-text": "#f4f4f5",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "group toast !rounded-xl !border !bg-zinc-900 !text-zinc-50 !shadow-[0_16px_40px_-20px_rgba(0,0,0,0.75)] group-[.toaster]:border-[#bee1fc]/30",
          title: "!text-zinc-50",
          description: "!text-zinc-400",
          actionButton: "!rounded-full !bg-[#bee1fc] !text-[#0a0a0a] !font-semibold",
          cancelButton: "!rounded-full !bg-zinc-800 !text-zinc-300",
          icon: "!text-[#bee1fc]",
          error: "group-[.toaster]:!border-red-400/40 [&_[data-icon]]:!text-red-300",
          success: "group-[.toaster]:!border-[#bee1fc]/35 [&_[data-icon]]:!text-[#bee1fc]",
          warning: "group-[.toaster]:!border-[#bee1fc]/35 [&_[data-icon]]:!text-[#bee1fc]",
          info: "group-[.toaster]:!border-[#bee1fc]/35 [&_[data-icon]]:!text-[#bee1fc]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
