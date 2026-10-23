import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BuilderCard } from "@/components/widgets/builderUi";
import { loadDemoState, setDemoWidgetState } from "@/lib/demoStore";
import {
  emptyPredictionRuntime,
  parsePredictionRuntime,
  type PredictionRuntime,
} from "@/lib/interactiveWidgets";
import { useLanguage } from "@/lib/i18n";

export function PredictionParticleTest({
  widgetId,
  runtime,
}: {
  widgetId: string;
  runtime: PredictionRuntime | null;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const query = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [draft, setDraft] = useState({ title: "", first: "", second: "" });
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (editing) return;
    setDraft({
      title: runtime?.title ?? "",
      first: runtime?.outcomes[0]?.label ?? "",
      second: runtime?.outcomes[1]?.label ?? "",
    });
  }, [runtime, editing]);
  const test = async (
    share: number | null,
    status: "open" | "locked" | "resolved" | "idle" = "open",
  ) => {
    setBusy(true);
    setError(false);
    try {
      const saved = (await loadDemoState()).widgets.find((widget) => widget.id === widgetId);
      if (!saved) throw new Error("prediction_widget_missing");
      const previous = Object.hasOwn(saved.state, "prediction")
        ? parsePredictionRuntime(saved.state)
        : emptyPredictionRuntime();
      const ratio = share ?? 50;
      const outcomes = [0, 1].map((index) => ({
        id: previous.outcomes[index]?.id ?? `particle-${index}`,
        label:
          (index === 0 ? draft.first : draft.second).trim() ||
          previous.outcomes[index]?.label ||
          (index === 0 ? (ar ? "الفريق الأول" : "Team A") : ar ? "الفريق الثاني" : "Team B"),
        points:
          share === 0
            ? 0
            : share === null
              ? (previous.outcomes[index]?.points ?? 5000)
              : (index === 0 ? ratio : 100 - ratio) * 100,
        voters:
          share === 0
            ? 0
            : share === null
              ? (previous.outcomes[index]?.voters ?? 50)
              : index === 0
                ? ratio
                : 100 - ratio,
      }));
      await setDemoWidgetState(widgetId, {
        ...saved.state,
        prediction: {
          ...previous,
          status,
          title:
            draft.title.trim() ||
            previous.title ||
            (ar ? "اختبار توقع محلي" : "Local prediction test"),
          outcomes,
          endsAt: null,
          hideAt: null,
          winnerId:
            status === "resolved"
              ? outcomes[0]!.points >= outcomes[1]!.points
                ? outcomes[0]!.id
                : outcomes[1]!.id
              : null,
          updatedAt: new Date().toISOString(),
          revision: previous.revision + 1,
          eventName: "demo-prediction-test",
        },
      });
      setEditing(false);
      await query.invalidateQueries({ queryKey: ["widget", widgetId] });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <BuilderCard>
      <p className="text-xs text-muted-foreground">
        {ar ? "محاكاة محلية — لا تُرسل أصواتًا حقيقية" : "Local test — no real votes are sent"}
      </p>
      <p className="text-xs leading-5 text-muted-foreground">
        {ar
          ? "هذه الأدوات تكتب حالة الاختبار في Prediction نفسه. لا يوجد اتصال مباشر بمنصة تصويت في Demo، ولا مزامنة مع أجهزة أخرى."
          : "These tools write test state to this Prediction. Demo has no live voting-provider connection or cross-device synchronization."}
      </p>
      {(["title", "first", "second"] as const).map((key) => (
        <label key={key} className="block text-xs text-muted-foreground">
          {key === "title"
            ? ar
              ? "عنوان الاختبار"
              : "Test title"
            : key === "first"
              ? ar
                ? "الخيار الأول للاختبار"
                : "Test first option"
              : ar
                ? "الخيار الثاني للاختبار"
                : "Test second option"}
          <input
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            dir="auto"
            value={draft[key]}
            maxLength={key === "title" ? 120 : 80}
            onChange={(event) => {
              setEditing(true);
              setDraft((current) => ({ ...current, [key]: event.target.value }));
            }}
          />
        </label>
      ))}
      <div className="flex flex-wrap gap-2">
        {[0, 50, 70, 90, 30, 10].map((share) => (
          <button
            key={share}
            type="button"
            disabled={busy}
            className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-50"
            onClick={() => void test(share)}
            dir="ltr"
          >
            {share === 0 ? (ar ? "دون نقاط" : "No points") : `${share}/${100 - share}`}
          </button>
        ))}
        {(["idle", "locked", "resolved"] as const).map((status) => (
          <button
            key={status}
            type="button"
            disabled={busy}
            className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-50"
            onClick={() => void test(null, status)}
          >
            {status === "idle"
              ? ar
                ? "قبل التصويت"
                : "Idle"
              : status === "locked"
                ? ar
                  ? "إغلاق"
                  : "Lock"
                : ar
                  ? "إظهار الفائز"
                  : "Resolve"}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-red-400">
          {ar
            ? "تعذر حفظ المحاكاة. تحقق من تخزين المتصفح."
            : "Could not save the test. Check browser storage."}
        </p>
      ) : null}
    </BuilderCard>
  );
}
