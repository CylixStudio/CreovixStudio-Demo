import { useEffect, useRef, useState, type CSSProperties } from "react";

import { isLightBioTheme, type AmbientPreset, type LinkInBioTheme } from "@/lib/linkInBio";

export function LinkInBioAmbient({ theme }: { theme: LinkInBioTheme }) {
  if (!isLightBioTheme(theme.paletteBg)) return null;
  if (!theme.ambientEnabled || theme.ambientPreset === "none") return null;
  return <MotionLayers theme={theme} />;
}

function MotionLayers({ theme }: { theme: LinkInBioTheme }) {
  const root = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const [reduced, setReduced] = useState(false);
  const [motionOn, setMotionOn] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const onPointer = (event: PointerEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      target.current = { x: (event.clientX / w) * 2 - 1, y: (event.clientY / h) * 2 - 1 };
    };
    if (fine) window.addEventListener("pointermove", onPointer, { passive: true });

    let orientationBound = false;
    const onOrient = (event: DeviceOrientationEvent) => {
      const gamma = (event.gamma ?? 0) / 30;
      const beta = (event.beta ?? 0) / 40;
      target.current = {
        x: Math.max(-1, Math.min(1, gamma)),
        y: Math.max(-1, Math.min(1, beta)),
      };
    };

    const bindOrientation = async () => {
      const DeviceOrientation = window.DeviceOrientationEvent as
        | (typeof window.DeviceOrientationEvent & { requestPermission?: () => Promise<string> })
        | undefined;
      if (!DeviceOrientation) return;
      try {
        if (typeof DeviceOrientation.requestPermission === "function") {
          const result = await DeviceOrientation.requestPermission();
          if (result !== "granted") return;
        }
        window.addEventListener("deviceorientation", onOrient, { passive: true });
        orientationBound = true;
      } catch {
        /* denied or unsupported — stay static/pointer-only */
      }
    };

    const onFirstTouch = () => {
      void bindOrientation();
    };
    if (!fine) window.addEventListener("touchstart", onFirstTouch, { passive: true, once: true });

    let frame = 0;
    const tick = () => {
      current.current.x += (target.current.x - current.current.x) * 0.06;
      current.current.y += (target.current.y - current.current.y) * 0.06;
      const node = root.current;
      if (node) {
        node.style.setProperty("--ax", current.current.x.toFixed(3));
        node.style.setProperty("--ay", current.current.y.toFixed(3));
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    setMotionOn(true);

    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("touchstart", onFirstTouch);
      if (orientationBound) window.removeEventListener("deviceorientation", onOrient);
      window.cancelAnimationFrame(frame);
    };
  }, [reduced]);

  if (reduced || !motionOn) return null;
  const preset = theme.ambientPreset as AmbientPreset;
  const accent = "#737373";
  const muted = "#a3a3a3";
  const glass = theme.surfaceStyle === "glass";

  return (
    <div
      ref={root}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ ["--ax" as string]: "0", ["--ay" as string]: "0" }}
      aria-hidden
    >
      {preset === "glow" || preset === "orbits" ? (
        <>
          <Blob
            accent={accent}
            size="42vmax"
            style={{
              top: "-12%",
              left: "-8%",
              transform: `translate(calc(var(--ax) * ${preset === "orbits" ? 28 : 18}px), calc(var(--ay) * ${preset === "orbits" ? 22 : 14}px))`,
              opacity: 0.45,
            }}
          />
          <Blob
            accent={muted}
            size="36vmax"
            style={{
              right: "-10%",
              bottom: "-14%",
              transform: `translate(calc(var(--ax) * ${preset === "orbits" ? -24 : -16}px), calc(var(--ay) * ${preset === "orbits" ? -20 : -12}px))`,
              opacity: 0.32,
            }}
          />
        </>
      ) : null}
      {preset === "haze" || (glass && preset === "ripple") ? (
        <div
          className="absolute inset-6 rounded-[2rem]"
          style={{
            border: theme.hairlineBorders ? "1px solid color-mix(in oklab, white 12%, transparent)" : undefined,
            background: "rgba(255,255,255,0.03)",
            backdropFilter: glass ? `blur(${6 + theme.glassIntensity / 14}px)` : undefined,
            transform: `perspective(900px) rotateX(calc(var(--ay) * -4deg)) rotateY(calc(var(--ax) * 5deg))`,
          }}
        />
      ) : null}
      {preset === "ripple" ? (
        <div
          className="absolute left-1/2 top-1/3 size-[46vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            border: `1px solid color-mix(in oklab, ${accent} 35%, transparent)`,
            boxShadow: `0 0 80px color-mix(in oklab, ${accent} 18%, transparent)`,
            transform: `translate(calc(-50% + var(--ax) * 36px), calc(-50% + var(--ay) * 28px))`,
            opacity: 0.55,
          }}
        />
      ) : null}
    </div>
  );
}

function Blob({ accent, size, style }: { accent: string; size: string; style: CSSProperties }) {
  return (
    <div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, color-mix(in oklab, ${accent} 55%, transparent), transparent 70%)`,
        filter: "blur(8px)",
        ...style,
      }}
    />
  );
}
