import { ChevronDown } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function HowItWorks({
  title,
  steps,
  note,
  className,
}: {
  title?: string;
  steps: readonly string[];
  note?: string;
  className?: string;
}) {
  const { t } = useLanguage();
  const resolvedTitle = title ?? t("common.howItWorks");

  return (
    <Collapsible className={cn("rounded-xl border border-white/[0.06]", className)}>
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-[0.82rem] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground">
        {resolvedTitle}
        <ChevronDown
          className="size-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="space-y-2 px-3 pb-3 text-[0.82rem]">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-zinc-800 text-[0.68rem] font-semibold text-zinc-300">
                {index + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
        {note ? <p className="px-3 pb-3 text-[0.72rem] text-muted-foreground">{note}</p> : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
