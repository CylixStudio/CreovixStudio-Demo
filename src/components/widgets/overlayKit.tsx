import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Every OBS overlay below is laid out on this fixed canvas and scaled to the source size. */
export const STAGE_W = 1920;
export const STAGE_H = 1080;

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type Fit = { scale: number; x: number; y: number };

/**
 * Fixed 1920x1080 design canvas, letterboxed and scaled to its container.
 * `viewport` fills the browser source (OBS); `box` fills a parent that sizes itself (builder preview).
 */
export function OverlayStage({
  children,
  mode = "viewport",
  dir,
  className = "",
}: {
  children: ReactNode;
  mode?: "viewport" | "box";
  dir?: "rtl" | "ltr";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<Fit | null>(null);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      const scale = Math.min(w / STAGE_W, h / STAGE_H);
      setFit({ scale, x: (w - STAGE_W * scale) / 2, y: (h - STAGE_H * scale) / 2 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${mode === "viewport" ? "fixed inset-0" : "relative"} overflow-hidden pointer-events-none ${className}`}
    >
      <div
        dir={dir}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: STAGE_W,
          height: STAGE_H,
          transformOrigin: "0 0",
          transform: fit ? `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})` : "none",
          visibility: fit ? "visible" : "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Keeps a card mounted long enough to play its exit animation. */
export function usePresence(visible: boolean, exitMs = 450) {
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    const id = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(id);
  }, [visible, exitMs]);
  return { mounted: visible || mounted, leaving: !visible };
}

/** Eases a number toward its target. Starts at the target so SSR and first paint match. */
export function useTween(target: number, ms = 700) {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const begin = current.current;
    if (begin === target) return;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - progress, 3);
      current.current = begin + (target - begin) * eased;
      setValue(current.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}

export function hexToRgba(hex: string, alpha: number): string {
  let digits = hex.replace("#", "");
  if (digits.length === 3) digits = digits.split("").map((c) => c + c).join("");
  const n = Number.parseInt(digits, 16);
  if (digits.length !== 6 || !Number.isFinite(n)) return `rgba(0,0,0,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Shrinks content that would overflow the canvas height (many options at a large font size). */
export function useFitHeight(maxHeight: number) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  useIsoLayoutEffect(() => {
    if (!el) return;
    const measure = () => setScale(Math.min(1, maxHeight / Math.max(1, el.offsetHeight)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [el, maxHeight]);
  return { ref: setEl, scale };
}

/** Whole-number shares that always add up to 100 (largest remainder). */
export function wholePercents(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((value) => (Math.max(0, value) / total) * 100);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest);
  for (const { index } of order) {
    if (left <= 0) break;
    floors[index] = (floors[index] ?? 0) + 1;
    left -= 1;
  }
  return floors;
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pair = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pair(m)}:${pair(s)}` : `${pair(m)}:${pair(s)}`;
}

const NUMBER = new Intl.NumberFormat("en-US");
export const formatCount = (n: number) => NUMBER.format(Math.round(n));

/** Text scale driven by the builder's font size (28px is the design default). */
export const fontScale = (fontSize: number) => Math.min(1.25, Math.max(0.7, fontSize / 28));

const MOTION_CSS = `
@keyframes cxo-rise { from { opacity: 0; transform: translateY(44px) scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes cxo-fall { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(32px) scale(0.98); } }
@keyframes cxo-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.7); } }
@keyframes cxo-pop { 0% { transform: scale(0.94); } 55% { transform: scale(1.025); } 100% { transform: scale(1); } }
@keyframes cxo-sheen { from { transform: translateX(-120%); } to { transform: translateX(220%); } }
.cxo-in { animation: cxo-rise 700ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.cxo-out { animation: cxo-fall 420ms cubic-bezier(0.4, 0, 1, 1) both; }
.cxo-dot { animation: cxo-pulse 1.6s ease-in-out infinite; }
.cxo-pop { animation: cxo-pop 800ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.cxo-sheen::after { content: ""; position: absolute; inset: 0; width: 40%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent); animation: cxo-sheen 2.8s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .cxo-in, .cxo-out, .cxo-pop { animation-duration: 1ms; }
  .cxo-dot, .cxo-sheen::after { animation: none; }
}
`;

export function OverlayMotionStyles() {
  return <style>{MOTION_CSS}</style>;
}
