import assert from "node:assert/strict";
import test from "node:test";

import { createRevisionGate } from "../src/lib/demoRevision.ts";
import { normalizeDemoFile } from "../src/lib/demoState.ts";
import {
  clearPublicCommandsCache,
  createPublicCommandsCache,
  readPublicCommandsCache,
  writePublicCommandsCache,
} from "../src/lib/publicCommandsCache.ts";

test("demo revision wait resolves when the file revision bumps", async () => {
  const gate = createRevisionGate();
  const signal = new AbortController().signal;
  const started = performance.now();
  const pending = gate.wait(0, signal, 5_000);
  assert.equal(gate.current(), 0);
  gate.bump();
  assert.equal(await pending, 1);
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 200, `wake took ${elapsed}ms`);
});

test("demo revision wait does not resolve before a change", async () => {
  const gate = createRevisionGate();
  const started = performance.now();
  const rev = await gate.wait(0, new AbortController().signal, 40);
  const elapsed = performance.now() - started;
  assert.equal(rev, 0);
  assert.ok(elapsed >= 15, `returned in ${elapsed}ms`);
});

test("stored chat lines keep their order through demo normalize", () => {
  const state = normalizeDemoFile({
    widgets: [
      {
        id: "w1",
        public_token: "demo-order",
        type: "CHAT_BOX",
        name: "Chat",
        config: {},
        state: {},
        is_enabled: true,
      },
    ],
    messages: {
      "demo-order": [
        { id: "newer", platform: "KICK", author: "A", text: "جديد", at: 2 },
        { id: "older", platform: "KICK", author: "B", text: "hello مرحبا", at: 1 },
      ],
    },
  });
  assert.deepEqual(
    state.messages["demo-order"]?.map((row) => row.id),
    ["newer", "older"],
  );
});

test("public commands cache skips a second load inside the ttl", async () => {
  clearPublicCommandsCache();
  const page = {
    found: true as const,
    slug: "creovixstudio",
    displayName: "creovixstudio",
    avatarUrl: "",
    commands: [{ trigger: "!discord", response: "hi" }],
    timers: [],
  };
  const samples: number[] = [];
  for (let i = 0; i < 5; i += 1) {
    const started = performance.now();
    const hit = readPublicCommandsCache<typeof page>("creovixstudio", 1_000 + i);
    if (hit) {
      samples.push(performance.now() - started);
      continue;
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
    writePublicCommandsCache("creovixstudio", page, 1_000 + i);
    samples.push(performance.now() - started);
  }
  assert.ok(samples[0]! >= 25, `first ${samples[0]}`);
  for (const sample of samples.slice(1)) assert.ok(sample < 15, `cached ${sample}`);
  assert.equal(readPublicCommandsCache<typeof page>("creovixstudio", 11_000), null);
  assert.equal(readPublicCommandsCache("missing", 1_000), null);
  writePublicCommandsCache("missing", { found: false }, 1_000);
  assert.equal(readPublicCommandsCache("missing", 1_001), null);
});

test("public commands cache is isolated by slug and rejects private or incomplete pages", () => {
  clearPublicCommandsCache();
  const now = 5_000;
  const alpha = {
    found: true as const,
    slug: "alpha",
    displayName: "Alpha",
    avatarUrl: "",
    commands: [{ trigger: "!a", response: "alpha" }],
    timers: [],
  };
  const beta = { ...alpha, slug: "beta", displayName: "Beta", commands: [{ trigger: "!b", response: "beta" }] };
  assert.equal(writePublicCommandsCache("alpha", alpha, now), true);
  assert.equal(writePublicCommandsCache("beta", beta, now), true);
  assert.equal(readPublicCommandsCache<typeof alpha>("alpha", now)?.displayName, "Alpha");
  assert.equal(readPublicCommandsCache<typeof beta>("beta", now)?.commands[0]?.trigger, "!b");
  assert.equal(readPublicCommandsCache("ALPHA", now)?.displayName, "Alpha");
  assert.equal(
    writePublicCommandsCache("alpha", { ...alpha, userId: "secret-user" } as typeof alpha, now),
    false,
  );
  assert.equal(readPublicCommandsCache("alpha", now), null);
  assert.equal(
    writePublicCommandsCache("beta", { found: true, slug: "beta", displayName: "Beta" } as typeof beta, now),
    false,
  );
  assert.equal(readPublicCommandsCache("beta", now), null);
  assert.equal(writePublicCommandsCache("beta", { ...beta, slug: "other" }, now), false);
});

test("two command caches do not share rows", () => {
  const first = createPublicCommandsCache();
  const second = createPublicCommandsCache();
  const page = {
    found: true as const,
    slug: "alpha",
    displayName: "Alpha",
    commands: [],
    timers: [],
  };
  assert.equal(first.write("alpha", page, 1), true);
  assert.equal(second.read("alpha", 1), null);
  second.clear();
  assert.equal(first.read("alpha", 1)?.displayName, "Alpha");
});
