import assert from "node:assert/strict";
import test from "node:test";
import {
  PredictionParticleLifecycle,
  officialWinner,
  readPredictionReceipt,
} from "../src/lib/predictionParticleLifecycle.ts";
import { emptyPredictionRuntime, type PredictionRuntime } from "../src/lib/interactiveWidgets.ts";
import { parseParticleSettings } from "../src/lib/predictionParticles.ts";

const runtime = (
  status: PredictionRuntime["status"],
  winnerId: string | null = null,
): PredictionRuntime => ({
  ...emptyPredictionRuntime(),
  status,
  winnerId,
  title: "A real prediction",
  outcomes: [
    { id: "first", label: "Green", points: 3000, voters: 30 },
    { id: "second", label: "Red", points: 7000, voters: 70 },
  ],
  updatedAt: "2026-10-23T10:00:00Z",
  revision: 1,
});

test("actual source lifecycle controls opening, closing, long wait and explicit winner; no inferred winner", () => {
  const machine = new PredictionParticleLifecycle(null);
  machine.receive(null, 0, 2600, true);
  assert.equal(machine.presentation.phase, "IDLE");
  machine.receive(runtime("open"), 100, 2600, true);
  assert.equal(machine.presentation.phase, "OPENING");
  const key = machine.presentation.key;
  machine.tick(550, 6000);
  assert.equal(machine.presentation.phase, "VOTING");
  machine.receive({ ...runtime("open"), title: "Updated title", revision: 55 }, 600, 2600, true);
  assert.equal(machine.presentation.key, key);
  assert.equal(machine.presentation.phase, "VOTING");
  machine.receive(runtime("locked"), 1000, 2600, true);
  assert.equal(machine.presentation.phase, "CLOSING");
  assert.equal(officialWinner(machine.presentation.runtime), -1);
  machine.tick(1750, 6000);
  assert.equal(machine.presentation.phase, "WAITING_FOR_RESULT");
  machine.tick(9999999, 6000);
  assert.equal(machine.presentation.phase, "WAITING_FOR_RESULT");
  machine.receive(runtime("resolved", "first"), 10000000, 2600, true);
  assert.equal(machine.presentation.phase, "REVEALING_WINNER");
  assert.equal(
    officialWinner(machine.presentation.runtime),
    0,
    "winner is explicitly chosen even with fewer points",
  );
  assert.equal(machine.presentation.runtime?.outcomes[0]?.points, 3000);
  machine.tick(10002600, 6000);
  assert.equal(machine.presentation.phase, "RESULT_DISPLAY");
  machine.tick(10008600, 6000);
  assert.equal(machine.presentation.phase, "CLOSING");
  machine.tick(10009350, 6000);
  assert.equal(machine.presentation.phase, "HIDDEN");
});

test("receipts suppress replay on repeated events/refresh, but a new open cycle can reveal again", () => {
  const machine = new PredictionParticleLifecycle(null);
  machine.receive(runtime("resolved", "second"), 100, 2600, true);
  const key = machine.presentation.key;
  machine.receive({ ...runtime("resolved", "second"), revision: 90 }, 400, 2600, true);
  assert.equal(machine.presentation.key, key);
  assert.equal(machine.presentation.until, 2700);
  const refreshed = new PredictionParticleLifecycle(structuredClone(machine.receipt));
  refreshed.receive(runtime("resolved", "second"), 1000, 2600, true);
  assert.equal(refreshed.presentation.runtime, null);
  refreshed.receive(runtime("open"), 2000, 2600, true);
  assert.equal(refreshed.presentation.phase, "OPENING");
  refreshed.receive(runtime("resolved", "second"), 3000, 2600, true);
  assert.equal(refreshed.presentation.phase, "REVEALING_WINNER");
});

test("closed reload and cancellation stay hidden without inventing a result", () => {
  const machine = new PredictionParticleLifecycle(null);
  machine.receive(runtime("locked"), 0, 2600, true);
  assert.equal(machine.presentation.phase, "WAITING_FOR_RESULT");
  assert.equal(machine.presentation.runtime, null);
  machine.receive(runtime("resolved"), 100, 2600, true);
  assert.equal(machine.presentation.phase, "WAITING_FOR_RESULT");
  machine.receive(runtime("open"), 200, 2600, false);
  assert.equal(machine.presentation.phase, "VOTING");
  machine.receive(runtime("idle"), 300, 2600, true);
  machine.tick(1050, 6000);
  assert.equal(machine.presentation.phase, "HIDDEN");
  machine.receive(runtime("idle"), 2000, 2600, true);
  assert.equal(machine.presentation.runtime, null);
});

test("invalid/expired results cannot show a winner; settings are persisted and bounded", () => {
  assert.equal(officialWinner(runtime("resolved", "unknown")), -1);
  assert.equal(officialWinner(runtime("locked", "first")), -1);
  const machine = new PredictionParticleLifecycle(null);
  machine.receive(
    { ...runtime("resolved", "first"), hideAt: "2020-01-01T00:00:00Z" },
    Date.now(),
    2600,
    true,
  );
  assert.equal(machine.presentation.phase, "HIDDEN");
  const parsed = parseParticleSettings(
    JSON.parse(
      JSON.stringify({
        particleWinnerDuration: 500,
        particleResultDuration: 99999,
        particleOpeningAnimation: false,
        particleWinnerAnimation: false,
      }),
    ),
  );
  assert.equal(parsed.particleWinnerDuration, 2000);
  assert.equal(parsed.particleResultDuration, 8000);
  assert.equal(parsed.particleOpeningAnimation, false);
  assert.equal(parsed.particleWinnerAnimation, false);
});

test("receipt validation rejects corrupt data rather than silently accepting it", () => {
  const store = { getItem: () => '{"identity":4}' };
  assert.throws(() => readPredictionReceipt(store, "key"), /invalid_prediction_receipt/);
});
