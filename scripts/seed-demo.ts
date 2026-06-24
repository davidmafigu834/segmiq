/**
 * Demo data seed — a realistic Zimbabwean solar installation company.
 *
 * Creates:
 *   • 1 CRM client (SunVolt Solar, team mode, "connected" to a Facebook lead form)
 *   • 1 manager account   (demo login)
 *   • 1 salesperson account (demo login) + 2 teammates so the manager view is full
 *   • ~35 Facebook leads with the real solar form answers, randomised across
 *     statuses with follow-ups (overdue / today / upcoming), wins, losses, etc.
 *   • Call logs, lead timeline events, contacts and notifications for realism.
 *
 * Run: npm run seed:demo
 * Idempotent: re-running wipes the previous demo client + accounts first.
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { addDays, subDays, addHours } from "date-fns";

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

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const DEMO_PASSWORD = "demo1234";
const CLIENT_SLUG = "sunvolt-solar";

const MANAGER = {
  name: "Rumbidzai Chikova",
  email: "manager@sunvolt.demo",
  phone: "+263772100100",
};

const SALES_PRIMARY = {
  name: "Tatenda Marufu",
  email: "sales@sunvolt.demo",
  phone: "+263782200200",
};

const SALES_TEAM = [
  { name: "Kudzai Moyo", email: "kudzai@sunvolt.demo", phone: "+263712300300" },
  { name: "Blessing Ncube", email: "blessing@sunvolt.demo", phone: "+263733400400" },
];

const ALL_DEMO_EMAILS = [
  MANAGER.email,
  SALES_PRIMARY.email,
  ...SALES_TEAM.map((s) => s.email),
];

// ---------------------------------------------------------------------------
// Lead answer pools (the real Facebook solar form)
// ---------------------------------------------------------------------------
const FIRST_NAMES = [
  "Tariro", "Farai", "Nyasha", "Tendai", "Chipo", "Simba", "Rutendo", "Takudzwa",
  "Munashe", "Anesu", "Tinashe", "Vimbai", "Panashe", "Ropafadzo", "Kuda",
  "Tanaka", "Mukudzei", "Shamiso", "Tatenda", "Rumbidzai", "Brian", "Charity",
  "Gift", "Privilege", "Memory", "Wadzanai", "Tonderai", "Lisa", "Mary", "Peter",
];
const SURNAMES = [
  "Moyo", "Ncube", "Sibanda", "Dube", "Mlambo", "Chikomba", "Marufu", "Mhaka",
  "Chigumba", "Mutasa", "Gumbo", "Madondo", "Zhou", "Banda", "Mpofu", "Nyathi",
  "Chirwa", "Makoni", "Muchena", "Zinyama", "Mangwende", "Dziva", "Chivave",
];
const CITIES = [
  "Harare", "Bulawayo", "Chiredzi", "Mutare", "Gweru", "Masvingo", "Kwekwe",
  "Chitungwiza", "Victoria Falls", "Kadoma", "Bindura", "Marondera",
  "Zvishavane", "Hwange", "Norton", "Ruwa", "Beitbridge", "Rusape",
];
const HOME_SIZES = [
  "Small — 1 to 2 bedrooms",
  "Medium — 3 bedrooms",
  "Large — 4 or more bedrooms",
];
const ZESA = [
  "No — i have no zesa connection",
  "Yes — but load shedding is bad",
  "Yes — i have a zesa connection",
];
const BUDGETS = [
  "I need guidance on what it costs",
  "Under $2,000",
  "$2,000 – $5,000",
  "$5,000 – $10,000",
  "Over $10,000",
];
const APPLIANCES = [
  "Lights and phone charging",
  "Television and dstv",
  "Fridge and freezer",
  "Borehole pump",
  "Whole house backup",
  "Geyser and kitchen appliances",
];
const TIMELINES: { raw: string; label: string }[] = [
  { raw: "within_1_month", label: "Within 1 month" },
  { raw: "within_3_months", label: "Within 3 months" },
  { raw: "within_6_months", label: "Within 6 months" },
  { raw: "just_researching", label: "Just researching" },
];

// ---------------------------------------------------------------------------
// Random helpers
// ---------------------------------------------------------------------------
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function phone(): string {
  const prefix = pick(["77", "78", "71", "73"]);
  return `+263${prefix}${randInt(1000000, 9999999)}`;
}
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function makePerson() {
  const first = pick(FIRST_NAMES);
  const last = pick(SURNAMES).trim().replace(/[: ]+$/, "");
  const name = `${first} ${last}`;
  const email =
    Math.random() < 0.6
      ? `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "") + `${randInt(1, 99)}@gmail.com`
      : null;
  return { name, email, phone: phone() };
}

function buildFormData(person: { name: string; email: string | null; phone: string }) {
  const timeline = pick(TIMELINES);
  const city = pick(CITIES);
  const homeSize = pick(HOME_SIZES);
  const zesa = pick(ZESA);
  const budget = pick(BUDGETS);
  const appliances = pick(APPLIANCES);

  const formData: Record<string, string> = {
    full_name: person.name,
    phone_number: person.phone,
    timeline: timeline.raw,
    "Which City Or Suburb Are You In?": city,
    "When Are You Looking To Install Solar?": timeline.label,
    "How Would You Describe The Size Of Your Home?": homeSize,
    "Do You Currently Have A Zesa Electricity Connection?": zesa,
    "Do You Have A Rough Budget In Mind For Your Solar Installation?": budget,
    "Which Appliances Do You Want Powered By Solar?": appliances,
  };
  if (person.email) formData.email = person.email;

  return { formData, timeline, city, budget };
}

// Rough deal value from the budget bracket (USD).
function dealValueFor(budget: string): number {
  if (budget.includes("Under $2,000")) return randInt(900, 1900);
  if (budget.includes("$2,000")) return randInt(2200, 4800);
  if (budget.includes("$5,000")) return randInt(5200, 9500);
  if (budget.includes("Over $10,000")) return randInt(10500, 18000);
  return randInt(1500, 6000); // "needs guidance"
}

function scoreBreakdown(status: string) {
  const recency = randInt(8, 20);
  const calls = randInt(5, 15);
  const statusProgress =
    status === "WON"
      ? 30
      : status === "PROPOSAL_SENT"
        ? 25
        : status === "NEGOTIATING"
          ? 20
          : status === "CONTACTED"
            ? 12
            : 5;
  const budget = randInt(5, 15);
  const source = 15;
  const total = Math.min(100, recency + calls + statusProgress + budget + source);
  return {
    total,
    breakdown: { recency, calls, status_progress: statusProgress, budget, source },
  };
}

// ---------------------------------------------------------------------------
// Lead plan
// ---------------------------------------------------------------------------
type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "NEGOTIATING"
  | "PROPOSAL_SENT"
  | "WON"
  | "LOST"
  | "NOT_QUALIFIED";

type FollowUpPlan = { offsetDays: number; hour: number };

type LeadSpec = {
  status: LeadStatus;
  ageDays: number; // how long ago the lead arrived
  followUp?: FollowUpPlan;
  convertLater?: boolean;
};

// Curated spread for the primary demo salesperson so the follow-ups
// calendar + lists look alive (overdue, today, tomorrow, this week, later).
const PRIMARY_LEAD_SPECS: LeadSpec[] = [
  { status: "NEW", ageDays: 0 },
  { status: "NEW", ageDays: 1 },
  { status: "NEW", ageDays: 2 },
  { status: "CONTACTED", ageDays: 9, followUp: { offsetDays: -5, hour: 10 } }, // overdue
  { status: "NEGOTIATING", ageDays: 14, followUp: { offsetDays: -2, hour: 15 } }, // overdue
  { status: "CONTACTED", ageDays: 6, followUp: { offsetDays: 0, hour: 11 } }, // today
  { status: "PROPOSAL_SENT", ageDays: 11, followUp: { offsetDays: 0, hour: 16 } }, // today
  { status: "CONTACTED", ageDays: 4, followUp: { offsetDays: 1, hour: 9 } }, // tomorrow
  { status: "NEGOTIATING", ageDays: 8, followUp: { offsetDays: 3, hour: 14 } }, // this week
  { status: "PROPOSAL_SENT", ageDays: 16, followUp: { offsetDays: 5, hour: 10 }, convertLater: true }, // this week
  { status: "CONTACTED", ageDays: 5, followUp: { offsetDays: 12, hour: 13 } }, // later
  { status: "CONTACTED", ageDays: 3, followUp: { offsetDays: 20, hour: 11 } }, // later
  { status: "WON", ageDays: 21 },
  { status: "WON", ageDays: 30 },
  { status: "WON", ageDays: 12 },
  { status: "LOST", ageDays: 25 },
  { status: "NOT_QUALIFIED", ageDays: 18 },
];

// Looser random spread for teammates.
function randomTeamSpecs(count: number): LeadSpec[] {
  const specs: LeadSpec[] = [];
  const statuses: LeadStatus[] = [
    "NEW", "NEW", "CONTACTED", "CONTACTED", "NEGOTIATING",
    "PROPOSAL_SENT", "WON", "WON", "LOST", "NOT_QUALIFIED",
  ];
  for (let i = 0; i < count; i++) {
    const status = pick(statuses);
    const ageDays = randInt(0, 35);
    let followUp: FollowUpPlan | undefined;
    if (status === "CONTACTED" || status === "NEGOTIATING" || status === "PROPOSAL_SENT") {
      followUp = { offsetDays: randInt(-4, 18), hour: randInt(8, 17) };
    }
    specs.push({ status, ageDays, followUp });
  }
  return specs;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log("→ Cleaning previous demo data…");
  await cleanup(supabase);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  console.log("→ Creating SunVolt Solar client…");
  const { data: client, error: cErr } = await supabase
    .from("clients")
    .insert({
      name: "SunVolt Solar",
      industry: "Solar Installation",
      slug: CLIENT_SLUG,
      mode: "team",
      assignment_mode: "round_robin",
      primary_color: "#F5A623",
      dial_code: "263",
      country: "Zimbabwe",
      response_time_limit_hours: 2,
      is_active: true,
      // "Connected" Facebook lead form (display only — no live Graph calls).
      fb_page_id: "1010101010101010",
      fb_page_name: "SunVolt Solar Zimbabwe",
      fb_form_id: "2020202020202020",
      fb_form_name: "Solar Quote Request",
      fb_webhook_verified: true,
      fb_connected_at: new Date().toISOString(),
      last_lead_received_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (cErr) throw cErr;
  const clientId = client!.id as string;

  console.log("→ Creating accounts…");
  const manager = await insertUser(supabase, {
    ...MANAGER,
    role: "CLIENT_MANAGER",
    clientId,
    passwordHash,
    roundRobinOrder: 0,
  });

  const primaryRep = await insertUser(supabase, {
    ...SALES_PRIMARY,
    role: "SALESPERSON",
    clientId,
    passwordHash,
    roundRobinOrder: 0,
  });

  const teammates = [];
  for (let i = 0; i < SALES_TEAM.length; i++) {
    teammates.push(
      await insertUser(supabase, {
        ...SALES_TEAM[i],
        role: "SALESPERSON",
        clientId,
        passwordHash,
        roundRobinOrder: i + 1,
      })
    );
  }

  console.log("→ Creating form schema + landing page…");
  await supabase.from("form_schemas").upsert(
    {
      client_id: clientId,
      form_title: "Solar Quote Request",
      submit_button_text: "Get my free solar quote",
      thank_you_message: "Thanks! A SunVolt consultant will call you shortly.",
      fields: [
        { id: "full_name", type: "short_text", label: "Full name", required: true },
        { id: "phone_number", type: "phone", label: "Phone number", required: true },
        { id: "city", type: "short_text", label: "Which City Or Suburb Are You In?", required: true, role: "location" },
        { id: "timeline", type: "single_select", label: "When Are You Looking To Install Solar?", required: true, role: "urgency", options: TIMELINES.map((t) => t.label) },
        { id: "home_size", type: "single_select", label: "How Would You Describe The Size Of Your Home?", required: true, options: HOME_SIZES },
        { id: "zesa", type: "single_select", label: "Do You Currently Have A Zesa Electricity Connection?", required: true, options: ZESA },
        { id: "budget", type: "single_select", label: "Do You Have A Rough Budget In Mind For Your Solar Installation?", required: false, options: BUDGETS },
        { id: "appliances", type: "single_select", label: "Which Appliances Do You Want Powered By Solar?", required: false, options: APPLIANCES },
      ],
    },
    { onConflict: "client_id" }
  );

  await supabase.from("landing_pages").upsert(
    {
      client_id: clientId,
      hero_headline: "Reliable solar power for your home — no more load shedding",
      hero_subheadline: "Get a free solar assessment from SunVolt Solar.",
      cta_text: "Get a free solar quote",
      published: true,
      primary_color: "#F5A623",
    },
    { onConflict: "client_id" }
  );

  console.log("→ Generating leads…");
  let totalLeads = 0;
  totalLeads += await seedLeadsForRep(supabase, clientId, primaryRep, manager, PRIMARY_LEAD_SPECS, true);
  for (const mate of teammates) {
    totalLeads += await seedLeadsForRep(supabase, clientId, mate, manager, randomTeamSpecs(randInt(7, 9)), false);
  }

  console.log("\n✅ Demo seed complete.\n");
  console.log("   Company: SunVolt Solar (Zimbabwe) — Facebook lead form connected");
  console.log(`   Leads created: ${totalLeads}\n`);
  console.log("   Demo logins (password for all: " + DEMO_PASSWORD + ")");
  console.log("   ┌──────────────┬────────────────────────┐");
  console.log(`   │ Manager      │ ${MANAGER.email.padEnd(22)} │`);
  console.log(`   │ Salesperson  │ ${SALES_PRIMARY.email.padEnd(22)} │`);
  console.log("   └──────────────┴────────────────────────┘");
  console.log("   Teammates (also salespeople):");
  for (const s of SALES_TEAM) console.log(`     • ${s.email}`);
}

// ---------------------------------------------------------------------------
// Seed leads for one rep
// ---------------------------------------------------------------------------
async function seedLeadsForRep(
  supabase: SupabaseClient,
  clientId: string,
  rep: { id: string; name: string },
  manager: { id: string; name: string },
  specs: LeadSpec[],
  withNotifications: boolean
): Promise<number> {
  const now = new Date();
  let created = 0;

  for (const spec of specs) {
    const person = makePerson();
    const { formData, timeline, budget } = buildFormData(person);
    const createdAt = subDays(now, spec.ageDays);

    let followUpDate: string | null = null;
    let callbackAt: string | null = null;
    if (spec.followUp) {
      const fu = addDays(now, spec.followUp.offsetDays);
      fu.setHours(spec.followUp.hour, 0, 0, 0);
      followUpDate = dateKey(fu);
      callbackAt = fu.toISOString();
    }

    const dealValue = spec.status === "WON" ? dealValueFor(budget) : null;
    const lostReason = spec.status === "LOST" ? pick(["Chose a competitor", "Went cold", "No longer needed"]) : null;
    const nqReason = spec.status === "NOT_QUALIFIED" ? pick(["Out of area", "Budget too small", "Just price-checking"]) : null;
    const { total: score, breakdown } = scoreBreakdown(spec.status);

    // Contact (find-or-create by phone within client).
    const canonicalPhone = "+" + person.phone.replace(/\D/g, "");
    let contactId: string | null = null;
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("client_id", clientId)
      .eq("phone", canonicalPhone)
      .limit(1)
      .maybeSingle();
    if (existingContact) {
      contactId = existingContact.id as string;
    } else {
      const { data: newContact } = await supabase
        .from("contacts")
        .insert({
          client_id: clientId,
          name: person.name,
          phone: canonicalPhone,
          email: person.email,
          source: "FACEBOOK",
          lead_origin: "segmiq",
          lifecycle: spec.status === "WON" ? "customer" : "lead",
          created_at: createdAt.toISOString(),
        })
        .select("id")
        .single();
      contactId = (newContact?.id as string) ?? null;
    }

    const { data: lead, error: lErr } = await supabase
      .from("leads")
      .insert({
        client_id: clientId,
        assigned_to_id: rep.id,
        source: "FACEBOOK",
        status: spec.status,
        form_data: formData,
        name: person.name,
        phone: person.phone,
        email: person.email,
        budget,
        project_type: "Solar installation",
        timeline: timeline.label,
        magic_token: randomUUID(),
        magic_token_expires_at: addDays(now, 30).toISOString(),
        facebook_lead_id: `${Date.now()}${randInt(1000, 9999)}`,
        contact_id: contactId,
        deal_value: dealValue,
        follow_up_date: followUpDate,
        lost_reason: lostReason,
        not_qualified_reason: nqReason,
        is_convert_later_pick: spec.convertLater ?? false,
        score,
        score_updated_at: now.toISOString(),
        score_breakdown: breakdown,
        created_at: createdAt.toISOString(),
        updated_at: now.toISOString(),
      })
      .select("id")
      .single();
    if (lErr) throw lErr;
    const leadId = lead!.id as string;
    created++;

    // Timeline: LEAD_CREATED
    await supabase.from("lead_events").insert({
      lead_id: leadId,
      client_id: clientId,
      actor_role: "SYSTEM",
      actor_name: "Facebook",
      event_type: "LEAD_CREATED",
      event_data: { source: "FACEBOOK", assigned_to_name: rep.name, form_data_summary: "Solar installation" },
      created_at: createdAt.toISOString(),
    });

    // Call logs + status events for non-NEW leads.
    if (spec.status !== "NEW") {
      const firstCallAt = addHours(createdAt, randInt(1, 6));
      await supabase.from("call_logs").insert({
        lead_id: leadId,
        user_id: rep.id,
        outcome: "ANSWERED",
        reach_outcome: "reached",
        result: "follow_up",
        notes: "Spoke with prospect, discussed power needs and load shedding pain points.",
        created_at: firstCallAt.toISOString(),
      });
      await supabase.from("lead_events").insert({
        lead_id: leadId,
        client_id: clientId,
        actor_id: rep.id,
        actor_name: rep.name,
        actor_role: "SALESPERSON",
        event_type: "STATUS_CHANGED",
        event_data: { from_status: "NEW", to_status: "CONTACTED" },
        created_at: firstCallAt.toISOString(),
      });
    }

    // Follow-up call log (scheduled callback).
    if (spec.followUp && callbackAt && followUpDate) {
      const logAt = addHours(createdAt, randInt(7, 30));
      await supabase.from("call_logs").insert({
        lead_id: leadId,
        user_id: rep.id,
        outcome: "FOLLOW_UP",
        reach_outcome: "reached",
        result: "follow_up",
        reason: pick(["Comparing quotes", "Still deciding", "Waiting on money", "Project for later"]),
        callback_at: callbackAt,
        follow_up_date: followUpDate,
        notes: "Agreed to follow up with pricing and system options.",
        created_at: logAt.toISOString(),
      });
      await supabase.from("lead_events").insert({
        lead_id: leadId,
        client_id: clientId,
        actor_id: rep.id,
        actor_name: rep.name,
        actor_role: "SALESPERSON",
        event_type: "FOLLOW_UP_SET",
        event_data: { follow_up_date: followUpDate },
        created_at: logAt.toISOString(),
      });
    }

    // Won.
    if (spec.status === "WON") {
      const wonAt = subDays(now, Math.max(0, spec.ageDays - randInt(3, 8)));
      await supabase.from("call_logs").insert({
        lead_id: leadId,
        user_id: rep.id,
        outcome: "WON",
        reach_outcome: "reached",
        result: "won",
        notes: `Closed the deal — ${dealValue ? "$" + dealValue : "system"} solar install booked.`,
        created_at: wonAt.toISOString(),
      });
      await supabase.from("lead_events").insert({
        lead_id: leadId,
        client_id: clientId,
        actor_id: rep.id,
        actor_name: rep.name,
        actor_role: "SALESPERSON",
        event_type: "STATUS_CHANGED",
        event_data: { from_status: "NEGOTIATING", to_status: "WON", deal_value: dealValue },
        created_at: wonAt.toISOString(),
      });
    }

    // Lost / not qualified events.
    if (spec.status === "LOST" || spec.status === "NOT_QUALIFIED") {
      const closeAt = subDays(now, Math.max(0, spec.ageDays - randInt(2, 6)));
      await supabase.from("call_logs").insert({
        lead_id: leadId,
        user_id: rep.id,
        outcome: spec.status,
        reach_outcome: "reached",
        result: spec.status === "LOST" ? "lost" : "not_qualified",
        reason: lostReason ?? nqReason,
        notes: spec.status === "LOST" ? "Lost — see reason." : "Not qualified — see reason.",
        created_at: closeAt.toISOString(),
      });
      await supabase.from("lead_events").insert({
        lead_id: leadId,
        client_id: clientId,
        actor_id: rep.id,
        actor_name: rep.name,
        actor_role: "SALESPERSON",
        event_type: "STATUS_CHANGED",
        event_data: { from_status: "CONTACTED", to_status: spec.status },
        created_at: closeAt.toISOString(),
      });
    }

    // Notifications for the primary rep only (keeps the bell realistic).
    if (withNotifications) {
      if (spec.status === "NEW") {
        await supabase.from("notifications").insert({
          user_id: rep.id,
          type: "NEW_LEAD",
          message: `New lead from Facebook: ${person.name} (${formData["Which City Or Suburb Are You In?"]})`,
          read: false,
          lead_id: leadId,
          created_at: createdAt.toISOString(),
        });
      } else if (spec.followUp && (spec.followUp.offsetDays <= 0)) {
        await supabase.from("notifications").insert({
          user_id: rep.id,
          type: "FOLLOW_UP_DUE",
          message: `Follow-up due: ${person.name}`,
          read: false,
          lead_id: leadId,
          created_at: now.toISOString(),
        });
      } else if (spec.status === "WON") {
        await supabase.from("notifications").insert({
          user_id: rep.id,
          type: "DEAL_WON",
          message: `Deal won: ${person.name}${dealValue ? " — $" + dealValue : ""}`,
          read: true,
          lead_id: leadId,
          created_at: createdAt.toISOString(),
        });
      }
    }
  }

  return created;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function insertUser(
  supabase: SupabaseClient,
  u: {
    name: string;
    email: string;
    phone: string;
    role: "CLIENT_MANAGER" | "SALESPERSON";
    clientId: string;
    passwordHash: string;
    roundRobinOrder: number;
  }
): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase
    .from("users")
    .insert({
      name: u.name,
      email: u.email,
      phone: u.phone,
      password: u.passwordHash,
      role: u.role,
      client_id: u.clientId,
      is_active: true,
      round_robin_order: u.roundRobinOrder,
    })
    .select("id, name")
    .single();
  if (error) throw error;
  return { id: data!.id as string, name: data!.name as string };
}

async function cleanup(supabase: SupabaseClient) {
  // Delete the demo client first — cascades leads, call_logs, lead_events,
  // contacts, form_schemas and landing_pages.
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", CLIENT_SLUG)
    .maybeSingle();
  if (existing?.id) {
    await supabase.from("clients").delete().eq("id", existing.id);
  }
  // Delete demo users by email — cascades their notifications.
  await supabase.from("users").delete().in("email", ALL_DEMO_EMAILS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
