import { useEffect, useRef } from "react";

import { PredictionParticlePhysics } from "@/lib/predictionParticlePhysics";
import { particleShare, type ParticleSettings } from "@/lib/predictionParticles";

export function PredictionParticles({
  settings,
  points,
}: {
  settings: ParticleSettings;
  points: number[];
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const update = useRef<(() => void) | null>(null);
  const latest = useRef({ settings, points });
  latest.current = { settings, points };
  const firstPoints = points[0];
  const secondPoints = points[1];

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) {
      console.error("[prediction-particles] canvas_context_unavailable");
      return;
    }
    const engine = new PredictionParticlePhysics(latest.current.settings);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let intersecting = true;
    let frame = 0;
    let previous = 0;
    let disposed = false;
    const draw = () => {
      const s = latest.current.settings;
      ctx.clearRect(0, 0, 1920, 1080);
      for (const body of engine.bodies) {
        if (body.delay > 0) continue;
        ctx.fillStyle = body.side === 0 ? s.particleGreen : s.particleRed;
        ctx.beginPath();
        ctx.arc(body.x, body.y, body.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      el.dataset["share"] = particleShare(latest.current.points).toFixed(3);
      el.dataset["particleLimit"] = String(engine.bodies.length);
      el.dataset["sleeping"] = String(engine.bodies.filter((body) => body.sleeping).length);
      el.dataset["active"] = String(engine.active);
      el.dataset["spawned"] = String(engine.spawned);
      el.dataset["collisions"] = String(engine.collisions);
    };
    const render = (now: number) => {
      frame = 0;
      if (disposed || document.hidden || !intersecting) return;
      const interval = latest.current.settings.particleLowPower ? 1000 / 24 : 1000 / 40;
      if (previous && now - previous < interval) {
        frame = requestAnimationFrame(render);
        return;
      }
      engine.advance(previous ? Math.min(0.06, (now - previous) / 1000) : 0);
      previous = now;
      draw();
      if (engine.active) frame = requestAnimationFrame(render);
    };
    const resume = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      if (disposed || document.hidden || !intersecting) return;
      if (!latest.current.settings.particleMotion || reduced.matches) {
        engine.settle();
        draw();
      } else {
        draw();
        if (engine.active) frame = requestAnimationFrame(render);
      }
    };
    update.current = () => {
      engine.update(latest.current.points, latest.current.settings);
      resume();
    };
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry?.isIntersecting ?? false;
      resume();
    });
    observer.observe(el);
    document.addEventListener("visibilitychange", resume);
    reduced.addEventListener("change", resume);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", resume);
      reduced.removeEventListener("change", resume);
      update.current = null;
    };
  }, []);
  useEffect(() => {
    update.current?.();
  }, [
    firstPoints,
    secondPoints,
    settings.particleSize,
    settings.particleDensity,
    settings.particleHeight,
    settings.particleOverlap,
    settings.particleLowPower,
    settings.particleMotion,
    settings.particleSpeed,
    settings.particleBounce,
    settings.particleGreen,
    settings.particleRed,
  ]);

  return (
    <canvas
      ref={canvas}
      width={1920}
      height={1080}
      data-testid="prediction-particles"
      aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
