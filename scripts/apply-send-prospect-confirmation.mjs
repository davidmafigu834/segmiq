/**
 * Adds clients.send_prospect_confirmation if missing (migration 027).
 * Run: node scripts/apply-send-prospect-confirmation.mjs
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import pg from "pg";

const envPath = resolve(process.cwd(), ".env.local");
if (!existsSync(envPath)) {
  console.error("Missing .env.local");
  process.exit(1);
}

for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq < 1) continue;
  const key = t.slice(0, eq).trim();
  let val = t.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Need DATABASE_URL in .env.local");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(`
    alter table public.clients
      add column if not exists send_prospect_confirmation boolean default true;
  `);
  const { rows } = await client.query(`
    select column_name, data_type, column_default
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clients'
      and column_name = 'send_prospect_confirmation';
  `);
  if (rows.length === 0) {
    console.error("Column still missing after ALTER TABLE.");
    process.exit(1);
  }
  console.log("OK: clients.send_prospect_confirmation is present.", rows[0]);
} catch (err) {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await client.end();
}
