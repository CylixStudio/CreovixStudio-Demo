import { useEffect, useRef, useState, type ReactNode } from "react";

/** Fit actual renderer content, including a nested OBS stage, without stretching or clipping. */
export function LayoutThumbnail({
  children,
  height = 128,
}: {
  children: ReactNode;
  height?: number;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLDivElement>(null);
  const transform = useRef({ scale: 1, x: 0, y: 0 });
  const [fit, setFit] = useState(transform.current);
  useEffect(() => {
    const container = frame.current;
    const content = source.current;
    if (!container || !content) return;
    let raf = 0;
    let active = true;
    let target: Element | null = null;
    const observer = new ResizeObserver(schedule);
    function measure() {
      if (!container || !content) return;
      const nextTarget =
        content.querySelector("[data-layout-content]") ?? content.firstElementChild;
      if (nextTarget !== target) {
        if (target) observer.unobserve(target);
        target = nextTarget;
        if (target) observer.observe(target);
      }
      const rect = target?.getBoundingClientRect();
      const origin = content.getBoundingClientRect();
      const previous = transform.current;
      const width = rect && rect.width > 0 ? rect.width / previous.scale : 640;
      const contentHeight = rect && rect.height > 0 ? rect.height / previous.scale : 360;
      const left = rect ? (rect.left - origin.left) / previous.scale : 0;
      const top = rect ? (rect.top - origin.top) / previous.scale : 0;
      const scale = Math.min(
        (container.clientWidth - 20) / width,
        (container.clientHeight - 20) / contentHeight,
        1,
      );
      if (!(scale > 0)) return;
      const next = {
        scale,
        x: (container.clientWidth - width * scale) / 2 - left * scale,
        y: (container.clientHeight - contentHeight * scale) / 2 - top * scale,
      };
      if (
        Math.abs(next.scale - previous.scale) < 0.001 &&
        Math.abs(next.x - previous.x) < 0.5 &&
        Math.abs(next.y - previous.y) < 0.5
      )
        return;
      transform.current = next;
      setFit(next);
    }
    function schedule() {
      if (!active) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    }
    observer.observe(container);
    observer.observe(content);
    const mutations = new MutationObserver(schedule);
    mutations.observe(content, { childList: true, subtree: true });
    document.fonts.ready.then(schedule);
    schedule();
    return () => {
      active = false;
      observer.disconnect();
      mutations.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div
      ref={frame}
      data-layout-thumbnail
      className="pointer-events-none relative w-full overflow-hidden"
      style={{ height }}
    >
      <div
        ref={source}
        className="absolute left-0 top-0 grid h-[360px] w-[640px] place-items-center"
        style={{
          transformOrigin: "0 0",
          transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
