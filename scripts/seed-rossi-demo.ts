/**
 * Creates the Rossi Tyres demo organisation and its four login users.
 * CRM records are not inserted. The app loads them from the demo dataset
 * when clients.workspace_mode is "demo".
 *
 * Requires DEMO_ROSSI_PASSWORD in the environment or .env.local.
 * Run: npm run seed:rossi
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { ROSSI_ACTORS, ROSSI_WORKSPACE } from "../lib/demo/actors";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

async function main() {
  const password = process.env.DEMO_ROSSI_PASSWORD?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!password) throw new Error("Set DEMO_ROSSI_PASSWORD before seeding Rossi Tyres.");
  if (!url || !key) throw new Error("Supabase URL and service role key are required.");

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await supabase.from("clients").select("id").eq("slug", ROSSI_WORKSPACE.slug).maybeSingle();
  if (existing.error) throw existing.error;

  let clientId = existing.data?.id as string | undefined;
  if (!clientId) {
    const inserted = await supabase
      .from("clients")
      .insert({
        name: ROSSI_WORKSPACE.name,
        industry: "Tyres / Automotive",
        slug: ROSSI_WORKSPACE.slug,
        mode: "team",
        workspace_mode: "demo",
        demo_industry: ROSSI_WORKSPACE.industry,
        demo_scenario: ROSSI_WORKSPACE.scenario,
        assignment_mode: "direct",
        dial_code: "263",
        country: "Zimbabwe",
        is_active: true,
      })
      .select("id")
      .single();
    if (inserted.error) throw inserted.error;
    clientId = inserted.data.id as string;
  } else {
    const updated = await supabase
      .from("clients")
      .update({
        workspace_mode: "demo",
        demo_industry: ROSSI_WORKSPACE.industry,
        demo_scenario: ROSSI_WORKSPACE.scenario,
        name: ROSSI_WORKSPACE.name,
      })
      .eq("id", clientId);
    if (updated.error) throw updated.error;
  }

  for (const actor of ROSSI_ACTORS) {
    const found = await supabase.from("users").select("id").eq("email", actor.email).maybeSingle();
    if (found.error) throw found.error;
    const row = {
      name: actor.name,
      email: actor.email,
      phone: actor.phone,
      password: passwordHash,
      role: actor.role,
      client_id: clientId,
      is_active: true,
      also_sells: false,
    };
    if (found.data?.id) {
      const updated = await supabase.from("users").update(row).eq("id", found.data.id);
      if (updated.error) throw updated.error;
    } else {
      const inserted = await supabase.from("users").insert(row);
      if (inserted.error) throw inserted.error;
    }
  }

  console.log(`Rossi Tyres demo workspace ready (${clientId}). Password was read from DEMO_ROSSI_PASSWORD.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
