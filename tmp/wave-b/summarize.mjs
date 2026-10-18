import { readFileSync, writeFileSync } from "node:fs";

const raw = readFileSync(new URL("./before.json", import.meta.url));
const utf16 = raw[0] === 0xff && raw[1] === 0xfe || raw[1] === 0;
const text = (utf16 ? raw.toString("utf16le") : raw.toString("utf8")).replace(/^\uFEFF/, "");
const data = JSON.parse(text);
const rows = [];
for (const [key, value] of Object.entries(data.pages)) {
  rows.push({
    key,
    wall: value.wallMs,
    ttfb: value.timing?.ttfbMs ?? null,
    response: value.timing?.responseMs ?? null,
    dcl: value.timing?.domContentLoadedMs ?? null,
    load: value.timing?.loadMs ?? null,
    ready: value.contentReadyMs,
    ok: value.contentOk,
    href: value.href,
    counts: value.counts,
    long: value.longTaskCount,
    longMs: value.longTaskMs,
    maxLong: value.maxLongTaskMs,
    resources: value.resourceCount,
    cards: value.cards,
    switches: value.switches,
    snippet: (value.snippet || "").slice(0, 100),
    interesting: (value.interesting || []).filter((line) => /server|\/api|POST/.test(line)).slice(0, 20),
  });
}
writeFileSync(
  new URL("./before-summary.json", import.meta.url),
  JSON.stringify({ rows, interactions: data.interactions }, null, 2),
);
console.log("rows", rows.length);
