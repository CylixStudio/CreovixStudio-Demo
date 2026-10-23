import type { CSSProperties } from "react";
import { Eye, Radio, Users } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import type { ViewerLayout } from "@/lib/widgetLayouts";
import type { parseViewerCounterConfig } from "@/lib/widgets";

export function ViewerCountFace({
  layout,
  style,
  digits,
  label,
}: {
  layout: ViewerLayout;
  style: ReturnType<typeof parseViewerCounterConfig>;
  digits: string;
  label: string;
}) {
  const { lang, dir } = useLanguage();
  const accent = style.accentColor;
  const live = lang === "ar" ? "مباشر" : "LIVE";
  const root = { color: style.textColor, fontFamily: style.fontFamily };
  const number = (
    <strong
      style={{
        fontSize: Math.max(28, style.fontSize * 0.78),
        fontWeight: 750,
        fontVariantNumeric: "tabular-nums",
      }}
      dir="ltr"
    >
      {digits}
    </strong>
  );
  if (layout === "digits")
    return (
      <div className="bg-transparent text-center" style={root}>
        <span
          style={{ fontSize: style.fontSize, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
          dir="ltr"
        >
          {digits}
        </span>
      </div>
    );
  if (layout === "island" || layout === "ambient")
    return (
      <div
        data-viewer-layout={layout}
        data-layout-content
        className={`viewer-refined viewer-refined-${layout}`}
        dir={dir}
        style={{ ...root, "--viewer-accent": accent } as CSSProperties}
      >
        {layout === "island" ? (
          <>
            <span className="viewer-capsule-mark">
              <Eye size={24} />
            </span>
            <div className="viewer-copy">
              <span className="viewer-caption">{label}</span>
              <span className="viewer-live">
                <i />
                {live}
              </span>
            </div>
            <span className="viewer-large">{number}</span>
          </>
        ) : (
          <>
            <span className="viewer-live">
              <i />
              {live}
            </span>
            <div className="viewer-ambient-number">
              {number}
              <Eye size={24} strokeWidth={1} />
            </div>
            <span className="viewer-caption">
              {label} <span className="viewer-ambient-platform">/ {style.platform}</span>
            </span>
            <span className="viewer-ambient-rule" />
          </>
        )}
      </div>
    );
  const identity = (
    <span className="premium-viewer-identity">
      <i />
      {live}
      <bdi>{style.platform}</bdi>
    </span>
  );
  return (
    <div
      data-layout-content
      data-viewer-layout={layout}
      className={`premium-viewer premium-viewer-${layout}`}
      dir={dir}
      style={
        {
          ...root,
          "--viewer-accent": accent,
          "--viewer-size": `${Math.max(32, style.fontSize * 0.78)}px`,
        } as CSSProperties
      }
    >
      {layout === "digital" ? (
        <>
          <div className="premium-viewer-title">
            <Eye size={18} />
            <span>{label}</span>
          </div>
          <div className="premium-viewer-type" dir="ltr">
            <span aria-hidden>“</span>
            {number}
          </div>
          <footer>
            {identity}
            <span className="premium-viewer-rule" />
          </footer>
        </>
      ) : layout === "hud" ? (
        <>
          <div className="premium-viewer-orbit">
            <Users size={28} />
            <span />
          </div>
          <div>
            {identity}
            <div className="premium-viewer-counter">{number}</div>
            <span>{label}</span>
          </div>
        </>
      ) : layout === "live" ? (
        <>
          <aside>
            <Radio size={27} />
            <span>{live}</span>
          </aside>
          <header>
            <span>{label}</span>
            <bdi>{style.platform}</bdi>
          </header>
          <div className="premium-viewer-counter">
            {number}
            <Eye size={20} />
          </div>
          <footer>
            <span className="premium-viewer-rule" />
            {lang === "ar" ? "الجمهور الآن" : "AUDIENCE NOW"}
          </footer>
        </>
      ) : layout === "lower-third" ? (
        <>
          <div className="premium-viewer-ticket">
            <Eye size={23} />
            <bdi>{style.platform}</bdi>
          </div>
          <div className="premium-viewer-window">{number}</div>
          <div className="premium-viewer-tail">
            <span>{label}</span>
            {identity}
          </div>
        </>
      ) : (
        <>
          <header>
            {identity}
            <Eye size={18} />
          </header>
          <div className="premium-viewer-stat">
            <span>{label}</span>
            {number}
          </div>
          <footer>
            <span>{style.platform}</span>
            <span className="premium-viewer-rule" />
            <Users size={16} />
          </footer>
        </>
      )}
    </div>
  );
}
