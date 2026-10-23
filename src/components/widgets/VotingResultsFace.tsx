import type { CSSProperties } from "react";
import { Check, Clock3, Radio } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { formatClock, hexToRgba } from "./overlayKit";

type Choice = { id: string; label: string; value: number; percent: number; voters?: number };

/** Presentation only: totals, eligibility, voting and result selection stay in the existing overlays. */
export function VotingResultsFace({
  family,
  layout,
  title,
  options,
  focus,
  open,
  remaining,
  accent,
  color,
  background,
  fontFamily,
  fontSize,
  leaving,
}: {
  family: "poll" | "prediction";
  layout: string;
  title: string;
  options: Choice[];
  focus: number;
  open: boolean;
  remaining: number;
  accent: string;
  color: string;
  background: string;
  fontFamily: string;
  fontSize: number;
  leaving: boolean;
}) {
  const { lang, dir } = useLanguage();
  const total = options.reduce((sum, option) => sum + option.value, 0);
  const totalText = total.toLocaleString("en-US");
  const voting = family === "poll";
  const colors = [accent, "#c4b5fd", "#a7d9cc", "#e8c697", "#e6afc8", "#96b9df"];
  const header = (
    <header className="vote-heading">
      <div>
        <span className="vote-kicker">
          {voting
            ? lang === "ar"
              ? "تصويت الجمهور"
              : "AUDIENCE POLL"
            : lang === "ar"
              ? "توقعات الجمهور"
              : "CHANNEL PREDICTION"}
        </span>
        <h2 dir="auto">{title}</h2>
      </div>
      <span className="vote-state">
        {open ? <Radio size={18} /> : <Check size={18} />}
        {open ? (lang === "ar" ? "مفتوح" : "OPEN") : lang === "ar" ? "مغلق" : "CLOSED"}
        {open && remaining > 0 ? (
          <span dir="ltr">
            <Clock3 size={15} />
            {formatClock(remaining)}
          </span>
        ) : null}
      </span>
    </header>
  );
  const choice = (option: Choice, index: number) => (
    <article
      key={option.id}
      className={`vote-choice ${focus === index ? "is-leading" : ""}`}
      style={
        {
          "--choice-accent": colors[index % colors.length],
          "--choice-share": `${option.percent}%`,
        } as CSSProperties
      }
    >
      <span className="vote-option-index" dir="ltr">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="vote-option-title">
        <bdi>{option.label}</bdi>
        <small>
          {option.value.toLocaleString("en-US")}{" "}
          {voting ? (lang === "ar" ? "صوت" : "votes") : lang === "ar" ? "نقطة" : "points"}
          {typeof option.voters === "number" ? (
            <>
              {" "}
              · {option.voters.toLocaleString("en-US")} {lang === "ar" ? "مشارك" : "voters"}
            </>
          ) : null}
          {!voting && layout === "odds" && option.value > 0 ? (
            <> · {(total / option.value).toFixed(2)}×</>
          ) : null}
        </small>
      </div>
      <strong className="vote-percent" dir="ltr">
        {option.percent}%
      </strong>
      <div className="vote-option-meter">
        <span />
      </div>
      {focus === index ? (
        <span className="vote-leader">
          {open ? (
            lang === "ar" ? (
              "المتقدم"
            ) : (
              "LEADING"
            )
          ) : (
            <>
              {!voting ? "★ " : ""}
              {lang === "ar" ? "الفائز" : "WINNER"}
            </>
          )}
        </span>
      ) : null}
    </article>
  );
  let offset = 0;
  return (
    <section
      data-layout-content
      data-voting-family={family}
      data-voting-layout={layout}
      className={`voting-face voting-${family}-${layout} ${leaving ? "cxo-out" : "cxo-in"}`}
      dir={dir}
      style={
        {
          "--vote-accent": accent,
          "--vote-wash": hexToRgba(accent, 0.08),
          color,
          background,
          fontFamily,
          fontSize: Math.max(22, fontSize),
        } as CSSProperties
      }
    >
      {header}
      <div className="vote-body">
        {layout === "donut" ? (
          <div className="vote-ring" dir="ltr">
            <svg viewBox="0 0 200 200" aria-hidden>
              <circle cx="100" cy="100" r="83" fill="none" stroke="#ffffff0d" strokeWidth="12" />
              {options.map((option, index) => {
                const start = offset;
                offset += option.percent;
                return (
                  <circle
                    key={option.id}
                    cx="100"
                    cy="100"
                    r="83"
                    fill="none"
                    stroke={colors[index % colors.length]}
                    strokeWidth="12"
                    strokeDasharray={`${option.percent * 5.215} 521.5`}
                    strokeDashoffset={-start * 5.215}
                    transform="rotate(-90 100 100)"
                  />
                );
              })}
            </svg>
            <div>
              <strong>{totalText}</strong>
              <small>{lang === "ar" ? "إجمالي الأصوات" : "TOTAL VOTES"}</small>
            </div>
          </div>
        ) : null}
        <div className="vote-choices">{options.map(choice)}</div>
      </div>
      <footer className="vote-footer">
        <span>
          {voting
            ? lang === "ar"
              ? "إجمالي الأصوات"
              : "TOTAL VOTES"
            : lang === "ar"
              ? "مجموع النقاط"
              : "POINTS IN PLAY"}{" "}
          <bdi>{totalText}</bdi>
        </span>
        <span>{lang === "ar" ? "صوتك يصنع الفارق" : "THE COMMUNITY DECIDES"}</span>
      </footer>
    </section>
  );
}
