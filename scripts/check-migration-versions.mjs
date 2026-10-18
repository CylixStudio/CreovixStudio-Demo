/**
 * Fail when two migration files share a 14-digit version prefix,
 * except the pair production already applied (do not rename those).
 * Does not connect to a database.
 */
import { readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = resolve(root, "supabase/migrations");
const files = readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();

/** Full stems already recorded in production. Do not rename them. */
const APPLIED_DUPLICATE_OK = new Set([
  "20261004220000_bio_links.sql",
  "20261004220000_user_default_platform.sql",
]);

const byPrefix = new Map();
for (const name of files) {
  const prefix = name.slice(0, 14);
  if (!/^\d{14}$/.test(prefix)) {
    console.error(`version prefix is not 14 digits: ${name}`);
    process.exit(1);
  }
  const list = byPrefix.get(prefix) ?? [];
  list.push(name);
  byPrefix.set(prefix, list);
}

const duplicates = [...byPrefix.entries()].filter(([, names]) => names.length > 1);
const unexpected = duplicates.filter(([, names]) => names.some((name) => !APPLIED_DUPLICATE_OK.has(name)));
if (unexpected.length) {
  for (const [prefix, names] of unexpected) console.error(`${prefix}: ${names.join(", ")}`);
  process.exit(1);
}
console.log(JSON.stringify({
  ok: true,
  files: files.length,
  prefixes: byPrefix.size,
  knownAppliedDuplicatePrefix: duplicates.map(([prefix]) => prefix),
}));
