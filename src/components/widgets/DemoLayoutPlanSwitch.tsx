import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { DEMO_USER_ID, isDemoBuild } from "@/lib/demoMode";
import { setDemoSubscriptionPlan, type DemoSubscriptionPlan } from "@/lib/demoSubscription";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type DemoLayoutPlanSwitchProps = { userId: string; className?: string };

/** Builder-only testing control; it never opens checkout or changes a real subscription. */
export function DemoLayoutPlanSwitch({ userId, className }: DemoLayoutPlanSwitchProps) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const queryClient = useQueryClient();
  const subscription = useSubscription(userId);
  const mutation = useMutation({
    mutationFn: (plan: DemoSubscriptionPlan) => setDemoSubscriptionPlan(userId, plan),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscription", userId] }),
  });
  if (!isDemoBuild() || userId !== DEMO_USER_ID) return null;
  const pro = subscription.data?.isActive === true;
  return (
    <div className={cn("w-full min-w-0 space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3", className)}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 break-words text-xs font-medium">{ar ? "خطة الديمو · محلية فقط" : "Demo plan · local only"}</span>
        <div className="flex w-full min-w-0 flex-wrap gap-1 sm:w-auto" role="group" aria-label={ar ? "خطة اشتراك الديمو" : "Demo subscription plan"}>
          {(["free", "pro"] as const).map((plan) => (
            <Button
              key={plan}
              type="button"
              size="sm"
              className="min-w-0 flex-1 sm:flex-none"
              variant={(plan === "pro") === pro ? "default" : "outline"}
              aria-pressed={(plan === "pro") === pro}
              disabled={subscription.isPending || subscription.isError || mutation.isPending}
              onClick={() => mutation.mutate(plan)}
            >
              {plan === "pro" ? (ar ? "برو" : "Pro") : (ar ? "مجاني" : "Free")}
            </Button>
          ))}
        </div>
      </div>
      <p className="break-words text-[11px] text-muted-foreground">{ar ? "جرّب قيود التخطيطات دون دفع. تبقى التخطيطات المحفوظة دون تغيير." : "Try layout locks without payments. Saved layouts stay unchanged."}</p>
      {(mutation.error || subscription.error) && (
        <p role="alert" className="break-words text-xs text-destructive">{ar ? "تعذّر تحديث خطة الديمو أو تحميلها. حاول مرة أخرى." : (mutation.error || subscription.error)?.message}</p>
      )}
    </div>
  );
}
