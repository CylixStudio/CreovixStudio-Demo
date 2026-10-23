import assert from "node:assert/strict";
import test from "node:test";
import { parsePredictionConfig } from "../src/lib/widgets.ts";
import { parsePredictionRuntime, predictionCardVisible } from "../src/lib/interactiveWidgets.ts";
import {
  PARTICLE_DEFAULTS,
  PARTICLE_SEEDS,
  parseParticleSettings,
  particleShare,
  winnerCoverProgress,
  WINNER_REVEAL_DURATION_MS,
} from "../src/lib/predictionParticles.ts";
import { PredictionParticlePhysics } from "../src/lib/predictionParticlePhysics.ts";

test("winner cover pauses 250ms then smoothly completes within 1100ms", () => {
  assert.equal(winnerCoverProgress(0), 0);
  assert.equal(winnerCoverProgress(249), 0);
  assert.equal(winnerCoverProgress(250), 0);
  assert.ok(winnerCoverProgress(500) > 0 && winnerCoverProgress(500) < 1);
  assert.equal(winnerCoverProgress(WINNER_REVEAL_DURATION_MS), 1);
  assert.equal(winnerCoverProgress(5000), 1);
  for (let time = 0; time < WINNER_REVEAL_DURATION_MS; time += 10) {
    assert.ok(winnerCoverProgress(time + 10) >= winnerCoverProgress(time));
  }
});

test("legacy prediction remains classic; particle config is bounded and survives JSON persistence", () => {
  assert.equal(parsePredictionConfig({}).layout, "classic");
  const raw = { layout: "particle-clash", ...PARTICLE_DEFAULTS, particleDensity: 120 };
  assert.equal(parsePredictionConfig(JSON.parse(JSON.stringify(raw))).particleDensity, 120);
  assert.equal(parsePredictionConfig(raw).layout, "particle-clash");
  const settings = parseParticleSettings({
    particleSize: Infinity,
    particleDensity: 10000,
    particleGreen: "invalid",
  });
  assert.equal(settings.particleSize, 100);
  assert.equal(settings.particleDensity, 150);
  assert.equal(settings.particleGreen, "#2bfbb7");
});

test("ratios do not depend on absolute votes; empty geometry has a neutral internal origin", () => {
  assert.equal(particleShare([0, 0]), 0.5);
  assert.equal(particleShare([7000, 3000]), 0.7);
  assert.equal(particleShare([7000000, 3000000]), 0.7);
});

test("Prediction's existing runtime preserves custom source data and lifecycle without inventing a result", () => {
  const idle = parsePredictionRuntime({});
  assert.equal(idle.status, "idle");
  assert.equal(idle.title, "");
  assert.deepEqual(idle.outcomes, []);
  const prediction = {
    status: "open",
    title: "هل نفوز على البوس؟",
    outcomes: [
      { id: "win", label: "نفوز", points: 7000000, voters: 3141 },
      { id: "lose", label: "نخسر", points: 3000000, voters: 1592 },
    ],
    endsAt: "2030-01-01T00:00:00.000Z",
    hideAt: null,
    winnerId: null,
    revision: 4,
  };
  const runtime = parsePredictionRuntime({ prediction });
  assert.equal(runtime.title, prediction.title);
  assert.deepEqual(runtime.outcomes, prediction.outcomes);
  assert.equal(particleShare(runtime.outcomes.map((outcome) => outcome.points)), 0.7);
  assert.ok(predictionCardVisible(runtime, Date.now()));
  const resolved = parsePredictionRuntime({
    prediction: {
      ...prediction,
      status: "resolved",
      winnerId: "win",
      hideAt: "2020-01-01T00:00:00Z",
    },
  });
  assert.equal(resolved.winnerId, "win");
  assert.equal(predictionCardVisible(resolved, Date.now()), false);
});

test("diameters match the reference ranges with no giant circles at any size setting", () => {
  const diameters = PARTICLE_SEEDS.map((seed) => seed.radius * 2);
  assert.ok(diameters.every((value) => value >= 6 && value <= 32));
  assert.ok(diameters.filter((value) => value >= 10 && value <= 22).length >= 110);
  assert.ok(diameters.some((value) => value < 9));
  assert.ok(diameters.filter((value) => value > 22).length < 20);
  const engine = new PredictionParticlePhysics({ ...PARTICLE_DEFAULTS, particleSize: 150 });
  engine.update([90, 10], { ...PARTICLE_DEFAULTS, particleSize: 150 });
  assert.ok(engine.bodies.every((body) => body.radius <= 16));
  assert.equal(parseParticleSettings({ particleHeight: 300 }).particleHeight, 160);
});

