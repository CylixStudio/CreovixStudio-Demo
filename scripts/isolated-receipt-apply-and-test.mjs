/**
 * Apply ONLY the Kick receipt migration against an isolated Postgres.
 * Does not touch production. Does not print connection strings or secrets.
 *
 * Env:
 *   ISOLATED_DATABASE_URL — required, must not contain ymvgxarznjqotnaaiida
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTION_REF = "ymvgxarznjqotnaaiida";
const migration = resolve(root, "supabase/migrations/20261015230000_kick_command_receipts.sql");

function loadPg() {
  try {
    return require("C:/Users/igopf/AppData/Local/Temp/cylix-pg-read/node_modules/pg");
  } catch {
    return require("pg");
  }
}

const url = process.env.ISOLATED_DATABASE_URL?.trim() ?? "";
if (!url) {
  console.error(JSON.stringify({ ok: false, gate: "isolated_db", reason: "ISOLATED_DATABASE_URL_missing" }));
  process.exit(2);
}
if (url.includes(PRODUCTION_REF)) {
  console.error(JSON.stringify({ ok: false, gate: "isolated_db", reason: "refused_production_ref" }));
  process.exit(3);
}

const { Client } = loadPg();
const client = new Client({ connectionString: url, connectionTimeoutMillis: 10000 });
await client.connect();

const report = { ok: false, steps: [] };
function step(name, detail) {
  report.steps.push({ name, ...detail });
}

try {
  await client.query("CREATE SCHEMA IF NOT EXISTS auth");
  await client.query(`
    CREATE TABLE IF NOT EXISTS auth.users (
      id uuid PRIMARY KEY,
      email text
    )
  `);
  await client.query(`
    DO $$ BEGIN
      CREATE ROLE service_role NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await client.query(`
    DO $$ BEGIN
      CREATE ROLE authenticated NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  const sql = readFileSync(migration, "utf8");
  await client.query(sql);
  step("apply_migration", { ok: true });

  const tables = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('kick_command_receipts', 'kick_app_bot_identity')
    ORDER BY table_name
  `);
  step("tables", { found: tables.rows.map((r) => r.table_name) });
  if (tables.rows.length !== 2) throw new Error("tables_missing");

  const cols = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'kick_command_receipts'
    ORDER BY ordinal_position
  `);
  const needCols = [
    "user_id",
    "provider_event_id",
    "broadcaster_user_id",
    "state",
    "reply_text",
    "kick_message_id",
    "failure_reason",
    "created_at",
    "updated_at",
  ];
  const haveCols = cols.rows.map((r) => r.column_name);
  step("columns", { have: haveCols, missing: needCols.filter((c) => !haveCols.includes(c)) });
  if (needCols.some((c) => !haveCols.includes(c))) throw new Error("columns_missing");

  const constraints = await client.query(`
    SELECT conname, contype
    FROM pg_constraint
    WHERE conrelid = 'public.kick_command_receipts'::regclass
    ORDER BY conname
  `);
  const conNames = constraints.rows.map((r) => r.conname);
  step("constraints", { names: conNames });
  for (const name of [
    "kick_command_receipts_pkey",
    "kick_command_receipts_state_check",
    "kick_command_receipts_event_len",
    "kick_command_receipts_user_id_fkey",
  ]) {
    if (!conNames.includes(name)) throw new Error(`constraint_missing_${name}`);
  }

  const indexes = await client.query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'kick_command_receipts'
    ORDER BY indexname
  `);
  step("indexes", { names: indexes.rows.map((r) => r.indexname) });
  if (!indexes.rows.some((r) => r.indexname === "kick_command_receipts_kick_message")) {
    throw new Error("unique_index_missing");
  }

  const rls = await client.query(`
    SELECT c.relname, c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('kick_command_receipts', 'kick_app_bot_identity')
    ORDER BY c.relname
  `);
  step("rls", { rows: rls.rows });
  if (rls.rows.some((r) => !r.relrowsecurity)) throw new Error("rls_not_enabled");

  const grants = await client.query(`
    SELECT table_name, privilege_type
    FROM information_schema.role_table_grants
    WHERE grantee = 'service_role'
      AND table_schema = 'public'
      AND table_name IN ('kick_command_receipts', 'kick_app_bot_identity')
    ORDER BY table_name, privilege_type
  `);
  step("grants", { count: grants.rows.length });
  if (grants.rows.length < 2) throw new Error("service_role_grants_missing");

  const userA = randomUUID();
  const userB = randomUUID();
  await client.query("INSERT INTO auth.users (id, email) VALUES ($1, $2), ($3, $4)", [
    userA,
    "a@example.test",
    userB,
    "b@example.test",
  ]);

  const eventId = "evt-concurrent-1";
  const claimSql = `
    INSERT INTO public.kick_command_receipts
      (user_id, provider_event_id, broadcaster_user_id, state, updated_at)
    VALUES ($1, $2, '42', 'webhook_received', now())
    ON CONFLICT DO NOTHING
    RETURNING provider_event_id
  `;
  const [left, right] = await Promise.all([
    client.query(claimSql, [userA, eventId]),
    client.query(claimSql, [userA, eventId]),
  ]);
  const winners = [left.rowCount, right.rowCount].filter((n) => n === 1).length;
  step("concurrent_claim", { winners });
  if (winners !== 1) throw new Error("concurrent_claim_not_unique");

  const dup = await client.query(claimSql, [userA, eventId]);
  step("duplicate_event", { inserted: dup.rowCount === 0 });
  if (dup.rowCount !== 0) throw new Error("duplicate_event_inserted");

  const otherUser = await client.query(claimSql, [userB, eventId]);
  step("cross_user_same_event", { inserted: otherUser.rowCount === 1 });
  if (otherUser.rowCount !== 1) throw new Error("cross_user_isolation_failed");

  await client.query(
    `UPDATE public.kick_command_receipts
     SET state = 'webhook_received', updated_at = now() - interval '5 seconds'
     WHERE user_id = $1 AND provider_event_id = $2`,
    [userA, eventId],
  );
  const busy = await client.query(
    `SELECT state, EXTRACT(EPOCH FROM (now() - updated_at)) AS age_seconds
     FROM public.kick_command_receipts
     WHERE user_id = $1 AND provider_event_id = $2`,
    [userA, eventId],
  );
  const age = Number(busy.rows[0].age_seconds);
  step("busy_window_row", { state: busy.rows[0].state, ageSeconds: age, expectBusy: age < 20 });
  if (busy.rows[0].state !== "webhook_received" || age >= 20) {
    throw new Error("busy_window_setup_failed");
  }

  await client.query(
    `UPDATE public.kick_command_receipts
     SET updated_at = now() - interval '30 seconds'
     WHERE user_id = $1 AND provider_event_id = $2`,
    [userA, eventId],
  );
  const stale = await client.query(
    `SELECT EXTRACT(EPOCH FROM (now() - updated_at)) AS age_seconds
     FROM public.kick_command_receipts
     WHERE user_id = $1 AND provider_event_id = $2`,
    [userA, eventId],
  );
  step("execution_unknown_age", {
    ageSeconds: Number(stale.rows[0].age_seconds),
    expectUnknown: Number(stale.rows[0].age_seconds) >= 20,
  });
  if (Number(stale.rows[0].age_seconds) < 20) throw new Error("stale_age_failed");

  const badState = await client.query(
    `INSERT INTO public.kick_command_receipts
      (user_id, provider_event_id, broadcaster_user_id, state)
     VALUES ($1, 'evt-bad-state', '42', 'not_a_state')`,
    [userA],
  ).then(
    () => ({ ok: false }),
    (error) => ({ ok: true, code: error.code }),
  );
  step("state_check_rejects_invalid", badState);
  if (!badState.ok) throw new Error("state_check_not_enforced");

  report.ok = true;
  report.gate = "isolated_migration_testing";
  report.result = "PASS";
  console.log(JSON.stringify(report));
  process.exit(0);
} catch (error) {
  report.ok = false;
  report.gate = "isolated_migration_testing";
  report.result = "DID_NOT_PASS";
  report.error = String(error?.message ?? error).slice(0, 200);
  console.error(JSON.stringify(report));
  process.exit(1);
} finally {
  try {
    await client.end();
  } catch {
    // ignore
  }
}
