/**
 * Apply 086_sales_goals.sql using DATABASE_URL from .env.local.
 * Usage: node scripts/apply-sales-goals-migration.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnv() {
  const envPath = path.join(root, ".env.local");
  const text = fs.readFileSync(envPath, "utf8");
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main() {
  const env = loadEnv();
  const dbUrl = env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL missing in .env.local");
    process.exit(1);
  }
  let Client;
  try {
    ({ Client } = require("pg"));
  } catch {
    console.error("Install pg first: npm install pg --no-save");
    process.exit(1);
  }
  const sql = fs.readFileSync(
    path.join(root, "supabase/migrations/086_sales_goals.sql"),
    "utf8"
  );
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Applied 086_sales_goals.sql");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
