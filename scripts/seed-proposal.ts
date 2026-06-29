/**
 * Seed one fully-populated agency sales proposal so you can edit from a
 * complete example instead of a blank draft.
 *
 * Run: npx tsx scripts/seed-proposal.ts
 * Loads .env.local so NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY apply.
 *
 * Idempotent: re-running replaces the seeded proposal (matched by company name).
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { addDays, format } from "date-fns";

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnvLocal();

const SEED_COMPANY = "Helios Solar Co.";

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const SECTIONS: { kind: string; heading: string; body: string }[] = [
  {
    kind: "cover",
    heading: "A faster, smarter sales engine for Helios Solar",
    body: "Helios Solar Co. is winning more enquiries than ever — but quotes, follow-ups and WhatsApp threads are scattered across spreadsheets and personal phones. Segmiq gives your team one place to capture every lead, respond in minutes, and turn more site visits into signed installations. This proposal sets out exactly how we get you live and the investment involved.",
  },
  {
    kind: "scope",
    heading: "What's included",
    body: "• Segmiq CRM (Professional plan) for your whole sales team\n• Facebook/Meta Lead Ads integration so new leads land in the pipeline instantly\n• WhatsApp Cloud API set-up for one-tap quotes and follow-up reminders\n• A branded quotation builder pre-loaded with your panel, inverter and battery catalogue\n• Automated SLA alerts so no enquiry sits uncontacted for more than 2 hours\n• Migration of your existing contacts and open deals",
  },
  {
    kind: "approach",
    heading: "How we roll it out",
    body: "We handle the heavy lifting. Our team configures your account, imports your data, connects your Facebook page and WhatsApp number, and loads your product catalogue. Your installers and sales reps get a guided mobile app, and managers get a live dashboard of pipeline value, response times and win rates. You keep selling while we set everything up in the background.",
  },
  {
    kind: "timeline",
    heading: "Go-live timeline",
    body: "Week 1 — Kick-off, account setup, data migration and branding.\nWeek 2 — Facebook Lead Ads + WhatsApp integration and catalogue load.\nWeek 3 — Team training (two sessions) and a supervised live pilot.\nWeek 4 — Full go-live with weekly performance reviews for the first month.",
  },
];

const LINE_ITEMS: {
  item_name: string;
  description: string;
  unit_price: number;
  quantity: number;
  group_label: string;
}[] = [
  {
    item_name: "Implementation & onboarding",
    description: "Account configuration, branding, pipeline setup and go-live support.",
    unit_price: 1500,
    quantity: 1,
    group_label: "Setup",
  },
  {
    item_name: "Data migration & integrations",
    description: "Import existing contacts/deals; connect Facebook Lead Ads and WhatsApp Cloud API.",
    unit_price: 750,
    quantity: 1,
    group_label: "Setup",
  },
  {
    item_name: "Segmiq CRM — Professional plan",
    description: "Monthly subscription for the full sales team (first month shown).",
    unit_price: 199,
    quantity: 1,
    group_label: "Subscription",
  },
  {
    item_name: "Facebook Lead Ads campaign setup",
    description: "Audience, creative guidance and lead-form wiring for your first campaign.",
    unit_price: 600,
    quantity: 1,
    group_label: "Growth",
  },
  {
    item_name: "Sales team training",
    description: "Two live training sessions for reps and managers.",
    unit_price: 250,
    quantity: 2,
    group_label: "Enablement",
  },
];

const DEFAULT_TERMS =
  "This proposal is valid for 30 days from the date of issue. Implementation and onboarding fees are one-off and due on acceptance. Subscription fees are billed monthly in advance and may be cancelled with 30 days' notice. Prices are quoted in USD and exclude any applicable taxes unless stated.";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // 1. Ensure Segmiq's proposal settings look complete (brand + defaults).
  const { data: existingSettings } = await supabase
    .from("agency_proposal_settings")
    .select("id")
    .limit(1)
    .maybeSingle();
  const settingsPayload = {
    company_name: "Segmiq",
    company_email: "sales@segmiq.com",
    company_phone: "+263 78 000 0000",
    company_website: "https://segmiq.com",
    company_address: "Harare, Zimbabwe",
    brand_color: "#0F7A4F",
    default_terms: DEFAULT_TERMS,
    footer_note: "Segmiq — sales & lead management for service businesses.",
    default_validity_days: 30,
    updated_at: new Date().toISOString(),
  };
  if (existingSettings) {
    await supabase.from("agency_proposal_settings").update(settingsPayload).eq("id", existingSettings.id);
  } else {
    await supabase.from("agency_proposal_settings").insert(settingsPayload);
  }

  // 2. Remove a previously seeded proposal so this script is idempotent.
  const { data: prior } = await supabase
    .from("agency_proposals")
    .select("id")
    .eq("company_name", SEED_COMPANY);
  for (const p of prior ?? []) {
    await supabase.from("agency_proposals").delete().eq("id", p.id as string);
  }

  // 3. Compute totals.
  const cleanItems = LINE_ITEMS.map((it, idx) => ({
    item_name: it.item_name,
    description: it.description,
    unit_price: it.unit_price,
    quantity: it.quantity,
    amount: round2(it.unit_price * it.quantity),
    group_label: it.group_label,
    sort_order: idx,
  }));
  const subtotal = round2(cleanItems.reduce((s, it) => s + it.amount, 0));
  const discount = 349; // first month subscription waived as an incentive
  const taxRate = 0;
  const taxable = round2(subtotal - discount);
  const taxAmount = round2(taxable * (taxRate / 100));
  const total = round2(taxable + taxAmount);

  // 4. Insert the proposal (draft — ready to edit and send).
  const { data: proposal, error } = await supabase
    .from("agency_proposals")
    .insert({
      company_name: SEED_COMPANY,
      recipient_name: "Tendai Moyo",
      recipient_email: "tendai@heliossolar.example",
      recipient_phone: "+263 77 123 4567",
      title: "Segmiq CRM for Helios Solar Co.",
      status: "draft",
      public_token: randomBytes(32).toString("hex"),
      proposed_mode: "team",
      proposed_plan: "professional",
      billing_cycle: "monthly",
      currency: "USD",
      subtotal,
      discount,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      valid_until: format(addDays(new Date(), 30), "yyyy-MM-dd"),
      notes: "Thank you for the great conversation at the demo — excited to help Helios grow.",
      terms: DEFAULT_TERMS,
      prepared_by_name: "Segmiq Sales",
    })
    .select("id")
    .single();
  if (error || !proposal) throw error ?? new Error("Failed to insert proposal");

  const proposalId = proposal.id as string;

  // 5. Insert sections + line items.
  await supabase.from("agency_proposal_sections").insert(
    SECTIONS.map((s, idx) => ({
      proposal_id: proposalId,
      kind: s.kind,
      heading: s.heading,
      body: s.body,
      sort_order: idx,
    }))
  );
  await supabase
    .from("agency_proposal_line_items")
    .insert(cleanItems.map((it) => ({ ...it, proposal_id: proposalId })));

  console.log(`✅ Seeded proposal for ${SEED_COMPANY}`);
  console.log(`   id:       ${proposalId}`);
  console.log(`   total:    USD ${total.toFixed(2)} (subtotal ${subtotal.toFixed(2)}, discount ${discount})`);
  console.log(`   sections: ${SECTIONS.length}, line items: ${cleanItems.length}`);
  console.log(`   Open it at: /dashboard/proposals  (it appears at the top as a draft)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
