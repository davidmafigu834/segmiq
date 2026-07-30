/**
 * Run: npm run seed
 * Loads .env.local so NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY apply.
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { addDays } from "date-fns";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
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
}

loadEnvLocal();

function assertServiceRoleJwt(key: string) {
  try {
    const parts = key.split(".");
    if (parts.length !== 3) return;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      role?: string;
    };
    if (payload.role && payload.role !== "service_role") {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY must be the "service_role" key from Supabase → Settings → API (not the anon / public key). The anon key cannot insert past RLS.'
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("service_role")) throw e;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  assertServiceRoleJwt(key);
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const adminHash = await bcrypt.hash("admin123", 12);

  const { data: jd, error: e1 } = await supabase
    .from("clients")
    .upsert(
      {
        name: "JD Construction",
        industry: "Construction",
        slug: "jd-construction",
        primary_color: "#00D4FF",
      },
      { onConflict: "slug" }
    )
    .select("id")
    .single();
  if (e1) throw e1;

  const { data: bs, error: e2 } = await supabase
    .from("clients")
    .upsert(
      {
        name: "Bright Solar",
        industry: "Solar Installation",
        slug: "bright-solar",
        primary_color: "#7B61FF",
      },
      { onConflict: "slug" }
    )
    .select("id")
    .single();
  if (e2) throw e2;

  const jdId = jd?.id as string;
  const bsId = bs?.id as string;

  const { data: admin } = await supabase
    .from("users")
    .upsert(
      {
        name: "Super Admin",
        email: "admin@leadstaq.com",
        password: adminHash,
        role: "SUPER_ADMIN",
        client_id: null,
        phone: "+10000000000",
        is_active: true,
      },
      { onConflict: "email" }
    )
    .select("id")
    .single();

  const statuses = ["NEW", "CONTACTED", "NEGOTIATING", "PROPOSAL_SENT", "WON"] as const;

  async function seedClient(clientId: string, prefix: string) {
    const mgr = await supabase
      .from("users")
      .insert({
        name: `${prefix} Manager`,
        email: `${prefix.toLowerCase().replace(/\s+/g, "")}-manager@example.com`,
        password: adminHash,
        role: "CLIENT_MANAGER",
        client_id: clientId,
        is_active: true,
      })
      .select("id")
      .single();

    const s1 = await supabase
      .from("users")
      .insert({
        name: `${prefix} Sales A`,
        email: `${prefix.toLowerCase().replace(/\s+/g, "")}-sales-a@example.com`,
        password: adminHash,
        role: "SALESPERSON",
        client_id: clientId,
        is_active: true,
      })
      .select("id")
      .single();
    const s2 = await supabase
      .from("users")
      .insert({
        name: `${prefix} Sales B`,
        email: `${prefix.toLowerCase().replace(/\s+/g, "")}-sales-b@example.com`,
        password: adminHash,
        role: "SALESPERSON",
        client_id: clientId,
        is_active: true,
      })
      .select("id")
      .single();

    await supabase.from("form_schemas").upsert(
      {
        client_id: clientId,
        form_title: `${prefix} quote`,
        submit_button_text: "Get quote",
        thank_you_message: "Thanks — we will call you shortly.",
        fields: [
          {
            id: "name",
            type: "short_text",
            label: "Full name",
            required: true,
          },
          {
            id: "phone",
            type: "phone",
            label: "Phone",
            required: true,
          },
          {
            id: "email",
            type: "email",
            label: "Email",
            required: true,
          },
        ],
      },
      { onConflict: "client_id" }
    );

    await supabase.from("landing_pages").upsert(
      {
        client_id: clientId,
        hero_headline: `${prefix} — quality service`,
        hero_subheadline: "Tell us about your project.",
        cta_text: "Get a free quote today",
        published: true,
        primary_color: "#00D4FF",
      },
      { onConflict: "client_id" }
    );

    const salesIds = [s1.data?.id, s2.data?.id].filter(Boolean) as string[];
    for (let i = 0; i < 5; i++) {
      const token = randomUUID();
      await supabase.from("leads").insert({
        client_id: clientId,
        assigned_to_id: salesIds[i % salesIds.length],
        source: i % 2 === 0 ? "LANDING_PAGE" : "FACEBOOK",
        status: statuses[i % statuses.length],
        form_data: { name: `Lead ${i}`, phone: "+1555000${i}" },
        name: `${prefix} Lead ${i + 1}`,
        phone: `+1555000${1000 + i}`,
        email: `lead${i}@example.com`,
        budget: "$10k–$25k",
        project_type: "Roof",
        timeline: "1 month",
        magic_token: token,
        magic_token_expires_at: addDays(new Date(), 30).toISOString(),
      });
    }

    return { mgr, s1, s2 };
  }

  if (jdId) await seedClient(jdId, "JD");
  if (bsId) await seedClient(bsId, "Bright");

  console.log("Seed complete. Admin: admin@leadstaq.com / admin123");
  console.log("Client IDs:", { jdId, bsId, admin: admin?.id });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
