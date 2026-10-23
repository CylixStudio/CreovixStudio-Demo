import { useEffect, useRef } from "react";

import { PredictionParticlePhysics } from "@/lib/predictionParticlePhysics";
import {
  particleShare,
  winnerCoverProgress,
  WINNER_REVEAL_DURATION_MS,
  type ParticleSettings,
} from "@/lib/predictionParticles";

export function PredictionParticles({
  settings,
  points,
  winnerSide = -1,
  cinematicWinner = false,
  frozen = false,
  instantOpening = false,
}: {
  settings: ParticleSettings;
  points: number[];
  winnerSide?: number;
  cinematicWinner?: boolean;
  frozen?: boolean;
  instantOpening?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const update = useRef<(() => void) | null>(null);
  const latest = useRef({ settings, points, winnerSide, cinematicWinner, frozen, instantOpening });
  latest.current = { settings, points, winnerSide, cinematicWinner, frozen, instantOpening };
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
    let revealSide = -1;
    let revealElapsed = 0;
    let revealBodies: typeof engine.bodies = [];
    let initialized = false;
    let captured = false;
    const duration = () =>
      latest.current.cinematicWinner
        ? latest.current.settings.particleWinnerDuration
        : WINNER_REVEAL_DURATION_MS;
    const fallDuration = () =>
      latest.current.cinematicWinner ? duration() - WINNER_REVEAL_DURATION_MS : 0;
    const revealing = () => revealSide >= 0 && revealElapsed < duration();
    const draw = () => {
      const s = latest.current.settings;
      ctx.clearRect(0, 0, 1920, 1080);
      const falling = revealSide >= 0 && latest.current.cinematicWinner && !captured;
      const cover = winnerCoverProgress(revealElapsed - fallDuration());
      const bodies = revealSide >= 0 && !falling ? revealBodies : engine.bodies;
      for (const body of bodies) {
        if (body.delay > 0) continue;
        const originalColor = body.side === 0 ? s.particleGreen : s.particleRed;
        const winnerColor = revealSide === 0 ? s.particleGreen : s.particleRed;
        const distance = (revealSide === 0 ? body.x : 1920 - body.x) / 1920;
        const takeover =
          revealSide < 0 || falling
            ? 0
            : Math.max(0, Math.min(1, (cover * 1.12 - distance) / 0.12));
        const shift =
          revealSide < 0
            ? 0
            : (revealSide === 0 ? 1 : -1) * Math.sin(Math.PI * cover) * 18 * takeover;
        const x = Math.max(body.radius, Math.min(1920 - body.radius, body.x + shift));
        ctx.fillStyle = originalColor;
        ctx.globalAlpha = revealSide >= 0 && body.side !== revealSide ? 1 - takeover : 1;
        ctx.beginPath();
        ctx.arc(x, body.y, body.radius, 0, Math.PI * 2);
        ctx.fill();
        if (revealSide >= 0 && body.side !== revealSide && takeover > 0) {
          ctx.fillStyle = winnerColor;
          ctx.globalAlpha = takeover;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      el.dataset["share"] = particleShare(latest.current.points).toFixed(3);
      el.dataset["particleLimit"] = String(engine.bodies.length);
      el.dataset["sleeping"] = String(engine.bodies.filter((body) => body.sleeping).length);
      el.dataset["active"] = String(revealSide >= 0 ? revealing() : engine.active);
      el.dataset["winnerRevealMode"] = "cover";
      el.dataset["winnerSide"] = String(revealSide);
      el.dataset["winnerRevealProgress"] = cover.toFixed(3);
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
      const dt = previous ? Math.min(0.06, (now - previous) / 1000) : 0;
      if (revealSide >= 0) {
        revealElapsed = Math.min(duration(), revealElapsed + dt * 1000);
        if (latest.current.cinematicWinner && !captured) {
          const fallStep = (dt * 3000) / Math.max(900, fallDuration()) / 2;
          engine.advance(fallStep);
          engine.advance(fallStep);
          if (revealElapsed >= fallDuration()) {
            engine.settle();
            revealBodies = engine.bodies.map((body) => ({ ...body }));
            captured = true;
          }
        }
      } else engine.advance(dt);
      previous = now;
      draw();
      if (revealSide >= 0 ? revealing() : engine.active) frame = requestAnimationFrame(render);
    };
    const resume = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      if (disposed || document.hidden || !intersecting) return;
      if (
        !latest.current.settings.particleMotion ||
        reduced.matches ||
        (revealSide >= 0 && !latest.current.settings.particleWinnerAnimation)
      ) {
        if (revealSide >= 0) {
          engine.settle();
          revealBodies = engine.bodies.map((body) => ({ ...body }));
          captured = true;
          revealElapsed = duration();
        } else engine.settle();
        draw();
      } else {
        draw();
        if (revealSide >= 0 ? revealing() : engine.active) frame = requestAnimationFrame(render);
      }
    };
    update.current = () => {
      if (!latest.current.frozen) {
        const s = latest.current.settings;
        // Result particles are a bounded visual sample of both options, not new votes.
        const resultShare = Math.max(0.1, Math.min(0.9, particleShare(latest.current.points)));
        engine.update(
          latest.current.cinematicWinner ? [resultShare, 1 - resultShare] : latest.current.points,
          latest.current.cinematicWinner
            ? { ...s, particleDensity: Math.min(s.particleDensity, 35) }
            : s,
        );
      }
      if (!initialized && latest.current.instantOpening && !latest.current.cinematicWinner)
        engine.settle();
      initialized = true;
      const side = latest.current.winnerSide;
      const nextSide = side === 0 || side === 1 ? side : -1;
      if (nextSide !== revealSide) {
        if (nextSide >= 0) {
          // A direct visit to an already resolved prediction must not freeze circles above the source.
          if (!latest.current.cinematicWinner) {
            if (engine.bodies.every((body) => body.delay > 0)) engine.settle();
            revealBodies = engine.bodies.map((body) => ({ ...body }));
            captured = true;
          }
        } else revealBodies = [];
        revealSide = nextSide;
        revealElapsed = 0;
      }
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
    winnerSide,
    cinematicWinner,
    frozen,
    instantOpening,
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
    settings.particleWinnerAnimation,
    settings.particleWinnerDuration,
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
