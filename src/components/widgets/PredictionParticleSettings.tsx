import { BuilderCard, RangeField } from "@/components/widgets/builderUi";
import { PARTICLE_DEFAULTS } from "@/lib/predictionParticles";
import { parsePredictionConfig } from "@/lib/widgets";
import { useLanguage } from "@/lib/i18n";

export function PredictionParticleSettings({
  pane,
  config,
  onChange,
}: {
  pane: "display" | "extra";
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const settings = parsePredictionConfig(config);
  const ranges =
    pane === "display"
      ? ([
          {
            key: "particleSize",
            label: ar ? "حجم الدوائر" : "Circle size",
            min: 50,
            max: 150,
            unit: "%",
          },
          {
            key: "particleDensity",
            label: ar ? "كثافة الدوائر" : "Circle density",
            min: 30,
            max: 150,
            unit: "%",
          },
          {
            key: "particleHeight",
            label: ar ? "ارتفاع التجمع" : "Cluster height",
            min: 70,
            max: 160,
            unit: "px",
          },
          {
            key: "particleOverlap",
            label: ar ? "مستوى التداخل" : "Overlap",
            min: 0,
            max: 100,
            unit: "%",
          },
        ] as const)
      : ([
          {
            key: "particleSpeed",
            label: ar ? "سرعة الحركة" : "Motion speed",
            min: 10,
            max: 100,
            unit: "%",
          },
          {
            key: "particleBounce",
            label: ar ? "قوة الارتداد" : "Bounce strength",
            min: 0,
            max: 100,
            unit: "%",
          },
        ] as const);
  return (
    <BuilderCard>
      {ranges.map((field) => (
        <RangeField
          key={field.key}
          label={field.label}
          min={field.min}
          max={field.max}
          unit={field.unit}
          value={settings[field.key]}
          onChange={(value) => onChange({ [field.key]: value })}
        />
      ))}
      {pane === "display" ? (
        (["particleGreen", "particleRed"] as const).map((key, index) => (
          <label
            key={key}
            className="flex items-center justify-between gap-3 text-xs text-muted-foreground"
          >
            {index === 0
              ? ar
                ? "لون الطرف الأيسر"
                : "Left side color"
              : ar
                ? "لون الطرف الأيمن"
                : "Right side color"}
            <input
              type="color"
              aria-label={
                index === 0
                  ? ar
                    ? "لون الطرف الأيسر"
                    : "Left side color"
                  : ar
                    ? "لون الطرف الأيمن"
                    : "Right side color"
              }
              value={settings[key]}
              onChange={(e) => onChange({ [key]: e.target.value })}
            />
          </label>
        ))
      ) : (
        <>
          {(["particleMotion", "particleLowPower"] as const).map((key) => (
            <label
              key={key}
              className="flex items-center justify-between gap-3 text-xs text-muted-foreground"
            >
              {key === "particleMotion"
                ? ar
                  ? "تفعيل الحركة"
                  : "Enable motion"
                : ar
                  ? "أداء منخفض (دوائر أقل)"
                  : "Low power (fewer circles)"}
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={(e) => onChange({ [key]: e.target.checked })}
              />
            </label>
          ))}
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-white/5"
            onClick={() => onChange({ ...PARTICLE_DEFAULTS })}
          >
            {ar ? "إعادة ضبط صراع الدوائر" : "Reset Particle Clash"}
          </button>
        </>
      )}
    </BuilderCard>
  );
}
