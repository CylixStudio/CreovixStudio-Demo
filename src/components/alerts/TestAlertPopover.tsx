import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type TestKind = "months" | "gift" | "kicks";

const AUTO_KEY = {
  months: "alerts.testAutoMonths",
  gift: "alerts.testAutoGift",
  kicks: "alerts.testAutoKicks",
} as const;

const CUSTOM_KEY = {
  months: "alerts.testCustomMonths",
  gift: "alerts.testCustomGift",
  kicks: "alerts.testCustomKicks",
} as const;

type Props = {
  label: string;
  kind: TestKind;
  autoValue: number;
  platformLabel: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  onTest: (customValue?: number) => void;
};

const WIDTH = 272;

export function TestAlertPopover({
  label,
  kind,
  autoValue,
  platformLabel,
  disabled = false,
  min = 1,
  max = 100000,
  onTest,
}: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"auto" | "custom">("auto");
  const [custom, setCustom] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  const customValue = Number(custom);
  const customValid =
    custom.trim() !== "" &&
    Number.isSafeInteger(customValue) &&
    customValue >= min &&
    customValue <= max;

  useLayoutEffect(() => {
    if (!open || !wrap.current) return;
    const rect = wrap.current.getBoundingClientRect();
    const width = Math.min(WIDTH, window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    setPos({ top: wrap.current.offsetHeight + 6, left: left - rect.left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!wrap.current?.contains(target) && !panel.current?.contains(target)) close();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const send = () => {
    if (mode === "custom") {
      if (!customValid) return;
      onTest(customValue);
    } else {
      onTest();
    }
    setOpen(false);
  };

  return (
    <div className="alert-test-item" ref={wrap}>
      <button
        type="button"
        className="alert-button test-button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          setMode("auto");
          setCustom("");
          setOpen((value) => !value);
        }}
      >
        <Plus size={17} />
        {label}
        <ChevronDown size={15} className={`chev ${open ? "is-open" : ""}`} />
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label={label}
          className="alert-test-popover"
          style={{ top: pos.top, left: pos.left }}
        >
          <h3>{label}</h3>
          <div className="alert-test-modes" role="radiogroup" aria-label={t("alerts.testMode")}>
            {(["auto", "custom"] as const).map((item) => (
              <button
                type="button"
                role="radio"
                aria-checked={mode === item}
                key={item}
                onClick={() => setMode(item)}
              >
                {item === "auto" ? t("alerts.testAuto") : t("alerts.testCustom")}
              </button>
            ))}
          </div>
          {mode === "auto" ? (
            <p className="alert-hint">
              {t(AUTO_KEY[kind], { n: autoValue })}
            </p>
          ) : (
            <input
              className="alert-input"
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              step={1}
              autoFocus
              value={custom}
              aria-label={t(CUSTOM_KEY[kind])}
              placeholder={t(CUSTOM_KEY[kind])}
              onChange={(event) => setCustom(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  send();
                }
              }}
            />
          )}
          <button
            type="button"
            className="alert-button primary"
            disabled={mode === "custom" && !customValid}
            onClick={send}
          >
            {mode === "custom" ? t("alerts.testSendCustom") : t("alerts.testSend")}
          </button>
          <p className="alert-hint">{t("alerts.testPlatformFor", { platform: platformLabel })}</p>
        </div>
      )}
    </div>
  );
}
