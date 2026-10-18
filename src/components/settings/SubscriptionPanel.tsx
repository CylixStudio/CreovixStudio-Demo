import { useState } from "react";

import { RedeemCodeModal } from "@/components/subscription/RedeemCodeModal";
import { remainingLabel, useSubscription } from "@/hooks/useSubscription";
import { useLanguage } from "@/lib/i18n";

export function SubscriptionStatusPill({ userId }: { userId: string }) {
  const { t } = useLanguage();
  const { data } = useSubscription(userId);
  if (!data) return null;

  if (data.isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[0.68rem] font-semibold text-emerald-400">
        <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_currentColor]" />
        {remainingLabel(data.daysLeft, data.lifetime, false)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-[0.68rem] font-semibold text-red-400">
      <span className="size-1.5 rounded-full bg-red-400" />
      {data.status === "expired" ? t("settings.profile.expired") : t("settings.profile.inactive")}
    </span>
  );
}

export function SubscriptionPanel({ userId }: { userId: string }) {
  const { t } = useLanguage();
  const subscription = useSubscription(userId);
  const [redeem, setRedeem] = useState(false);
  const data = subscription.data;

  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <p className="text-[0.8rem] text-muted-foreground">{t("settings.profile.subscription")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <SubscriptionStatusPill userId={userId} />
          {data?.expiresAt && data.isActive && !data.lifetime ? (
            <span className="text-[0.78rem] text-muted-foreground">
              {t("settings.profile.expires")} {new Date(data.expiresAt).toLocaleDateString()}
            </span>
          ) : null}
        </div>
        <p className="max-w-md text-[0.72rem] leading-relaxed text-muted-foreground">
          {t("settings.profile.redeemHint")}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setRedeem(true)}
        className="w-fit shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 sm:ms-auto"
      >
        {t("settings.profile.enterCode")}
      </button>
      {redeem ? <RedeemCodeModal onClose={() => setRedeem(false)} /> : null}
    </div>
  );
}
