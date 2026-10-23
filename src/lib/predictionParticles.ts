export const PARTICLE_DEFAULTS = {
  particleSize: 100,
  particleDensity: 100,
  particleHeight: 130,
  particleGreen: "#2bfbb7",
  particleRed: "#fe8a8a",
  particleOverlap: 45,
  particleSpeed: 50,
  particleBounce: 25,
  particleMotion: true,
  particleLowPower: false,
  particleOpeningAnimation: true,
  particleWinnerAnimation: true,
  particleWinnerDuration: 2600,
  particleResultDuration: 6000,
};

export type ParticleSettings = typeof PARTICLE_DEFAULTS;

export const WINNER_REVEAL_PAUSE_MS = 250;
export const WINNER_REVEAL_DURATION_MS = 1100;

export function winnerCoverProgress(elapsedMs: number) {
  const progress = Math.max(
    0,
    Math.min(
      1,
      (elapsedMs - WINNER_REVEAL_PAUSE_MS) / (WINNER_REVEAL_DURATION_MS - WINNER_REVEAL_PAUSE_MS),
    ),
  );
  return progress * progress * (3 - 2 * progress);
}

export function parseParticleSettings(raw: Record<string, unknown>): ParticleSettings {
  const bounded = (key: keyof ParticleSettings, min: number, max: number) => {
    const value = raw[key];
    return typeof value === "number" && Number.isFinite(value)
      ? Math.max(min, Math.min(max, value))
      : Number(PARTICLE_DEFAULTS[key]);
  };
  const color = (key: "particleGreen" | "particleRed") =>
    typeof raw[key] === "string" && /^#[0-9a-f]{6}$/i.test(raw[key])
      ? raw[key]
      : PARTICLE_DEFAULTS[key];
  return {
    particleSize: bounded("particleSize", 50, 150),
    particleDensity: bounded("particleDensity", 30, 150),
    particleHeight: bounded("particleHeight", 70, 160),
    particleGreen: color("particleGreen"),
    particleRed: color("particleRed"),
    particleOverlap: bounded("particleOverlap", 0, 100),
    particleSpeed: bounded("particleSpeed", 10, 100),
    particleBounce: bounded("particleBounce", 0, 100),
    particleMotion: raw["particleMotion"] !== false,
    particleLowPower: raw["particleLowPower"] === true,
    particleOpeningAnimation: raw["particleOpeningAnimation"] !== false,
    particleWinnerAnimation: raw["particleWinnerAnimation"] !== false,
    particleWinnerDuration: bounded("particleWinnerDuration", 2000, 3000),
    particleResultDuration: bounded("particleResultDuration", 5000, 8000),
  };
}

// Stable individual sizes sampled from the supplied SVG circle style.
export const PARTICLE_SEEDS = Array.from({ length: 160 }, (_, id) => {
  const random = (salt: number) => {
    const n = Math.sin((id + 1) * 127.1 + salt * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const size = random(3);
  const diameter =
    size < 0.16
      ? 6 + (size / 0.16) * 3
      : size < 0.94
        ? 10 + ((size - 0.16) / 0.78) * 12
        : 28 + ((size - 0.94) / 0.06) * 4;
  return {
    id,
    radius: diameter / 2,
  };
});

export function particleShare(points: readonly number[]): number {
  const a = Math.max(0, points[0] ?? 0);
  const b = Math.max(0, points[1] ?? 0);
  return a + b > 0 ? a / (a + b) : 0.5;
}

export function particleLimits(share: number, settings: ParticleSettings): number[] {
  const budget = ((200 * settings.particleDensity) / 100) * (settings.particleLowPower ? 0.65 : 1);
  return [share, 1 - share].map((fraction) =>
    fraction <= 0 ? 0 : Math.min(PARTICLE_SEEDS.length, Math.max(6, Math.round(budget * fraction))),
  );
}
