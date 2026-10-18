import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { MonthCalendar } from "@/components/schedule/MonthCalendar";
import { useLanguage } from "@/lib/i18n";
import {
  loadTestSchedule,
  publicSchedulePayload,
  zonedIsoDate,
  type ScheduleSlot,
} from "@/lib/schedule";
import { isTestMode } from "@/lib/testMode";

type PublicPayload = {
  title: string;
  timezone: string;
  reminderNote: string;
  slots: Array<
    Pick<
      ScheduleSlot,
      "id" | "weekday" | "occursOn" | "startMinutes" | "durationMinutes" | "game" | "title" | "notes" | "coverUrl"
    >
  >;
};

export const Route = createFileRoute("/overlay/schedule")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
  }),
  head: () => ({
    meta: [
      { title: "CylixStudio — Stream Schedule" },
      { name: "description", content: "Monthly stream go-live times." },
    ],
  }),
  component: PublicSchedule,
});

function PublicSchedule() {
  const { token } = Route.useSearch();
  const { lang } = useLanguage();
  const [data, setData] = useState<PublicPayload | null>(null);
  const [missing, setMissing] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    if (!token) {
      setMissing(true);
      return;
    }
    let stopped = false;
    const load = async () => {
      const response = await fetch(`/api/public/schedule/${encodeURIComponent(token)}/live`, {
        cache: "no-store",
      });
      if (stopped) return;
      if (response.ok) {
        setData((await response.json()) as PublicPayload);
        setMissing(false);
        return;
      }
      if (isTestMode() && token === loadTestSchedule().settings.shareToken) {
        setData(publicSchedulePayload(loadTestSchedule()));
        setMissing(false);
        return;
      }
      setMissing(true);
    };
    void load();
    return () => {
      stopped = true;
    };
  }, [token]);

  const copy = {
    empty: "No streams listed this month.",
    reminder: "Local reminder",
    ics: "Add to calendar (ICS)",
    tz: "Timezone",
  };

  const todayIso = zonedIsoDate(data?.timezone || "UTC");

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto w-full max-w-6xl">
        {missing || !data ? (
          <p className="text-sm text-muted-foreground">{copy.empty}</p>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight" dir="auto">{data.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {copy.tz}: {data.timezone}
            </p>
            {data.reminderNote ? (
              <p className="mt-4 text-sm">
                <span className="text-muted-foreground">{copy.reminder} — </span>
                <span dir="auto">{data.reminderNote}</span>
              </p>
            ) : null}
            <div className="mt-8">
              {data.slots.length === 0 ? (
                <p className="mb-4 text-sm text-muted-foreground">{copy.empty}</p>
              ) : null}
              <MonthCalendar
                year={cursor.year}
                month={cursor.month}
                slots={data.slots.map((slot) => ({ ...slot, enabled: true }))}
                lang={lang}
                todayIso={todayIso}
                onMonthChange={(year, month) => setCursor({ year, month })}
              />
            </div>
            {token ? (
              <a
                href={`/api/public/schedule/${encodeURIComponent(token)}/ics`}
                className="mt-8 inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {copy.ics}
              </a>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
