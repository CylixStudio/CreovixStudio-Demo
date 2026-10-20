import { Trash2 } from "lucide-react";

import { WHEEL_SLICE_COLORS } from "@/components/widgets/SpinWheel";
import { PaneSection, paneInlineFieldClass } from "@/components/widgets/PaneKit";
import { useLanguage } from "@/lib/i18n";
import { DEFAULT_WHEEL_PRIZES, type SpinPrize } from "@/lib/widgets";

const MAX_PRIZES = 24;

function paletteColor(index: number) {
  return WHEEL_SLICE_COLORS[index % WHEEL_SLICE_COLORS.length]!.fill;
}

/** Add, rename, reweight, recolour and delete wheel prizes. Rows with a blank name are not drawn. */
export function WheelPrizeManager({
  prizes,
  onChange,
}: {
  prizes: SpinPrize[];
  onChange: (next: SpinPrize[]) => void;
}) {
  const { t } = useLanguage();
  const totalWeight = prizes.reduce(
    (sum, prize) => (prize.label.trim() ? sum + prize.weight : sum),
    0,
  );
  const patch = (index: number, change: Partial<SpinPrize>) => {
    const next = prizes.slice();
    const current = next[index];
    if (!current) return;
    next[index] = { ...current, ...change };
    onChange(next);
  };
  let drawn = -1;

  return (
    <PaneSection title={t("std.wheel.prizes")} hint={t("std.wheel.prizesHint")}>
      {prizes.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("std.wheel.empty")}</p>
      ) : null}
      <ul className="space-y-2" data-prize-list>
        {prizes.map((prize, index) => {
          const named = prize.label.trim().length > 0;
          if (named) drawn += 1;
          const chance =
            named && totalWeight > 0 ? Math.round((prize.weight / totalWeight) * 100) : 0;
          return (
            <li key={index} className="flex items-center gap-2" data-prize-row>
              <input
                type="color"
                aria-label={t("std.wheel.color")}
                title={t("std.wheel.color")}
                value={prize.color ?? paletteColor(Math.max(drawn, 0))}
                onChange={(event) => patch(index, { color: event.target.value })}
                className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-background"
              />
              <input
                className={`${paneInlineFieldClass} min-w-0 flex-1`}
                value={prize.label}
                maxLength={40}
                aria-label={t("widget.wheel.prize")}
                placeholder={t("widget.wheel.prize")}
                onChange={(event) => patch(index, { label: event.target.value })}
              />
              <input
                type="number"
                min={1}
                max={100}
                inputMode="numeric"
                aria-label={t("widget.wheel.weight")}
                title={t("widget.wheel.weight")}
                className={`${paneInlineFieldClass} w-16 shrink-0 px-2 text-center`}
                value={prize.weight}
                onChange={(event) => {
                  const value = Math.min(
                    100,
                    Math.max(1, Math.round(Number(event.target.value) || 1)),
                  );
                  patch(index, { weight: value });
                }}
              />
              <span
                className="w-9 shrink-0 text-end text-[10px] tabular-nums text-muted-foreground"
                dir="ltr"
              >
                {named ? `${chance}%` : "–"}
              </span>
              <button
                type="button"
                aria-label={t("widget.wheel.remove")}
                title={t("widget.wheel.remove")}
                onClick={() => onChange(prizes.filter((_, item) => item !== index))}
                className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground hover:border-red-500/40 hover:text-red-400"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      {prizes.length > 0 ? (
        <p className="text-[10px] text-muted-foreground">{t("std.wheel.rowHint")}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={prizes.length >= MAX_PRIZES}
          onClick={() => onChange([...prizes, { label: String(prizes.length + 1), weight: 1 }])}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {t("widget.wheel.add")}
        </button>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_WHEEL_PRIZES.map((prize) => ({ ...prize })))}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-primary hover:text-primary"
        >
          {t("std.wheel.restore")}
        </button>
      </div>
    </PaneSection>
  );
}