function settle(engine: PredictionParticlePhysics) {
  let elapsed = 0;
  while (engine.active && elapsed < 15) {
    engine.advance(1 / 60);
    elapsed += 1 / 60;
  }
  assert.equal(engine.active, false, `must stop its loop within 15s (ran ${elapsed}s)`);
  for (const [index, a] of engine.bodies.entries()) {
    assert.equal(a.sleeping, true);
    assert.equal(a.vx, 0);
    assert.equal(a.vy, 0);
    assert.ok(a.y + a.radius <= 1078.001);
    for (const b of engine.bodies.slice(index + 1)) {
      assert.ok(
        Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius - 0.1,
        `bodies ${a.id}/${b.id} overlap`,
      );
    }
  }
}

test("empty scene -> top spawn -> gravity -> collision/bounce -> stack -> exact sleep", () => {
  const engine = new PredictionParticlePhysics(PARTICLE_DEFAULTS);
  engine.update([0, 0], PARTICLE_DEFAULTS);
  assert.deepEqual(engine.bodies, []);
  assert.equal(engine.active, false);
  engine.update([50, 50], PARTICLE_DEFAULTS);
  assert.equal(engine.bodies.length, 200);
  assert.ok(engine.bodies.every((body) => body.y + body.radius < 0 && body.delay > 0));
  for (let step = 0; step < 40; step++) engine.advance(1 / 120);
  const first = engine.bodies[0]!;
  assert.ok(
    first.y > 0 && first.y < 200,
    "must travel down from the actual top, not spawn near the floor",
  );
  const velocity = first.vy;
  engine.advance(0.1);
  assert.ok(first.vy > velocity, "gravity accelerates falling bodies");
  let bounced = false;
  for (let step = 0; step < 600 && engine.active; step++) {
    engine.advance(1 / 120);
    bounced ||= engine.bodies.some((body) => body.y > 900 && body.vy < -1);
  }
  assert.ok(bounced, "actual upward velocity following contact, not an opacity animation");
  assert.ok(engine.collisions > 0);
  settle(engine);
  assert.ok(
    engine.bodies.some((body) => body.y + body.radius < 1040),
    "circles stack above other circles",
  );
  assert.ok(
    engine.bodies.every((body) => body.y - body.radius > 930),
    "upper stage clears after falling",
  );
  const frozen = structuredClone(engine.bodies);
  for (let step = 0; step < 600; step++) engine.advance(1 / 60);
  assert.deepEqual(engine.bodies, frozen, "sleeping circles must remain bit-for-bit stationary");
});

test("50/50 -> 70/30 -> 30/70 drops only the gaining side's small batch and retains existing bodies", () => {
  const engine = new PredictionParticlePhysics(PARTICLE_DEFAULTS);
  engine.update([50, 50], PARTICLE_DEFAULTS);
  settle(engine);
  const first = engine.bodies[0]!;
  const radius = first.radius;
  const initialX = first.x;
  for (const [share, side] of [
    [70, 0],
    [30, 1],
  ] as const) {
    const count = engine.spawned;
    engine.update([share * 10000, (100 - share) * 10000], PARTICLE_DEFAULTS);
    assert.ok(engine.spawned - count >= 3 && engine.spawned - count <= 16);
    const added = engine.bodies.filter((body) => body.id >= count);
    assert.ok(added.every((body) => body.side === side && body.y + body.radius < 0));
    assert.equal(engine.bodies[0], first, "do not reset/recreate existing bodies");
    assert.equal(first.radius, radius, "votes must never inflate the circles");
    settle(engine);
    if (side === 0) assert.ok(first.x > initialX, "green extends into the opposing space");
  }
  const frozen = structuredClone(engine.bodies);
  engine.update([30000000, 70000000], PARTICLE_DEFAULTS);
  assert.deepEqual(engine.bodies, frozen, "same share / title refresh must not restart animation");
  assert.equal(engine.active, false);
});

test("long sessions, low power and maximum size/density stay bounded and eventually sleep", () => {
  for (const settings of [
    PARTICLE_DEFAULTS,
    { ...PARTICLE_DEFAULTS, particleLowPower: true },
    { ...PARTICLE_DEFAULTS, particleDensity: 150, particleSize: 150 },
  ]) {
    const engine = new PredictionParticlePhysics(settings);
    for (const share of [50, 70, 30, 90, 10, 50, 70, 30, 70, 30, 70, 30]) {
      engine.update([share, 100 - share], settings);
      settle(engine);
      assert.ok(engine.bodies.length <= 320);
      assert.ok(engine.bodies.some((body) => body.side === 0));
      assert.ok(engine.bodies.some((body) => body.side === 1));
    }
    engine.update([0, 0], settings);
    assert.deepEqual(engine.bodies, []);
    assert.equal(engine.active, false);
  }
});

test("seeded physical motion is reproducible; static/reduced-motion shares the collision solver", () => {
  const first = new PredictionParticlePhysics(PARTICLE_DEFAULTS);
  const second = new PredictionParticlePhysics(PARTICLE_DEFAULTS);
  for (const engine of [first, second]) {
    engine.update([70, 30], PARTICLE_DEFAULTS);
    engine.settle();
    assert.equal(engine.active, false);
  }
  assert.deepEqual(first.bodies, second.bodies);
});
