/**
 * True concurrent claim using two Postgres clients.
 * Env: ISOLATED_DATABASE_URL (must not contain production ref).
 */
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

const require = createRequire(import.meta.url);
const { Client } = require("C:/Users/igopf/AppData/Local/Temp/cylix-pg-read/node_modules/pg");
const PRODUCTION_REF = "ymvgxarznjqotnaaiida";
const url = process.env.ISOLATED_DATABASE_URL?.trim() ?? "";
if (!url || url.includes(PRODUCTION_REF)) {
  console.error(JSON.stringify({ ok: false, reason: "bad_url" }));
  process.exit(2);
}

const userId = randomUUID();
const eventId = `evt-race-${Date.now()}`;
const setup = new Client({ connectionString: url });
await setup.connect();
await setup.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [userId, "race@example.test"]);
await setup.end();

async function claim() {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const result = await client.query(
      `INSERT INTO public.kick_command_receipts
        (user_id, provider_event_id, broadcaster_user_id, state, updated_at)
       VALUES ($1, $2, '42', 'webhook_received', now())
       ON CONFLICT DO NOTHING
       RETURNING provider_event_id`,
      [userId, eventId],
    );
    return result.rowCount;
  } finally {
    await client.end();
  }
}

const [a, b] = await Promise.all([claim(), claim()]);
const winners = [a, b].filter((n) => n === 1).length;
const ok = winners === 1;
console.log(JSON.stringify({ ok, winners, counts: [a, b], eventIdPresent: true }));
process.exit(ok ? 0 : 1);
