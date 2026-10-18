import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  formatClock,
  monthGrid,
  monthLabel,
  shiftMonth,
  slotOnDate,
  weekOrder,
  weekdayLabel,
  type ScheduleSlot,
} from "@/lib/schedule";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type CalendarSlot = Pick<
  ScheduleSlot,
  "id" | "weekday" | "occursOn" | "startMinutes" | "durationMinutes" | "game" | "title" | "coverUrl" | "enabled"
>;

export function MonthCalendar({
  year,
  month,
  slots,
  lang,
  todayIso,
  onMonthChange,
  onAdd,
  onEdit,
}: {
  year: number;
  month: number;
  slots: CalendarSlot[];
  lang: "en" | "ar";
  todayIso?: string;
  onMonthChange?: (year: number, month: number) => void;
  onAdd?: (iso: string) => void;
  onEdit?: (id: string) => void;
}) {
  const { t } = useLanguage();
  const days = weekOrder(lang);
  const cells = monthGrid(year, month, days, todayIso);
  const visible = slots.filter((slot) => slot.enabled || onEdit);
  const prev = t("schedule.prevMonth");
  const next = t("schedule.nextMonth");

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            const cursor = shiftMonth(year, month, -1);
            onMonthChange?.(cursor.year, cursor.month);
          }}
          className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground disabled:opacity-30"
          aria-label={prev}
          disabled={!onMonthChange}
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </button>
        <h2 className="text-[1.05rem] font-medium tracking-tight text-foreground/90">{monthLabel(year, month, lang)}</h2>
        <button
          type="button"
          onClick={() => {
            const cursor = shiftMonth(year, month, 1);
            onMonthChange?.(cursor.year, cursor.month);
          }}
          className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground disabled:opacity-30"
          aria-label={next}
          disabled={!onMonthChange}
        >
          <ChevronRight className="size-4 rtl:rotate-180" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => (
          <div
            key={`h-${day}`}
            className="px-1 py-2 text-center text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground/70"
          >
            {weekdayLabel(day, lang, true)}
          </div>
        ))}
        {cells.map((cell) => {
          const items = visible
            .filter((slot) => slotOnDate(slot, cell.iso))
            .sort((a, b) => a.startMinutes - b.startMinutes);
          return (
            <div
              key={cell.iso}
              className={cn(
                "min-h-[11rem] rounded-2xl p-1.5 transition-colors sm:min-h-[13.5rem] sm:p-2",
                !cell.inMonth && "opacity-35",
                cell.isToday && "bg-[#bee1fc]/10 ring-1 ring-inset ring-[#bee1fc]/25",
                onAdd && "cursor-pointer hover:bg-white/[0.05]",
              )}
              onClick={() => onAdd?.(cell.iso)}
            >
              <span
                className={cn(
                  "mb-1 inline-flex size-7 items-center justify-center rounded-full text-[0.78rem] tabular-nums",
                  cell.isToday
                    ? "bg-[#bee1fc]/20 font-semibold text-[#bee1fc]"
                    : "font-medium text-muted-foreground",
                )}
              >
                {cell.date.getDate()}
              </span>
              <ul className="space-y-1.5">
                {items.map((slot) => {
                  const category = slot.game.trim() || slot.title;
                  const body = (
                    <span className={cn("flex flex-col", !slot.enabled && "opacity-50")}>
                      <span
                        className={cn(
                          "block break-words rounded-xl bg-white/[0.05] px-2 py-1.5 text-[0.78rem] font-medium leading-snug sm:text-[0.82rem]",
                          lang === "en" && "tracking-wide",
                        )}
                      >
                        <span dir="auto">{category}</span>
                      </span>
                      <span className="px-1 pt-1">
                        {slot.game.trim() && slot.title.trim() && slot.title.trim() !== slot.game.trim() ? (
                          <span className="block text-[0.75rem] leading-snug text-foreground/80" dir="auto">{slot.title}</span>
                        ) : null}
                        <span className="mt-0.5 block font-mono text-[0.65rem] text-muted-foreground/80">
                          {formatClock(slot.startMinutes)}
                          {slot.durationMinutes ? ` · ${slot.durationMinutes}m` : ""}
                        </span>
                      </span>
                      {slot.coverUrl ? (
                        <span className="mt-1.5 block px-0.5 pb-0.5">
                          <img
                            src={slot.coverUrl}
                            alt=""
                            className="aspect-[3/4] w-full rounded-xl object-cover"
                          />
                        </span>
                      ) : null}
                    </span>
                  );
                  return (
                    <li key={`${slot.id}-${cell.iso}`}>
                      {onEdit ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onEdit(slot.id);
                          }}
                          className="w-full text-start"
                        >
                          {body}
                        </button>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
