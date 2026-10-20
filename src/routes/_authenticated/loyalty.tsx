import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { StudioPageTabs } from "@/components/layout/StudioPageTabs";
import { RankingTab } from "@/components/loyalty/RankingTab";
import { SalesTab } from "@/components/loyalty/SalesTab";
import { ShopTab } from "@/components/loyalty/ShopTab";
import type { Member, Sale, ShopItem } from "@/components/loyalty/shared";
import { SessionAwareError } from "@/components/widgets/SessionAwareError";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useLanguage } from "@/lib/i18n";
import { getPlanLeaderboard } from "@/lib/planData.functions";
import { supabase } from "@/lib/supabase/client";
import { SIGNED_OUT_ERROR, isMissingViewerSession } from "@/lib/supabase/sessionError";
import { isTestMode } from "@/lib/testMode";

type Tab = "ranking" | "shop" | "sales";

export const Route = createFileRoute("/_authenticated/loyalty")({
  head: () => ({
    meta: [
      { title: "CylixStudio — Loyalty" },
      { name: "description", content: "Loyalty ranking, shop, and sales log." },
    ],
  }),
  component: LoyaltyPage,
});

function LoyaltyPage() {
  const { user } = Route.useRouteContext();
  const { t } = useLanguage();
  const workspace = useWorkspace(user?.id ?? "");
  const guest = isTestMode();
  const [tab, setTab] = useState<Tab>("ranking");
  const queryClient = useQueryClient();

  const members = useQuery({
    queryKey: ["loyalty-members", user?.id],
    enabled: !guest && Boolean(user?.id),
    queryFn: async () => {
      const result = await getPlanLeaderboard();
      return { isPro: result.isPro, members: result.members as Member[] };
    },
  });

  const shop = useQuery({
    queryKey: ["loyalty-shop", user?.id],
    enabled: !guest && Boolean(user?.id) && tab === "shop",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_shop_items")
        .select("id, name, description, cost, enabled, is_active, image_url, stock")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ShopItem[];
    },
  });

  const sales = useQuery({
    queryKey: ["loyalty-sales", user?.id],
    enabled: !guest && Boolean(user?.id) && tab === "sales",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_sales")
        .select("id, member_id, item_name, points, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Sale[];
    },
  });

  const blocked =
    guest ||
    isMissingViewerSession(members.error) ||
    isMissingViewerSession(shop.error) ||
    isMissingViewerSession(sales.error);

  return (
    <AppShell
      user={user}
      profile={workspace.data?.profile}
      title={t("loyalty.title")}
      subtitle={t("loyalty.subtitle")}
    >
      <StudioPageTabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "ranking", label: t("loyalty.tab.ranking") },
          { id: "shop", label: t("loyalty.tab.shop") },
          { id: "sales", label: t("loyalty.tab.sales") },
        ]}
      />

      {tab === "shop" ? (
        <ShopTab
          rows={blocked ? [] : (shop.data ?? [])}
          loading={!blocked && shop.isLoading}
          error={blocked ? null : shop.error}
          userId={user?.id ?? ""}
          guest={blocked}
          onChanged={() => void queryClient.invalidateQueries({ queryKey: ["loyalty-shop", user?.id] })}
        />
      ) : blocked ? (
        <SessionAwareError error={SIGNED_OUT_ERROR} signedOutLabel={t("loyalty.signedOut")} />
      ) : tab === "ranking" ? (
        <>
          {members.data && !members.data.isPro ? (
            <p className="mb-3 text-[0.75rem] text-muted-foreground">{t("loyalty.freeLimit")}</p>
          ) : null}
          <RankingTab
            rows={members.data?.members ?? []}
            loading={members.isLoading}
            error={members.error}
            onChanged={() => void queryClient.invalidateQueries({ queryKey: ["loyalty-members", user?.id] })}
          />
        </>
      ) : (
        <SalesTab
          rows={sales.data ?? []}
          members={members.data?.members ?? []}
          loading={sales.isLoading || members.isLoading}
          error={sales.error}
        />
      )}
    </AppShell>
  );
}
