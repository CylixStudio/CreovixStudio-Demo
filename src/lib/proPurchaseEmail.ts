/**
 * @deprecated Prefer `@/lib/email` templates + `@/lib/email.server` sendTemplateEmail.
 * Kept as a thin wrapper for any remaining imports.
 */
import { buildProActivationTemplate } from "@/lib/email/templates";
import type { ProBillingInterval } from "@/lib/plans";

export type ProCodeEmailParams = {
  toEmail: string;
  code: string;
  interval: ProBillingInterval | "lifetime" | "custom";
  durationDays: number;
  siteUrl: string;
  locale?: "ar" | "en";
};

export function buildProActivationEmail(params: ProCodeEmailParams) {
  return buildProActivationTemplate({
    siteUrl: params.siteUrl,
    code: params.code,
    interval: params.interval,
    durationDays: params.durationDays,
    locale: params.locale ?? "ar",
  });
}
