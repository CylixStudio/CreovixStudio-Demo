import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/layout/AppShell";
import { TimerControls } from "@/components/widgets/TimerControls";
import { supabase } from "@/lib/supabase/client";
import { useWorkspace, useSubathonStats } from "@/hooks/useWorkspace";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { triggerPhrase } from "@/lib/platformEvents";
import { formatDuration } from "@/lib/timer";

export const Route = createFileRoute("/_authenticated/subathons/$id/control")({
  head: () => ({
    meta: [
      { title: "CylixStudio — Timer Control" },
      {
        name: "description",
        content: "Live subathon timer control: start, pause, add or subtract time and undo actions.",
      },
      { property: "og:title", content: "CylixStudio — Timer Control" },
      {
        property: "og:description",
        content: "Run your subathon timer live with instant overlay sync.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ControlPage,
});

function ControlPage() {
  const { user } = Route.useRouteContext();
  const { id } = Route.useParams();
  const { t } = useLanguage();
  const { data } = useWorkspace(user.id);
  const stats = useSubathonStats(id);
  const subathon = data?.subathons.find((entry) => entry.id === id);
  const publicToken = subathon?.overlays.find((overlay) => overlay.is_public)?.public_token ?? null;

  const recentEvents = useQuery({
    queryKey: ["events", id],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("events")
        .select("id, platform, event_type, actor_name, amount, currency, seconds_added, created_at")
        .eq("subathon_id", id)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return rows;
    },
  });

  return (
    <AppShell
      user={user}
      profile={data?.profile}
      subathons={data?.subathons ?? []}
      activeSubathonId={id}
      title={subathon?.title ?? t("sub.page.control.title")}
      subtitle={t("sub.page.control.subtitle")}
      actions={
        publicToken ? (
          <a
            href={`/api/public/overlay/${publicToken}/stream`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            {t("sub.page.control.streamUrl")}
          </a>
        ) : null
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("sub.page.control.totalAdded")} value={formatDuration(stats.data?.totalAddedSeconds ?? 0)} />
        <StatCard label={t("sub.page.control.totalEvents")} value={String(stats.data?.totalEvents ?? 0)} />
        <StatCard label={t("sub.page.control.activeRules")} value={String(stats.data?.activeRules ?? 0)} />
        <StatCard
          label={t("sub.page.control.cap")}
          value={
            subathon?.max_duration_seconds
              ? formatDuration(subathon.max_duration_seconds)
              : t("sub.page.control.noCap")
          }
        />
      </div>

      <TimerControls subathonId={id} publicToken={publicToken} />

      <section className="surface-card surface-card-pad mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {t("sub.page.control.recent")}
          </h2>
          <Link
            to="/subathons/$id/rules"
            params={{ id }}
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("sub.page.control.editRules")}
          </Link>
        </div>
        {recentEvents.data && recentEvents.data.length > 0 ? (
          <ul className="mt-4 divide-y divide-white/8">
            {recentEvents.data.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {event.actor_name ?? t("sub.page.control.anonymous")} ·{" "}
                    {t(`rules.event.${triggerPhrase(event.platform, event.event_type)}` as TranslationKey)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {event.platform} · {new Date(event.created_at).toLocaleString()}
                    {event.amount ? ` · ${event.amount} ${event.currency ?? ""}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary" dir="ltr">
                  +{formatDuration(event.seconds_added)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">{t("sub.page.control.noEvents")}</p>
        )}
      </section>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card surface-card-pad">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-2xl font-bold tabular-nums" dir="ltr">
        {value}
      </p>
    </div>
  );
}
