/**
 * Apply public.users profile migration against the linked Supabase Postgres.
 *
 * Usage (PowerShell):
 *   $env:DATABASE_URL = "postgresql://postgres.[ref]:[PASSWORD]@aws-0-....pooler.supabase.com:6543/postgres"
 *   node scripts/apply-users-migration.mjs
 *
 * Or set SUPABASE_DB_PASSWORD + SUPABASE_URL (or VITE_SUPABASE_URL) and this
 * script will build the pooler URL for project lxnaefjtewujvcwurptx / from the URL host.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migration = resolve(
  root,
  "supabase/migrations/20260925010000_secure_public_users_profile.sql",
);

function loadEnvFile() {
  const path = resolve(root, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function projectRefFromUrl(url) {
  try {
    const host = new URL(url).hostname; // <ref>.supabase.co
    return host.split(".")[0] || null;
  } catch {
    return null;
  }
}

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  if (process.env.SUPABASE_DB_URL?.trim()) return process.env.SUPABASE_DB_URL.trim();
  if (process.env.DIRECT_URL?.trim()) return process.env.DIRECT_URL.trim();

  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const ref = projectRefFromUrl(supabaseUrl || "") || "lxnaefjtewujvcwurptx";
  if (!password) return null;

  // Session pooler (IPv4-friendly). Override region via SUPABASE_DB_REGION if needed.
  const region = process.env.SUPABASE_DB_REGION?.trim() || "aws-0-eu-central-1";
  const encoded = encodeURIComponent(password);
  return `postgresql://postgres.${ref}:${encoded}@${region}.pooler.supabase.com:6543/postgres`;
}

loadEnvFile();

if (!existsSync(migration)) {
  console.error("Migration file missing:", migration);
  process.exit(1);
}

const databaseUrl = resolveDatabaseUrl();
if (!databaseUrl) {
  console.error(`
Cannot apply migration: no database connection string.

Add one of these to .env (or the shell), then re-run:
  DATABASE_URL=postgresql://postgres.<ref>:<DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres
  # or
  SUPABASE_DB_PASSWORD=<database password from Supabase → Project Settings → Database>

Then:
  node scripts/apply-users-migration.mjs

Or paste the SQL from:
  supabase/migrations/20260925010000_secure_public_users_profile.sql
into Supabase Dashboard → SQL Editor → Run.
`);
  process.exit(2);
}

const sql = readFileSync(migration, "utf8");

// Prefer psql when available.
const psql = spawnSync(
  "psql",
  [databaseUrl, "-v", "ON_ERROR_STOP=1", "-c", sql],
  { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
);

if (psql.error && psql.error.code === "ENOENT") {
  console.error("psql not found on PATH. Install PostgreSQL client tools, or run the SQL in the Supabase SQL Editor.");
  console.error("Migration path:", migration);
  process.exit(3);
}

if (psql.status !== 0) {
  console.error(psql.stderr || psql.stdout || "psql failed");
  process.exit(psql.status ?? 1);
}

console.log("Applied 20260925010000_secure_public_users_profile.sql successfully.");
console.log(psql.stdout || "");
