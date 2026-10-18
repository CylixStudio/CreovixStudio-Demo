/**
 * Pre-deploy schema compatibility check.
 * Does not run from the Kick webhook. Does not connect to production.
 *
 * Usage (PowerShell):
 *   node scripts/schema-compatibility-check.mjs --self-test
 *   node scripts/schema-compatibility-check.mjs --catalog .\path\to\catalog.json
 *
 * A catalog is { tables: { name: string[] }, columns: { "table.column": true },
 * rpcs: string[], constraints: { table: string[] }, functions: { name: string } }.
 * Missing tables, columns, RPCs, or receipt constraints fail readiness (exit 1).
 * No catalog means not ready (exit 2). A production project ref is refused (exit 3).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTION_REF = "ymvgxarznjqotnaaiida";

const REQUIRED = {
  tables: [
    "kick_command_receipts",
    "kick_app_bot_identity",
    "chat_text_alerts",
    "chat_text_alert_sends",
    "chat_text_alert_welcomes",
  ],
  columns: [
    "default_chat_commands.min_role",
    "message_timers.last_sent_slot",
    "link_in_bio_themes.youtube_latest_enabled",
    "kick_command_receipts.user_id",
    "kick_command_receipts.provider_event_id",
    "kick_command_receipts.state",
    "kick_command_receipts.reply_text",
    "kick_command_receipts.kick_message_id",
  ],
  rpcs: ["apply_timer_seconds", "apply_goal_increment", "purchase_loyalty_item"],
  constraints: {
    kick_command_receipts: [
      "kick_command_receipts_pkey",
      "kick_command_receipts_state_check",
      "kick_command_receipts_event_len",
      "kick_command_receipts_user_id_fkey",
      "kick_command_receipts_kick_message",
    ],
  },
  functionMarkers: {
    apply_timer_seconds: "started_at + make_interval",
  },
};

function migrationText(name) {
  return readFileSync(resolve(root, "supabase/migrations", name), "utf8");
}

export function reviewReceiptMigration(sql) {
  const failures = [];
  const need = [
    ["primary key", "PRIMARY KEY (user_id, provider_event_id)"],
    ["state check", "'reply_delivery_ambiguous'"],
    ["event length", "kick_command_receipts_event_len"],
    ["user foreign key", "REFERENCES auth.users(id) ON DELETE CASCADE"],
    ["message unique index", "kick_command_receipts_kick_message"],
    ["bot identity primary key", "client_id text PRIMARY KEY"],
    ["service role grant receipts", "GRANT ALL ON public.kick_command_receipts TO service_role"],
    ["service role grant identity", "GRANT ALL ON public.kick_app_bot_identity TO service_role"],
    ["receipts rls", "ALTER TABLE public.kick_command_receipts ENABLE ROW LEVEL SECURITY"],
    ["identity rls", "ALTER TABLE public.kick_app_bot_identity ENABLE ROW LEVEL SECURITY"],
  ];
  for (const [label, snippet] of need) {
    if (!sql.includes(snippet)) failures.push(`receipt migration missing ${label}`);
  }
  if (/CREATE POLICY/i.test(sql)) failures.push("receipt migration must not add a client policy");
  if (/DISABLE ROW LEVEL SECURITY/i.test(sql)) failures.push("receipt migration disables rls");
  return failures;
}

export function reviewAlertsMigration(sql) {
  const failures = [];
  const need = [
    "ADD COLUMN IF NOT EXISTS min_role text NOT NULL DEFAULT 'everyone'",
    "CHECK (min_role IN ('everyone', 'subscriber', 'vip', 'og', 'moderator', 'broadcaster'))",
    "CREATE TABLE IF NOT EXISTS public.chat_text_alerts",
    "PRIMARY KEY (user_id, alert_id)",
    "REFERENCES auth.users(id) ON DELETE CASCADE",
    "CREATE POLICY \"Owners manage chat text alerts\"",
    "USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)",
    "GRANT ALL ON public.chat_text_alert_sends TO service_role",
    "ALTER TABLE public.chat_text_alert_sends ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.chat_text_alert_welcomes ENABLE ROW LEVEL SECURITY",
  ];
  for (const snippet of need) {
    if (!sql.includes(snippet)) failures.push(`alerts migration missing: ${snippet}`);
  }
  if (/TO anon|TO public/i.test(sql)) failures.push("alerts migration grants anon or public");
  return failures;
}

export function compareCatalog(catalog) {
  const failures = [];
  const tables = catalog.tables ?? {};
  const columns = new Set(catalog.columns ?? []);
  for (const [table, cols] of Object.entries(tables)) {
    for (const col of cols) columns.add(`${table}.${col}`);
  }
  for (const table of REQUIRED.tables) {
    if (!Object.prototype.hasOwnProperty.call(tables, table)) failures.push(`missing table ${table}`);
  }
  for (const column of REQUIRED.columns) {
    if (!columns.has(column)) failures.push(`missing column ${column}`);
  }
  const rpcs = new Set(catalog.rpcs ?? []);
  for (const rpc of REQUIRED.rpcs) {
    if (!rpcs.has(rpc)) failures.push(`missing rpc ${rpc}`);
  }
  const constraints = catalog.constraints ?? {};
  for (const [table, names] of Object.entries(REQUIRED.constraints)) {
    const have = new Set(constraints[table] ?? []);
    for (const name of names) {
      if (!have.has(name)) failures.push(`missing constraint ${table}.${name}`);
    }
  }
  if (catalog.functions) {
    for (const [name, marker] of Object.entries(REQUIRED.functionMarkers)) {
      const body = catalog.functions[name] ?? "";
      if (!body.includes(marker)) failures.push(`function ${name} is not the repo definition`);
    }
  }
  return failures;
}

function refuseProduction(text) {
  return text.includes(PRODUCTION_REF);
}

function readyCatalog() {
  return {
    tables: {
      kick_command_receipts: ["user_id", "provider_event_id", "state", "reply_text", "kick_message_id"],
      kick_app_bot_identity: ["client_id", "bot_user_id"],
      chat_text_alerts: ["user_id", "alert_id"],
      chat_text_alert_sends: ["user_id", "provider_event_id"],
      chat_text_alert_welcomes: ["user_id", "chatter_key"],
      default_chat_commands: ["min_role"],
      message_timers: ["last_sent_slot"],
      link_in_bio_themes: ["youtube_latest_enabled"],
    },
    rpcs: ["apply_timer_seconds", "apply_goal_increment", "purchase_loyalty_item"],
    constraints: {
      kick_command_receipts: [
        "kick_command_receipts_pkey",
        "kick_command_receipts_state_check",
        "kick_command_receipts_event_len",
        "kick_command_receipts_user_id_fkey",
        "kick_command_receipts_kick_message",
      ],
    },
    functions: {
      apply_timer_seconds: "started_at + make_interval(secs => v_next)",
    },
  };
}

function selfTest() {
  const failures = [
    ...reviewReceiptMigration(migrationText("20261015230000_kick_command_receipts.sql")),
    ...reviewAlertsMigration(migrationText("20261013193000_default_command_roles_and_chat_alerts.sql")),
  ];
  const slot = migrationText("20261014150000_message_timer_last_sent_slot.sql");
  if (!slot.includes("ADD COLUMN IF NOT EXISTS last_sent_slot text")) failures.push("timer slot column missing from migration");
  if (/NOT NULL/.test(slot.split("last_sent_slot")[1] ?? "")) failures.push("last_sent_slot must stay nullable");
  const youtube = migrationText("20261014190000_link_in_bio_youtube_latest.sql");
  if (!youtube.includes("youtube_latest_enabled boolean NOT NULL DEFAULT true")) failures.push("youtube column definition mismatch");
  const subathon = migrationText("20261014190100_subathon_timer_exact_seconds.sql");
  if (!subathon.includes("started_at + make_interval")) failures.push("subathon function marker missing");

  const productionLike = compareCatalog({ tables: {}, rpcs: [], constraints: {} });
  if (productionLike.length < 8) failures.push("empty catalog did not fail readiness");
  if (compareCatalog(readyCatalog()).length !== 0) failures.push("complete fixture was not ready");
  if (!refuseProduction(`postgresql://postgres.${PRODUCTION_REF}@example`)) failures.push("production ref was not refused");
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, mode: "self-test", staticMigrations: 5, emptyCatalogGaps: productionLike.length }));
}

const arg = process.argv[2] ?? "";
const catalogArg = process.argv[3] ?? "";
if (arg === "--self-test") {
  selfTest();
} else if (arg === "--catalog" && catalogArg) {
  const raw = readFileSync(resolve(catalogArg), "utf8");
  if (refuseProduction(raw) || refuseProduction(catalogArg)) {
    console.error("Refusing a catalog that points at production.");
    process.exit(3);
  }
  const failures = compareCatalog(JSON.parse(raw));
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, mode: "catalog" }));
} else {
  console.error("No target catalog. Readiness failed. Pass --catalog <file> or --self-test. This check does not connect to production.");
  process.exit(2);
}
