import { createFileRoute, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useEffect } from "react";

import { GatewayPage } from "@/components/onboarding/GatewayPage";
import { useSubscription } from "@/hooks/useSubscription";
import { isGatewayCompleted } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/welcome")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "CylixStudio — Welcome" },
      {
        name: "description",
        content:
          "Choose Free or Pro and start streaming with CylixStudio across Twitch, Kick, YouTube and TikTok.",
      },
      { property: "og:title", content: "CylixStudio — Welcome" },
      {
        property: "og:description",
        content: "Multi-platform streaming tools. Pick Free or Pro, or redeem a prepaid code.",
      },
    ],
  }),
  component: WelcomeRoute,
});

function WelcomeRoute() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const subscription = useSubscription(user.id);
  const navigate = useNavigate();

  useEffect(() => {
    if (!subscription.isSuccess) return;
    // Active Pro / lifetime users who already finished the gateway skip straight to the hub.
    if (subscription.data.isActive && isGatewayCompleted()) {
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [subscription.isSuccess, subscription.data?.isActive, navigate]);

  return <GatewayPage />;
}
