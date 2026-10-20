// Feeds realistic BotRix leaderboard samples through the shared mapper and prints the result.
// Run: node scripts/botrix-leaderboard-check.mjs
import assert from "node:assert/strict";

import { parseBotRixFile, planLeaderboardImport, toImportRow, unmappedOf } from "../src/lib/botrixLeaderboard.ts";

const apiJson = JSON.stringify([
  { level: 100, watchtime: 136160, xp: 1001260, points: 200100, name: "Quadarian", followage: { date: "2023-08-21 23:20:15.000000" } },
  { level: 5, watchtime: 133795, xp: 2500, points: 135795, name: "Leeqo", followage: { date: "2023-02-12 18:30:56.000000" } },
  { level: 0, watchtime: 0, xp: 0, points: 0, name: "zero_row", followage: { date: "2023-06-17 01:38:48.000000" } },
  { points: 4200, name: "points_only" },
  { name: "name_only" },
  { level: 7, points: 900, name: "no_watchtime" },
  { watchtime: 90, name: "watch_only" },
  { points: 5 },
]);

const csv = "name;level;points;xp;watchtime;followage\nCsvUser;12;3300;1200;600;2023-01-01\nSecond,User;;50;;\n";
const secondsFile = JSON.stringify({ members: [{ display_name: "Own", level: 3, points: 10, watch_seconds: 7260 }] });

function show(title, text, fileName) {
  const parsed = parseBotRixFile(text, fileName);
  console.log(`\n=== ${title} ===`);
  assert.ok(parsed.ok, "parse failed");
  console.log(`format=${parsed.format} rows=${parsed.rows.length} invalid=${parsed.invalid}`);
  for (const row of parsed.rows) console.log(JSON.stringify({ in: row.name, ...toImportRow(row) }), "extra:", JSON.stringify(row.extra), "xp:", row.xp);
  console.log("unmapped:", JSON.stringify(unmappedOf(parsed.rows)));
  return parsed;
}

const api = show("API-style JSON", apiJson, "leaderboard.json");
const byName = Object.fromEntries(api.rows.map((row) => [row.name, toImportRow(row)]));
assert.equal(byName["Quadarian"].level, 100);
assert.equal(byName["Quadarian"].watchSeconds, 136160 * 60);
assert.equal(byName["points_only"].level, null);
assert.equal(byName["points_only"].watchSeconds, null);
assert.equal(byName["watch_only"].watchSeconds, 5400);
assert.equal(api.invalid, 1);
assert.deepEqual(unmappedOf(api.rows).find((entry) => entry.name === "Quadarian").fields, {
  xp: 1001260,
  "followage.date": "2023-08-21 23:20:15.000000",
});

const csvParsed = show("CSV (semicolon)", csv, "export.csv");
assert.equal(toImportRow(csvParsed.rows[0]).watchSeconds, 36000);
assert.equal(toImportRow(csvParsed.rows[1]).level, null);
const own = show("watch_seconds file", secondsFile, "members.json");
assert.equal(toImportRow(own.rows[0]).watchSeconds, 7260);

const plan = planLeaderboardImport(
  [
    { id: "a", display_name: "quadarian" },
    { id: "b", display_name: "points_only" },
  ],
  api.rows.map(toImportRow),
);
console.log("\n=== plan against existing [quadarian, points_only] ===");
console.log("updates:", JSON.stringify(plan.updates));
console.log("inserts:", JSON.stringify(plan.inserts));
console.log("skipped:", plan.skipped);
assert.deepEqual(plan.updates[0], { ids: ["a"], patch: { points: 200100, level: 100, watch_seconds: 8169600 } });
assert.deepEqual(plan.updates.find((u) => u.ids[0] === "b").patch, { points: 4200 });
assert.deepEqual(plan.inserts.find((m) => m.display_name === "zero_row"), { display_name: "zero_row", level: 1, points: 0, watch_seconds: 0 });
assert.deepEqual(plan.inserts.find((m) => m.display_name === "no_watchtime"), { display_name: "no_watchtime", level: 7, points: 900, watch_seconds: 0 });
assert.equal(plan.skipped, 1);
console.log("\nALL CHECKS PASSED");
