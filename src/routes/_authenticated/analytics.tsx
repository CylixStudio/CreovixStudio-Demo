import { createFileRoute } from "@tanstack/react-router";

import { QuickAnalyticsOverview } from "@/components/hub/QuickAnalyticsOverview";
import { AppShell } from "@/components/layout/AppShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "CylixStudio — Analytics" },
      {
        name: "description",
        content: "Followers, subscriptions, tips and bits with flexible time ranges and chart series filters.",
      },
      { property: "og:title", content: "CylixStudio — Analytics" },
      {
        property: "og:description",
        content: "Studio metrics and trends for the period you choose.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { user } = Route.useRouteContext();
  const { data: workspace } = useWorkspace(user.id);
  const { t } = useLanguage();

  return (
    <AppShell
      user={user}
      profile={workspace?.profile}
      title={t("analytics.title")}
      subtitle={t("analytics.subtitle")}
    >
      <QuickAnalyticsOverview chartHeight={148} showHeading={false} />
    </AppShell>
  );
}
