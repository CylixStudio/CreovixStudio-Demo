import {
  PARTICLE_SEEDS,
  particleLimits,
  particleShare,
  type ParticleSettings,
} from "@/lib/predictionParticles";

const FLOOR = 1078;
const STEP = 1 / 120;
const GAP = 2.5;
const MAX_BODIES = 320;

export type FallingCircle = {
  id: number;
  side: number;
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  delay: number;
  sleeping: boolean;
  supported: boolean;
  rest: number;
  targetX: number | null;
  steering: number;
  retiring: boolean;
  previousX: number;
  previousY: number;
};

const sample = (id: number, salt: number) => {
  const value = Math.sin((id + 1) * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

/** Fixed-step circle contacts, with no forces or animation frames once the pile sleeps. */
export class PredictionParticlePhysics {
  bodies: FallingCircle[] = [];
  spawned = 0;
  collisions = 0;
  private share = 0.5;
  private total = 0;
  private accumulator = 0;
  private quiet = 0;
  private queue: number[] = [];
  private settings: ParticleSettings;

  constructor(settings: ParticleSettings) {
    this.settings = settings;
  }

  get active() {
    return this.queue.length > 0 || this.bodies.some((body) => !body.sleeping);
  }

  private reach(side: number, share = this.share) {
    const fraction = side === 0 ? share : 1 - share;
    return 1920 * fraction + Math.sin(Math.PI * fraction) * this.settings.particleOverlap * 0.6;
  }

  private spawn(side: number, delay: number) {
    const id = this.spawned++;
    const seed = PARTICLE_SEEDS[id % PARTICLE_SEEDS.length]!;
    const radius = Math.min(16, (seed.radius * this.settings.particleSize) / 100);
    const u = sample(id, side + 8);
    // A continuous, uneven distribution, not repeated sprite groups or identical piles.
    const spread = Math.max(
      0.01,
      Math.min(
        0.99,
        u +
          0.095 * (this.settings.particleHeight / 130) * Math.sin(u * Math.PI * 2 + side * 1.8) +
          0.045 * Math.sin(u * Math.PI * 5),
      ),
    );
    const localX = radius + spread * Math.max(0, this.reach(side) - radius * 2);
    this.bodies.push({
      id,
      side,
      radius,
      x: side === 0 ? localX : 1920 - localX,
      y: -radius - 4,
      vx: (sample(id, 12) - 0.5) * 12,
      vy: 30 + sample(id, 13) * 70,
      delay,
      sleeping: false,
      supported: false,
      rest: 0,
      targetX: null,
      steering: 0,
      retiring: false,
      previousX: side === 0 ? localX : 1920 - localX,
      previousY: -radius - 4,
    });
  }

  update(points: readonly number[], settings: ParticleSettings) {
    const oldSettings = this.settings;
    const previousShare = this.share;
    const oldReach = [this.reach(0), this.reach(1)];
    this.settings = settings;
    this.quiet = 0;
    const total = Math.max(0, points[0] ?? 0) + Math.max(0, points[1] ?? 0);
    const share = particleShare(points);
    const change = share - previousShare;
    const limits = particleLimits(share, settings);
    const budget = limits.reduce((sum, count) => sum + count, 0);
    if (total <= 0) {
      this.bodies = [];
      this.queue = [];
      this.total = 0;
      this.share = share;
      return;
    }
    this.share = share;
    if (this.total <= 0 || (this.bodies.length === 0 && this.queue.length === 0)) {
      this.bodies = [];
      this.queue = [];
      for (let index = 0; index < Math.max(...limits); index++) {
        for (const side of [0, 1]) {
          if (index < (limits[side] ?? 0)) {
            this.spawn(side, 0.18 + index * 0.018 + sample(index, side + 20) * 0.2);
          }
        }
      }
    } else {
      const geometryChanged = oldSettings.particleOverlap !== settings.particleOverlap;
      for (const body of this.bodies) {
        if (body.retiring && (body.side === 0 ? change > 0 : change < 0)) {
          body.retiring = false;
        }
        if (body.retiring) continue;
        const seed = PARTICLE_SEEDS[body.id % PARTICLE_SEEDS.length]!;
        const radius = Math.min(16, (seed.radius * settings.particleSize) / 100);
        if (body.radius !== radius) {
          body.radius = radius;
          body.sleeping = false;
          body.rest = 0;
        }
        if (Math.abs(change) > 0.001 || geometryChanged) {
          const localX = body.side === 0 ? body.x : 1920 - body.x;
          const nextX = (localX / Math.max(1, oldReach[body.side]!)) * this.reach(body.side);
          body.targetX = body.side === 0 ? nextX : 1920 - nextX;
          body.steering = 4;
          body.sleeping = false;
          body.rest = 0;
          if ((limits[body.side] ?? 0) === 0) this.retire(body);
        }
      }
      // Density changes may remove bodies by rolling them out, never by teleport/fade.
      if (
        oldSettings.particleDensity !== settings.particleDensity ||
        oldSettings.particleLowPower !== settings.particleLowPower
      ) {
        const excess = Math.max(0, this.bodies.length - budget);
        this.exitCandidates(this.bodies)
          .slice(0, excess)
          .forEach((body) => this.retire(body));
        for (let index = this.bodies.length; index < budget; index++) {
          this.queue.push(sample(index, 24) < share ? 0 : 1);
        }
      }
      if (Math.abs(change) > 0.001) {
        const side = change > 0 ? 0 : 1;
        const count = Math.min(16, Math.max(3, Math.ceil(Math.abs(change) * 40)));
        this.queue = Array.from({ length: count }, () => side);
        const excess = this.bodies.filter((body) => !body.retiring).length + count - MAX_BODIES;
        if (excess > 0) {
          this.exitCandidates(this.bodies.filter((body) => body.side !== side && !body.retiring))
            .slice(0, excess)
            .forEach((body) => this.retire(body));
        }
      }
    }
    this.total = total;
    this.fillQueue();
  }

  private exitCandidates(bodies: FallingCircle[]) {
    return [...bodies].sort(
      (a, b) => (a.side === 0 ? a.x : 1920 - a.x) - (b.side === 0 ? b.x : 1920 - b.x),
    );
  }

  private retire(body: FallingCircle) {
    body.retiring = true;
    body.targetX = body.side === 0 ? -40 : 1960;
    body.steering = Infinity;
    body.sleeping = false;
    body.rest = 0;
  }

  private fillQueue() {
    let delay = 0.12;
    while (this.queue.length > 0 && this.bodies.length < MAX_BODIES) {
      this.spawn(this.queue.shift()!, delay);
      delay += 0.06;
    }
  }

  advance(seconds: number) {
    this.accumulator += Math.min(seconds, 0.1);
    while (this.accumulator >= STEP && this.active) {
      this.step();
      this.accumulator -= STEP;
    }
    if (!this.active) this.accumulator = 0;
  }

  private step() {
    const gravity = 1100 + this.settings.particleSpeed * 12;
    const bounce = 0.025 + this.settings.particleBounce * 0.0012;
    const visible = this.bodies.filter((body) => {
      if (body.delay > 0) {
        body.delay -= STEP;
        return false;
      }
      return true;
    });
    const spillLeft = visible.some((body) => body.retiring && body.side === 0);
    const spillRight = visible.some((body) => body.retiring && body.side === 1);
    for (const body of visible) {
      body.supported = false;
      body.previousX = body.x;
      body.previousY = body.y;
      if (body.sleeping) continue;
      if (body.targetX !== null) {
        const dx = body.targetX - body.x;
        body.steering -= STEP;
        if ((Math.abs(dx) < 1.5 || body.steering <= 0) && !body.retiring) {
          body.targetX = null;
        } else {
          const speed = body.retiring ? 300 : 150;
          const wanted = Math.max(-speed, Math.min(speed, dx * 4));
          body.vx += (wanted - body.vx) * (1 - Math.exp(-STEP * 8));
        }
      }
      body.vy += gravity * STEP;
      body.x += body.vx * STEP;
      body.y += body.vy * STEP;
    }
    for (let pass = 0; pass < 6; pass++) {
      const grid = new Map<number, FallingCircle[]>();
      for (const body of visible) {
        const cx = Math.floor(body.x / 40),
          cy = Math.floor(body.y / 40);
        for (let ox = -1; ox <= 1; ox++) {
          for (let oy = -1; oy <= 1; oy++) {
            for (const other of grid.get((cy + oy) * 128 + cx + ox) ?? []) {
              this.contact(other, body, bounce);
            }
          }
        }
        const key = cy * 128 + cx;
        const cell = grid.get(key);
        if (cell) cell.push(body);
        else grid.set(key, [body]);
      }
      for (const body of visible) {
        const floor = FLOOR - body.radius;
        if (body.y >= floor - 0.15) {
          body.supported = true;
          body.y = floor;
          if (body.vy > 0) {
            if (body.vy > 45) this.collisions++;
            body.vy = body.vy > 45 ? -body.vy * bounce : 0;
          }
          if (!body.sleeping && body.targetX === null) body.vx *= 0.83;
        }
        if (!body.retiring) {
          if (!spillLeft && body.x < body.radius) {
            body.x = body.radius;
            body.vx = Math.abs(body.vx) * bounce;
          }
          if (!spillRight && body.x > 1920 - body.radius) {
            body.x = 1920 - body.radius;
            body.vx = -Math.abs(body.vx) * bounce;
          }
        }
      }
    }
    for (const body of visible) {
      if (body.sleeping) {
        if (!body.supported) {
          body.sleeping = false;
          body.rest = 0;
        }
        continue;
      }
      if (
        body.supported &&
        body.targetX === null &&
        Math.hypot(body.x - body.previousX, body.y - body.previousY) < 0.12
      ) {
        body.rest += STEP;
        if (body.rest >= 0.55) {
          body.sleeping = true;
          body.vx = 0;
          body.vy = 0;
        }
      } else {
        body.rest = 0;
      }
    }
    this.bodies = this.bodies.filter(
      (body) => body.y < 900 || (body.x > -body.radius && body.x < 1920 + body.radius),
    );
    this.fillQueue();
    const quiet =
      this.queue.length === 0 &&
      this.bodies.every(
        (body) =>
          body.delay <= 0 &&
          body.targetX === null &&
          Math.hypot(body.x - body.previousX, body.y - body.previousY) < 0.35,
      );
    this.quiet = quiet ? this.quiet + STEP : 0;
    if (this.quiet >= 0.3 || !this.active) this.sleepIsland();
  }

  private sleepIsland() {
    // Project the resting contact island before freezing it; compressed solver residuals
    // must not be baked into sleeping bodies as visible overlaps.
    for (let pass = 0; pass < 300; pass++) {
      let correction = 0;
      for (let i = 0; i < this.bodies.length; i++) {
        const a = this.bodies[i]!;
        for (let j = i + 1; j < this.bodies.length; j++) {
          const b = this.bodies[j]!;
          const dx = b.x - a.x,
            dy = b.y - a.y;
          const minimum = a.radius + b.radius + GAP;
          if (Math.abs(dx) >= minimum || Math.abs(dy) >= minimum) continue;
          const distance = Math.hypot(dx, dy);
          if (distance >= minimum) continue;
          const penetration = minimum - distance;
          const nx = distance > 0.001 ? dx / distance : 1;
          const ny = distance > 0.001 ? dy / distance : 0;
          const weight = a.radius ** 2 + b.radius ** 2;
          const wa = b.radius ** 2 / weight,
            wb = a.radius ** 2 / weight;
          a.x -= nx * penetration * wa;
          a.y -= ny * penetration * wa;
          b.x += nx * penetration * wb;
          b.y += ny * penetration * wb;
          correction = Math.max(correction, penetration);
        }
        a.x = Math.max(a.radius, Math.min(1920 - a.radius, a.x));
        a.y = Math.min(FLOOR - a.radius, a.y);
      }
      if (correction < 0.05) break;
    }
    for (const body of this.bodies) {
      body.sleeping = true;
      body.vx = 0;
      body.vy = 0;
    }
  }

  private contact(a: FallingCircle, b: FallingCircle, bounce: number) {
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const minimum = a.radius + b.radius + GAP;
    if (Math.abs(dx) > minimum + 0.3 || Math.abs(dy) > minimum + 0.3) return;
    const distance = Math.hypot(dx, dy);
    if (distance > minimum + 0.3) return;
    const nx = distance > 0.001 ? dx / distance : 1;
    const ny = distance > 0.001 ? dy / distance : 0;
    if (ny > 0.04) a.supported = true;
    if (ny < -0.04) b.supported = true;
    if (a.sleeping && b.sleeping) {
      if (distance >= a.radius + b.radius + 0.5) return;
      a.sleeping = false;
      b.sleeping = false;
      a.rest = 0;
      b.rest = 0;
    }
    const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    // A new falling circle can wake its support; resting contacts cannot cause perpetual jitter.
    const wakeSpeed =
      a.retiring || b.retiring ? 1 : a.targetX !== null || b.targetX !== null ? 15 : 70;
    if (relative < -wakeSpeed) {
      a.sleeping = false;
      b.sleeping = false;
      a.rest = 0;
      b.rest = 0;
      this.collisions++;
    }
    const wa = a.sleeping ? 0 : 1 / (a.radius * a.radius);
    const wb = b.sleeping ? 0 : 1 / (b.radius * b.radius);
    const weight = wa + wb;
    if (weight === 0) return;
    const penetration = Math.max(0, minimum - distance);
    a.x -= (nx * penetration * wa) / weight;
    a.y -= (ny * penetration * wa) / weight;
    b.x += (nx * penetration * wb) / weight;
    b.y += (ny * penetration * wb) / weight;
    if (relative < 0) {
      const impulse = (-(1 + (relative < -45 ? bounce : 0)) * relative) / weight;
      a.vx -= impulse * nx * wa;
      a.vy -= impulse * ny * wa;
      b.vx += impulse * nx * wb;
      b.vy += impulse * ny * wb;
      const tangent = (b.vx - a.vx) * -ny + (b.vy - a.vy) * nx;
      const friction = (tangent * 0.28) / weight;
      a.vx += friction * -ny * wa;
      a.vy += friction * nx * wa;
      b.vx -= friction * -ny * wb;
      b.vy -= friction * nx * wb;
    }
  }

  settle() {
    // Accessibility/static mode still uses the same collision solver, just without displaying motion.
    for (let step = 0; step < 3600 && this.active; step++) this.advance(STEP);
  }
}
