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
  const replacement = voting
    ? ["columns", "cards", "leaderboard", "ballot", "split", "donut"].includes(layout)
    : ["classic", "split", "duel", "odds"].includes(layout);
  if (replacement) {
    const mark = (option: Choice, index: number) =>
      focus === index ? (
        <span className="premium-vote-winner">
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
      ) : null;
    return (
      <section
        data-layout-content
        data-voting-family={family}
        data-voting-layout={layout}
        dir={dir}
        className={`premium-vote premium-vote-${family}-${layout} ${leaving ? "cxo-out" : "cxo-in"}`}
        style={
          {
            color,
            background,
            fontFamily,
            fontSize: Math.max(22, fontSize),
            "--vote-accent": accent,
          } as CSSProperties
        }
      >
        {header}
        {layout === "donut" && voting ? (
          <div className="premium-vote-shareline" aria-hidden>
            {options.map((option, index) => (
              <span
                key={option.id}
                style={{
                  flex: Math.max(0.1, option.percent),
                  background: colors[index % colors.length],
                }}
              />
            ))}
          </div>
        ) : null}
        <div className="premium-vote-arena">
          {options.map((option, index) => (
            <article
              key={option.id}
              data-option-id={option.id}
              className={focus === index ? "is-leading" : ""}
              style={
                {
                  "--choice-accent": colors[index % colors.length],
                  "--choice-share": `${option.percent}%`,
                  "--vote-i": index,
                  "--choice-height": `${200 + option.percent * 1.4}px`,
                } as CSSProperties
              }
            >
              {layout === "split" && !voting && index > 0 ? (
                <span className="premium-vote-vs" aria-hidden>
                  VS
                </span>
              ) : null}
              <span className="premium-vote-rank" dir="ltr">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="premium-vote-name">
                <bdi>{option.label}</bdi>
                {mark(option, index)}
              </div>
              <strong className="premium-vote-value" dir="ltr">
                {option.percent}
                <small>%</small>
              </strong>
              <span className="premium-vote-quantity" dir="auto">
                {option.value.toLocaleString("en-US")}{" "}
                {voting ? (lang === "ar" ? "صوت" : "votes") : lang === "ar" ? "نقطة" : "points"}
                {typeof option.voters === "number" ? (
                  <>
                    {" "}
                    · {option.voters.toLocaleString("en-US")} {lang === "ar" ? "مشارك" : "voters"}
                  </>
                ) : null}
              </span>
              {!voting && layout === "odds" ? (
                <strong className="premium-vote-odds" dir="ltr">
                  {option.value > 0 ? `${(total / option.value).toFixed(2)}×` : "—"}
                </strong>
              ) : null}
              <div className="premium-vote-visual" aria-hidden>
                {voting && layout === "cards" ? (
                  Array.from({ length: 20 }, (_, i) => (
                    <span
                      key={i}
                      className={i < Math.round(option.percent / 5) ? "is-filled" : ""}
                    />
                  ))
                ) : (
                  <span />
                )}
              </div>
            </article>
          ))}
        </div>
        <footer className="premium-vote-footer">
          <span>
            {voting
              ? lang === "ar"
                ? "إجمالي الأصوات"
                : "TOTAL VOTES"
              : lang === "ar"
                ? "مجموع النقاط"
                : "POINTS IN PLAY"}
          </span>
          <bdi>{totalText}</bdi>
          <span className="premium-vote-footer-line" />
        </footer>
      </section>
    );
  }
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
