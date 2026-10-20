import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { RulesManager, type RuleInput } from "@/components/widgets/WidgetRulesPanel";
import { supabase } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useLanguage } from "@/lib/i18n";
import type { Database } from "@/lib/supabase/types";

type Rule = Database["public"]["Tables"]["rules"]["Row"];

export const Route = createFileRoute("/_authenticated/subathons/$id/rules")({
  head: () => ({
    meta: [
      { title: "CylixStudio — Rules Builder" },
      {
        name: "description",
        content:
          "Create rules that convert follows, subs, gift subs, bits and donations into subathon seconds.",
      },
      { property: "og:title", content: "CylixStudio — Rules Builder" },
      {
        property: "og:description",
        content: "Visual rule builder: platform + event + condition to seconds added.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RulesPage,
});

function RulesPage() {
  const { user } = Route.useRouteContext();
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: workspace } = useWorkspace(user.id);
  const { t } = useLanguage();
  const [error, setError] = useState<string | null>(null);

  const rules = useQuery({
    queryKey: ["rules", id],
    queryFn: async () => {
      const { data, error: readError } = await supabase
        .from("rules")
        .select("*")
        .eq("subathon_id", id)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true });
      if (readError) throw readError;
      return data as Rule[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["rules", id] });

  const fail = (err: Error) => {
    setError(err.message);
    toast.error(err.message);
  };

  const saveRule = useMutation({
    mutationFn: async (input: RuleInput) => {
      const { error: writeError } = await supabase.from("rules").upsert(
        {
          subathon_id: id,
          platform: input.platform,
          event_type: input.event_type,
          unit_amount: Math.max(1, Number(input.unit_amount) || 1),
          seconds_per_unit: Math.max(0, Number(input.seconds_per_unit) || 0),
          goal_increment: Math.max(0, Number(input.goal_increment) || 0),
          min_amount: input.min_amount,
          max_seconds_per_event: input.max_seconds_per_event,
          priority: Number(input.priority) || 0,
        },
        { onConflict: "subathon_id,platform,event_type" },
      );
      if (writeError) throw writeError;
    },
    onError: fail,
    onSuccess: () => {
      setError(null);
      void invalidate();
    },
  });

  const patchRule = useMutation({
    mutationFn: async ({ ruleId, patch }: { ruleId: string; patch: Partial<Rule> }) => {
      const { error: writeError } = await supabase.from("rules").update(patch).eq("id", ruleId);
      if (writeError) throw writeError;
    },
    onError: fail,
    onSuccess: () => void invalidate(),
  });

  const deleteRule = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error: writeError } = await supabase.from("rules").delete().eq("id", ruleId);
      if (writeError) throw writeError;
    },
    onError: fail,
    onSuccess: () => void invalidate(),
  });

  return (
    <AppShell
      user={user}
      profile={workspace?.profile}
      subathons={workspace?.subathons ?? []}
      activeSubathonId={id}
      title={t("sub.page.rules.title")}
      subtitle={t("sub.page.rules.subtitle")}
    >
      {error ? (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="surface-card surface-card-pad">
        <RulesManager
          rules={rules.data ?? []}
          loading={rules.isLoading}
          busy={saveRule.isPending || patchRule.isPending || deleteRule.isPending}
          canEdit
          defaultPlatform={workspace?.profile?.default_platform}
          onSave={(input) => saveRule.mutateAsync(input)}
          onToggleEnabled={(rule, enabled) => patchRule.mutate({ ruleId: rule.id, patch: { is_enabled: enabled } })}
          onDelete={(rule) => deleteRule.mutateAsync(rule.id)}
        />
      </section>
    </AppShell>
  );
}
