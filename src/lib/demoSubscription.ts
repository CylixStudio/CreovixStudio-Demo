import { getDemoDb } from "@/demo/context";
import { DEMO_USER_ID, isDemoBuild } from "@/lib/demoMode";

export type DemoSubscriptionPlan = "free" | "pro";

/** Changes only the visitor's local Demo subscription; no billing or activation calls. */
export async function setDemoSubscriptionPlan(userId: string, plan: DemoSubscriptionPlan): Promise<void> {
  if (!isDemoBuild() || typeof window === "undefined" || userId !== DEMO_USER_ID) {
    throw new Error("The Demo plan switch is available only for the local Demo account.");
  }
  if (plan !== "free" && plan !== "pro") throw new Error("Unknown Demo plan.");
  const { error } = await getDemoDb().from("user_subscriptions").upsert({
    user_id: userId,
    subscription_status: plan === "pro" ? "active" : "inactive",
    expires_at: null,
    active_code: plan === "pro" ? "DEMO" : null,
    is_lifetime: plan === "pro",
  }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}
