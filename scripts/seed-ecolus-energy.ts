/**
 * Populate the existing Ecolus Energy tenant: Company Information, Company Brain,
 * Products/Services, and the five residential solar Packages.
 *
 * Uses the same store/service functions as manager APIs. Idempotent.
 *
 * Run: npx tsx scripts/seed-ecolus-energy.ts
 *
 * Package artwork (optional): place the five IMG-20260823-WA000*.jpg files in
 * scripts/seed-assets/ecolus-packages/ or set ECOLUS_PACKAGE_IMAGES_DIR.
 */
import { randomUUID } from "crypto";
import { existsSync, readFileSync, readdirSync } from "fs";
import { basename, resolve } from "path";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordBrainAudit } from "@/lib/company-brain/audit";
import {
  brainCollections,
  loadCompanyBrainSnapshot,
  replaceKnowledgeChunks,
  upsertBrainSettings,
} from "@/lib/company-brain/store";
import { createCategory, listCategories } from "@/lib/products/categories";
import { createProduct, updateProduct } from "@/lib/products/service";
import { createPackage, savePackageContents, updatePackage } from "@/lib/packages/service";
import { ensureQuotationSettings } from "@/lib/quotations/quote-number";
import { upsertExecutionSettings } from "@/lib/sales/intelligence/daily-plan-service";
import { getPublicUrl, isR2Configured, putObject } from "@/lib/storage/r2";
import type { PlaybookField, PlaybookFieldType } from "@/lib/company-brain/types";

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

type ReportRow = { action: "created" | "updated" | "reused"; type: string; id: string; name: string };
type Mismatch = { field: string; value: string; reason: string };

const created: ReportRow[] = [];
const mismatches: Mismatch[] = [];

function note(field: string, value: string, reason: string) {
  mismatches.push({ field, value, reason });
}

function normName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function digits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function empty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return !value.trim();
  return false;
}

function field(opts: {
  prefix: string;
  priority: number;
  label: string;
  key: string;
  type: PlaybookFieldType;
  required: boolean;
  ask: string;
  values?: string[];
  crm?: string | null;
  showIf?: { field: string; op: "equals" | "not_equals" | "truthy" | "falsy"; value?: string };
}): PlaybookField {
  return {
    id: `${opts.prefix}-${opts.key}`,
    label: opts.label,
    internalKey: opts.key,
    type: opts.type,
    required: opts.required,
    possibleValues: opts.values ?? [],
    validation: null,
    agentQuestionGuidance: opts.ask,
    crmMapping: opts.crm ?? null,
    priority: opts.priority,
    conditional: opts.showIf ?? null,
  };
}

function yesNo(): string[] {
  return ["Yes", "No"];
}

const LEGAL_NAME = "Ecolus Energy (Pvt) Ltd";
const TRADING_NAME = "Ecolus Energy";
const PRIMARY_PHONE = "+263 712 017 222";
const SECONDARY_PHONES = ["+263 712 094 535", "+263 778 138 528"];
const EMAIL = "info@ecolusenergy.co.zw";
const WEBSITE = "https://ecolusgroup.co.zw/energy";
const ADDRESS = "218 Samora Machel Ave, Eastlea, Harare, Zimbabwe";
const TAGLINE = "Energy for the Long Run";

const PACKAGE_IMAGE_FILES: Record<string, string> = {
  "3kVA Lite": "IMG-20260823-WA0005.jpg",
  "3kVA Premium": "IMG-20260823-WA0003.jpg",
  "6.2kVA System": "IMG-20260823-WA0004.jpg",
  "10kVA Lite": "IMG-20260823-WA0001.jpg",
  "10kVA Premium": "IMG-20260823-WA0002.jpg",
};

function resolveImageDir(): string | null {
  const candidates = [
    process.env.ECOLUS_PACKAGE_IMAGES_DIR,
    resolve(process.cwd(), "scripts/seed-assets/ecolus-packages"),
    resolve(process.cwd(), "scripts/ecolus-packages"),
    process.cwd(),
  ].filter((v): v is string => Boolean(v));
  for (const dir of candidates) {
    if (!existsSync(dir)) continue;
    const names = new Set(readdirSync(dir).map((n) => n.toLowerCase()));
    const hasAny = Object.values(PACKAGE_IMAGE_FILES).some((f) => names.has(f.toLowerCase()));
    if (hasAny) return dir;
  }
  return null;
}

async function uploadPackageImage(
  clientId: string,
  packageName: string,
  filePath: string
): Promise<{ url: string; key: string } | null> {
  if (!isR2Configured()) {
    note("Package image upload", packageName, "R2 is not configured. image_url left unset.");
    return null;
  }
  const buf = readFileSync(filePath);
  const ext = basename(filePath).split(".").pop()?.toLowerCase() || "jpg";
  const slug = packageName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const key = `clients/${clientId}/packages/${slug}.${ext}`;
  await putObject(key, buf, ext === "png" ? "image/png" : "image/jpeg", {
    cacheControl: "public, max-age=31536000",
  });
  return { url: getPublicUrl(key), key };
}

const RESIDENTIAL_FIELDS: PlaybookField[] = [
  field({
    prefix: "res",
    priority: 1,
    label: "Project location",
    key: "project_location",
    type: "LOCATION",
    required: true,
    ask: "Which area is the property located in?",
    crm: "location",
  }),
  field({
    prefix: "res",
    priority: 2,
    label: "Property type",
    key: "property_type",
    type: "SINGLE_SELECT",
    required: true,
    ask: "Is the system for a house or another type of property?",
    values: ["House", "Apartment", "Townhouse", "Other"],
    crm: "project_type",
  }),
  field({
    prefix: "res",
    priority: 3,
    label: "Main requirement",
    key: "main_requirement",
    type: "SINGLE_SELECT",
    required: true,
    ask: "What would you mainly like the solar system to do — provide backup during power cuts, run most of the property on solar, or both?",
    values: ["Backup", "Solar generation", "Both", "Other"],
    crm: "customer_need",
  }),
  field({
    prefix: "res",
    priority: 4,
    label: "Appliances",
    key: "appliances",
    type: "LONG_TEXT",
    required: true,
    ask: "Which appliances would you like the system to power?",
  }),
  field({
    prefix: "res",
    priority: 5,
    label: "Heavy loads",
    key: "heavy_loads",
    type: "BOOLEAN",
    required: true,
    ask: "Would you like it to run heavier appliances such as a borehole pump, booster pump, freezer, washing machine, geyser or similar equipment?",
    values: yesNo(),
  }),
  field({
    prefix: "res",
    priority: 6,
    label: "Heavy load details",
    key: "heavy_load_details",
    type: "LONG_TEXT",
    required: false,
    ask: "Which heavier appliances or equipment should the system run?",
    showIf: { field: "heavy_loads", op: "equals", value: "Yes" },
  }),
  field({
    prefix: "res",
    priority: 7,
    label: "Existing solar",
    key: "existing_solar",
    type: "BOOLEAN",
    required: true,
    ask: "Do you already have a solar system installed?",
    values: yesNo(),
  }),
  field({
    prefix: "res",
    priority: 8,
    label: "Existing equipment",
    key: "existing_equipment",
    type: "LONG_TEXT",
    required: false,
    ask: "What inverter, battery and panels are currently installed, if you know?",
    showIf: { field: "existing_solar", op: "equals", value: "Yes" },
  }),
  field({
    prefix: "res",
    priority: 9,
    label: "Budget",
    key: "budget",
    type: "CURRENCY",
    required: false,
    ask: "Do you have an approximate budget or a Package you are considering?",
    crm: "budget",
  }),
  field({
    prefix: "res",
    priority: 10,
    label: "Timeline",
    key: "timeline",
    type: "SINGLE_SELECT",
    required: true,
    ask: "When would you ideally like the system installed?",
    values: ["Immediately", "Within 2 weeks", "Within 1 month", "1–3 months", "Later / researching"],
    crm: "buying_timeframe",
  }),
  field({
    prefix: "res",
    priority: 11,
    label: "Site assessment availability",
    key: "site_assessment",
    type: "BOOLEAN",
    required: false,
    ask: "Would you be available for a site assessment if the technical team needs one?",
    values: yesNo(),
  }),
];

const COMMERCIAL_FIELDS: PlaybookField[] = [
  field({
    prefix: "com",
    priority: 1,
    label: "Company / organisation name",
    key: "company_name",
    type: "TEXT",
    required: true,
    ask: "What is the name of the business or organisation?",
  }),
  field({
    prefix: "com",
    priority: 2,
    label: "Project location",
    key: "project_location",
    type: "LOCATION",
    required: true,
    ask: "Where is the site located?",
    crm: "location",
  }),
  field({
    prefix: "com",
    priority: 3,
    label: "Business/site type",
    key: "business_site_type",
    type: "TEXT",
    required: true,
    ask: "What type of business or facility is this?",
    crm: "project_type",
  }),
  field({
    prefix: "com",
    priority: 4,
    label: "Main energy requirement",
    key: "main_energy_requirement",
    type: "TEXT",
    required: true,
    ask: "What problem are you mainly trying to solve — outages, backup power, generator dependence, solar generation, or a combination?",
    crm: "customer_need",
  }),
  field({
    prefix: "com",
    priority: 5,
    label: "Critical equipment",
    key: "critical_equipment",
    type: "LONG_TEXT",
    required: true,
    ask: "Which equipment or operations need to remain powered?",
  }),
  field({
    prefix: "com",
    priority: 6,
    label: "Existing solar",
    key: "existing_solar",
    type: "BOOLEAN",
    required: true,
    ask: "Is there already a solar system at the site?",
    values: yesNo(),
  }),
  field({
    prefix: "com",
    priority: 7,
    label: "Existing system details",
    key: "existing_system",
    type: "LONG_TEXT",
    required: false,
    ask: "Please share the existing inverter, battery and panel details if known.",
    showIf: { field: "existing_solar", op: "equals", value: "Yes" },
  }),
  field({
    prefix: "com",
    priority: 8,
    label: "Current generator",
    key: "current_generator",
    type: "BOOLEAN",
    required: false,
    ask: "Are you currently using a generator?",
    values: yesNo(),
  }),
  field({
    prefix: "com",
    priority: 9,
    label: "Budget",
    key: "budget",
    type: "CURRENCY",
    required: false,
    ask: "Has a budget or budget range been set for the project?",
    crm: "budget",
  }),
  field({
    prefix: "com",
    priority: 10,
    label: "Project timeline",
    key: "project_timeline",
    type: "DATE_RANGE",
    required: true,
    ask: "When would you ideally like the project completed?",
    crm: "buying_timeframe",
  }),
  field({
    prefix: "com",
    priority: 11,
    label: "Decision process",
    key: "decision_process",
    type: "TEXT",
    required: false,
    ask: "Who will be involved in approving the project?",
  }),
  field({
    prefix: "com",
    priority: 12,
    label: "Site assessment",
    key: "site_assessment",
    type: "BOOLEAN",
    required: true,
    ask: "Would the team be able to conduct a technical site assessment?",
    values: yesNo(),
  }),
];

const GEYSER_FIELDS: PlaybookField[] = [
  field({
    prefix: "gey",
    priority: 1,
    label: "Project location",
    key: "project_location",
    type: "LOCATION",
    required: true,
    ask: "Which area is the property located in?",
    crm: "location",
  }),
  field({
    prefix: "gey",
    priority: 2,
    label: "Property type",
    key: "property_type",
    type: "TEXT",
    required: true,
    ask: "Is this for a home, business or another type of property?",
    crm: "project_type",
  }),
  field({
    prefix: "gey",
    priority: 3,
    label: "Current geyser",
    key: "current_geyser",
    type: "BOOLEAN",
    required: false,
    ask: "Do you currently have a geyser installed?",
    values: yesNo(),
  }),
  field({
    prefix: "gey",
    priority: 4,
    label: "Requirement",
    key: "requirement",
    type: "TEXT",
    required: true,
    ask: "Are you replacing an existing geyser or installing a new solar water-heating system?",
    crm: "customer_need",
  }),
  field({
    prefix: "gey",
    priority: 5,
    label: "Household / usage",
    key: "household_usage",
    type: "NUMBER",
    required: false,
    ask: "How many people normally use hot water at the property?",
  }),
  field({
    prefix: "gey",
    priority: 6,
    label: "Timeline",
    key: "timeline",
    type: "DATE_RANGE",
    required: true,
    ask: "When would you like the installation done?",
    crm: "buying_timeframe",
  }),
  field({
    prefix: "gey",
    priority: 7,
    label: "Assessment",
    key: "assessment",
    type: "BOOLEAN",
    required: false,
    ask: "Would you be available for a site assessment if required?",
    values: yesNo(),
  }),
];

const PUMP_FIELDS: PlaybookField[] = [
  field({
    prefix: "pmp",
    priority: 1,
    label: "Project location",
    key: "project_location",
    type: "LOCATION",
    required: true,
    ask: "Where is the site located?",
    crm: "location",
  }),
  field({
    prefix: "pmp",
    priority: 2,
    label: "Requirement",
    key: "requirement",
    type: "SINGLE_SELECT",
    required: true,
    ask: "Are you looking for borehole drilling, a solar water pump, a booster pump solution, or help with an existing system?",
    values: ["Borehole drilling", "Solar water pump", "Booster pump", "Existing system", "Other"],
    crm: "customer_need",
  }),
  field({
    prefix: "pmp",
    priority: 3,
    label: "Existing borehole",
    key: "existing_borehole",
    type: "BOOLEAN",
    required: true,
    ask: "Is there already a borehole at the site?",
    values: yesNo(),
  }),
  field({
    prefix: "pmp",
    priority: 4,
    label: "Existing pump",
    key: "existing_pump",
    type: "BOOLEAN",
    required: false,
    ask: "Is a pump already installed?",
    values: yesNo(),
  }),
  field({
    prefix: "pmp",
    priority: 5,
    label: "Water requirement",
    key: "water_requirement",
    type: "LONG_TEXT",
    required: true,
    ask: "What will the water mainly be used for?",
  }),
  field({
    prefix: "pmp",
    priority: 6,
    label: "Existing equipment details",
    key: "existing_equipment",
    type: "LONG_TEXT",
    required: false,
    ask: "Please share the current pump or system details if known.",
    showIf: { field: "existing_pump", op: "equals", value: "Yes" },
  }),
  field({
    prefix: "pmp",
    priority: 7,
    label: "Timeline",
    key: "timeline",
    type: "DATE_RANGE",
    required: true,
    ask: "When would you like the project done?",
    crm: "buying_timeframe",
  }),
  field({
    prefix: "pmp",
    priority: 8,
    label: "Site assessment",
    key: "site_assessment",
    type: "BOOLEAN",
    required: true,
    ask: "Would the site be available for technical assessment?",
    values: yesNo(),
  }),
];

type CatalogueSpec = {
  key: string;
  name: string;
  item_type: "PRODUCT" | "SERVICE";
  description?: string;
};

const CATALOGUE: CatalogueSpec[] = [
  { key: "ecolus:450w-mono-panel", name: "450W Mono Panel", item_type: "PRODUCT" },
  { key: "ecolus:24v-100ah-lithium", name: "24V 100Ah Lithium Battery", item_type: "PRODUCT" },
  { key: "ecolus:48v-100ah-lithium", name: "48V 100Ah Lithium Battery", item_type: "PRODUCT" },
  { key: "ecolus:3kva-inverter", name: "3kVA Inverter", item_type: "PRODUCT" },
  { key: "ecolus:6.2kva-inverter", name: "6.2kVA Inverter", item_type: "PRODUCT" },
  { key: "ecolus:10kva-inverter", name: "10kVA Inverter", item_type: "PRODUCT" },
  {
    key: "ecolus:materials-accessories",
    name: "Materials & Accessories",
    item_type: "PRODUCT",
    description: "Materials and accessories included in the applicable Ecolus Energy solar Package.",
  },
  {
    key: "ecolus:labour-installation",
    name: "Labour & Installation",
    item_type: "SERVICE",
    description: "Labour and installation included in the applicable Ecolus Energy solar Package.",
  },
];

type PackageSpec = {
  name: string;
  price: number;
  description: string;
  capability: string;
  equipment: Array<{ productKey: string; qty: number }>;
};

const PACKAGES: PackageSpec[] = [
  {
    name: "3kVA Lite",
    price: 930,
    description:
      "3kVA Lite solar Package including panels, lithium battery, inverter, materials and accessories, labour and installation.",
    capability: "It can power: 8 Lights, TV Set, Radio, Laptop & Phone Charging, Small Fridge.",
    equipment: [
      { productKey: "ecolus:450w-mono-panel", qty: 2 },
      { productKey: "ecolus:24v-100ah-lithium", qty: 1 },
      { productKey: "ecolus:3kva-inverter", qty: 1 },
      { productKey: "ecolus:materials-accessories", qty: 1 },
      { productKey: "ecolus:labour-installation", qty: 1 },
    ],
  },
  {
    name: "3kVA Premium",
    price: 1100,
    description:
      "3kVA Premium solar Package including four 450W mono panels, lithium battery, inverter, materials and accessories, labour and installation.",
    capability: "It can power: 10 Lights, TV Set, Radio, Laptop & Phone Charging, Fridges, Deep Freezer.",
    equipment: [
      { productKey: "ecolus:450w-mono-panel", qty: 4 },
      { productKey: "ecolus:24v-100ah-lithium", qty: 1 },
      { productKey: "ecolus:3kva-inverter", qty: 1 },
      { productKey: "ecolus:materials-accessories", qty: 1 },
      { productKey: "ecolus:labour-installation", qty: 1 },
    ],
  },
  {
    name: "6.2kVA System",
    price: 1750,
    description:
      "6.2kVA solar system Package including six 450W mono panels, lithium battery, inverter, materials and accessories, labour and installation.",
    capability:
      "It can power: Lights, TV Set, Radio, Laptop & Phone Charging, 2 Fridges, Deep Freezer, Borehole & Booster Pump, Washing Machine.",
    equipment: [
      { productKey: "ecolus:450w-mono-panel", qty: 6 },
      { productKey: "ecolus:48v-100ah-lithium", qty: 1 },
      { productKey: "ecolus:6.2kva-inverter", qty: 1 },
      { productKey: "ecolus:materials-accessories", qty: 1 },
      { productKey: "ecolus:labour-installation", qty: 1 },
    ],
  },
  {
    name: "10kVA Lite",
    price: 3150,
    description:
      "10kVA Lite solar Package including twelve 450W mono panels, two lithium batteries, inverter, materials and accessories, labour and installation.",
    capability:
      "It can power: Lights, TV Set, Radio, Laptop & Phone Charging, 2 Fridges, Deep Freezer, Borehole & Booster Pump, Washing Machine.",
    equipment: [
      { productKey: "ecolus:450w-mono-panel", qty: 12 },
      { productKey: "ecolus:48v-100ah-lithium", qty: 2 },
      { productKey: "ecolus:10kva-inverter", qty: 1 },
      { productKey: "ecolus:materials-accessories", qty: 1 },
      { productKey: "ecolus:labour-installation", qty: 1 },
    ],
  },
  {
    name: "10kVA Premium",
    price: 5250,
    description:
      "10kVA Premium solar Package including twenty-four 450W mono panels, four lithium batteries, inverter, materials and accessories, labour and installation.",
    capability:
      "It can power: Lights, TV Set, Radio, Laptop & Phone Charging, 2 Fridges, Deep Freezer, Borehole & Booster Pump, Washing Machine.",
    equipment: [
      { productKey: "ecolus:450w-mono-panel", qty: 24 },
      { productKey: "ecolus:48v-100ah-lithium", qty: 4 },
      { productKey: "ecolus:10kva-inverter", qty: 1 },
      { productKey: "ecolus:materials-accessories", qty: 1 },
      { productKey: "ecolus:labour-installation", qty: 1 },
    ],
  },
];

async function main() {
  const supabase = createAdminClient();

  const { data: clients, error: clientErr } = await supabase
    .from("clients")
    .select(
      "id, name, slug, industry, website, country, owner_email, dial_code, capability_tagline, years_in_operation, business_type, is_archived"
    )
    .or("name.ilike.%Ecolus%,slug.ilike.%ecolus%")
    .eq("is_archived", false);
  if (clientErr) throw clientErr;
  const exact = (clients ?? []).find((c) => {
    const n = String(c.name).toLowerCase();
    return n === "ecolus energy" || n === "ecolus energy (pvt) ltd" || n.includes("ecolus energy");
  });
  const client = exact ?? (clients ?? [])[0];
  if (!client) {
    throw new Error('No existing tenant named "Ecolus Energy" (or slug/name containing Ecolus) was found.');
  }
  const clientId = String(client.id);
  console.log(`Seeding Ecolus Energy tenant ${client.name} (${clientId}, slug=${client.slug})`);

  const { data: users } = await supabase
    .from("users")
    .select("id, name, role, also_sells, is_active")
    .eq("client_id", clientId)
    .eq("is_active", true);
  const team = users ?? [];
  const manager = team.find((u) => u.role === "CLIENT_MANAGER") ?? team[0];
  let actorId = manager ? String(manager.id) : null;
  if (!actorId) {
    const { data: admins } = await supabase
      .from("users")
      .select("id")
      .eq("role", "SUPER_ADMIN")
      .eq("is_active", true)
      .limit(1);
    actorId = admins?.[0] ? String(admins[0].id) : null;
  }
  const salespersonIds = team
    .filter((u) => u.role === "SALESPERSON" || u.also_sells === true)
    .map((u) => String(u.id));
  const managerIds = team.filter((u) => u.role === "CLIENT_MANAGER").map((u) => String(u.id));
  const allTeamIds = team.map((u) => String(u.id));
  const salesAndManagers = [...new Set([...salespersonIds, ...managerIds])];

  if (!salespersonIds.length) {
    note(
      "Appointment type → Who can take it (Sales team)",
      "Sales team",
      "No SALESPERSON users (or also_sells managers) on this tenant. eligible_user_ids left empty where Sales is required."
    );
  }
  note(
    "Appointment type → Technical team / Support",
    "Technical team, Senior sales",
    "Users only have CLIENT_MANAGER / SALESPERSON roles. Technical slots mapped to managers + salespeople. No staff names were invented."
  );

  const snapshot = await loadCompanyBrainSnapshot(clientId);
  const canonical = snapshot.canonical;
  console.log("Canonical (not duplicated into Company Brain):", {
    companyName: canonical.companyName,
    industry: canonical.industry,
    timezone: canonical.timezone,
    website: canonical.website,
    phone: canonical.phone,
    email: canonical.email,
    address: canonical.address,
    currency: canonical.currency,
    paymentTerms: canonical.paymentTerms,
    products: canonical.productCount,
    services: canonical.serviceCount,
    packages: canonical.packageCount,
    hours: `${canonical.workStartTime}–${canonical.workEndTime}`,
    workingDays: canonical.workingDays,
    allowQuotationDiscount: canonical.allowQuotationDiscount,
  });

  const clientPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (empty(client.name)) clientPatch.name = LEGAL_NAME;
  else if (normName(String(client.name)) !== normName(LEGAL_NAME) && normName(String(client.name)) !== normName(TRADING_NAME)) {
    note("Company Information → Legal name", LEGAL_NAME, `Existing name is "${client.name}". Left unchanged.`);
  } else if (normName(String(client.name)) === normName(TRADING_NAME) && normName(String(client.name)) !== normName(LEGAL_NAME)) {
    note(
      "Company Information → Legal name",
      LEGAL_NAME,
      `Existing display name is "${client.name}" (trading name). Left unchanged. Legal name recorded in Company Brain / knowledge, not overwritten on clients.name.`
    );
  }

  if (empty(client.industry)) clientPatch.industry = "Solar Energy / Renewable Energy";
  else if (String(client.industry) !== "Solar Energy / Renewable Energy") {
    note("Company Information → Industry", "Solar Energy / Renewable Energy", `Existing industry is "${client.industry}". Left unchanged.`);
  }

  if (empty(client.website)) clientPatch.website = WEBSITE;
  else if (String(client.website).replace(/\/$/, "") !== WEBSITE.replace(/\/$/, "")) {
    note("Company Information → Website", WEBSITE, `Existing website is "${client.website}". Left unchanged.`);
  }

  if (empty(client.country)) clientPatch.country = "Zimbabwe";
  else if (String(client.country) !== "Zimbabwe") {
    note("Company Information → Country", "Zimbabwe", `Existing country is "${client.country}". Left unchanged.`);
  }

  if (empty(client.owner_email)) clientPatch.owner_email = EMAIL;
  else if (String(client.owner_email).toLowerCase() !== EMAIL) {
    note("Company Information → Email (clients.owner_email)", EMAIL, `Existing owner_email is "${client.owner_email}". Left unchanged.`);
  }

  if (empty(client.dial_code)) clientPatch.dial_code = "263";
  if (empty(client.capability_tagline)) clientPatch.capability_tagline = TAGLINE;
  else if (String(client.capability_tagline).trim() !== TAGLINE) {
    note("Company Information → Tagline", TAGLINE, `Existing capability_tagline is "${client.capability_tagline}". Left unchanged.`);
  }
  if (client.years_in_operation == null) clientPatch.years_in_operation = 8;

  const clientKeys = Object.keys(clientPatch).filter((k) => k !== "updated_at");
  if (clientKeys.length) {
    const { error } = await supabase.from("clients").update(clientPatch).eq("id", clientId);
    if (error) throw error;
    created.push({ action: "updated", type: "company_information", id: clientId, name: clientKeys.join(", ") });
  }

  const quoteSettings = await ensureQuotationSettings(supabase, clientId);
  const quotePatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const existingPhone = (quoteSettings.company_phone as string | null) ?? null;
  if (empty(existingPhone)) quotePatch.company_phone = PRIMARY_PHONE;
  else if (digits(existingPhone) !== digits(PRIMARY_PHONE)) {
    note(
      "Company Information → Primary phone",
      PRIMARY_PHONE,
      `Existing company_phone is "${existingPhone}". Left unchanged. Seed proposal: ${PRIMARY_PHONE}. Manager review required.`
    );
  }
  note(
    "Company Information → Secondary phones",
    SECONDARY_PHONES.join(", "),
    "quotation_settings.company_phone is a single field. Additional numbers stored only in the Contact knowledge document. +263 864 428 8012 was not added."
  );

  const existingEmail = (quoteSettings.company_email as string | null) ?? null;
  if (empty(existingEmail)) quotePatch.company_email = EMAIL;
  else if (String(existingEmail).toLowerCase() !== EMAIL) {
    note(
      "Company Information → Email (quotation_settings)",
      EMAIL,
      `Existing company_email is "${existingEmail}". Left unchanged. Seed proposal: ${EMAIL}. Manager review required.`
    );
  }

  if (empty(quoteSettings.company_address)) quotePatch.company_address = ADDRESS;
  else if (String(quoteSettings.company_address).trim() !== ADDRESS) {
    note("Company Information → Address", ADDRESS, `Existing address is "${quoteSettings.company_address}". Left unchanged.`);
  }

  if (empty(quoteSettings.company_website)) quotePatch.company_website = WEBSITE;
  if (empty(quoteSettings.default_currency) || quoteSettings.default_currency == null) {
    quotePatch.default_currency = "USD";
  } else if (String(quoteSettings.default_currency) !== "USD") {
    note("Quotation settings → Currency", "USD", `Existing default_currency is "${quoteSettings.default_currency}". Left unchanged.`);
  }
  if (!empty(quoteSettings.default_payment_terms)) {
    note(
      "Pricing & payment → Payment terms",
      "N/A",
      `Existing payment terms preserved: "${quoteSettings.default_payment_terms}". No payment terms were invented.`
    );
  } else {
    note("Pricing & payment → Payment terms", "N/A", "No approved payment terms in quotation_settings. Left unset.");
  }
  if (quoteSettings.allow_quotation_discount != null) {
    note(
      "Commercial policy → Discounts",
      "Do not overwrite",
      `Existing allow_quotation_discount=${quoteSettings.allow_quotation_discount}. Left unchanged.`
    );
  }

  const quoteKeys = Object.keys(quotePatch).filter((k) => k !== "updated_at");
  if (quoteKeys.length) {
    const { error } = await supabase.from("quotation_settings").update(quotePatch).eq("client_id", clientId);
    if (error) throw error;
    created.push({ action: "updated", type: "quotation_settings", id: clientId, name: quoteKeys.join(", ") });
  }

  const { data: marketing } = await supabase
    .from("client_marketing_settings")
    .select("timezone")
    .eq("client_id", clientId)
    .maybeSingle();
  if (empty(marketing?.timezone) || marketing?.timezone === "Africa/Harare") {
    if (empty(marketing?.timezone)) {
      const { error } = await supabase.from("client_marketing_settings").upsert(
        { client_id: clientId, timezone: "Africa/Harare", updated_at: new Date().toISOString() },
        { onConflict: "client_id" }
      );
      if (error) {
        note("Timezone", "Africa/Harare", `Could not write client_marketing_settings.timezone: ${error.message}`);
      } else {
        created.push({ action: "updated", type: "timezone", id: clientId, name: "Africa/Harare" });
      }
    }
  } else if (marketing?.timezone && marketing.timezone !== "Africa/Harare") {
    note("Timezone", "Africa/Harare", `Existing timezone is "${marketing.timezone}". Left unchanged.`);
  }

  if (!canonical.hasOperatingHoursRow) {
    await upsertExecutionSettings({
      clientId,
      salespersonId: null,
      patch: {
        workingDays: [1, 2, 3, 4, 5, 6],
        workStartTime: "08:00",
        workEndTime: "16:30",
      },
    });
    created.push({ action: "created", type: "business_hours", id: clientId, name: "Mon–Sat 08:00–16:30" });
    note(
      "Business hours → Saturday 09:00–13:00",
      "Mon–Fri 08:00–16:30, Sat 09:00–13:00, Sun closed",
      "sales_execution_settings store one start/end for all working days. Saturday was included as a working day so appointments can be booked; the 09:00–13:00 window cannot be stored separately. 24/7 emergency service was not turned into sales appointment availability."
    );
  } else {
    note(
      "Business hours",
      "Mon–Fri 08:00–16:30, Sat 09:00–13:00, Sun closed",
      "Existing operating hours were left unchanged."
    );
  }

  const brainPatch: Parameters<typeof upsertBrainSettings>[1] = {
    tradingName: TRADING_NAME,
    businessKind: "installer",
    customerModel: "BOTH",
    languages: ["English"],
    agentBusinessExplanation:
      "Ecolus Energy is a Zimbabwean solar energy company serving residential and commercial customers. The company supplies and installs solar energy systems and also provides solar geyser solutions, water-pump solutions, borehole drilling, solar lighting and solar consultancy. Ecolus Energy supplies solar equipment used in photovoltaic systems including panels, inverters and related installation components. The company also offers pre-configured residential solar Packages. The Agent must distinguish between a published standard Package and a custom solar project. It must not invent system sizing, compatibility, stock, prices, warranties, installation dates or technical guarantees.",
    primaryOffering: "Supply and installation of residential and commercial solar energy systems.",
    catalogueCustomerType:
      "Homeowners, businesses and organisations requiring solar power, backup energy, solar geysers, water-pumping solutions or related solar services.",
    typicalOrderType: "Solar installation project, standard solar Package, equipment supply or related solar service.",
    weDoNotNormallySell:
      "N/A — only refuse or redirect work that falls outside the company's actual approved services or cannot safely be confirmed.",
    specialSellingConditions:
      "Custom solar installations may require technical assessment before a final configuration is confirmed. Published standard Packages may be quoted using their current active Package price, but the Agent must not guarantee that a Package is suitable for a customer's specific electrical load without sufficient information or technical confirmation.",
    pricingGuidance:
      "Use only current active SegmiQ Product, Service, Package or Quotation prices. Standard Ecolus Package prices may be communicated from the active Package record. Do not invent component prices, custom-project totals or technical upgrade prices. Custom work requires a quotation.",
    neverEstimatePrices: true,
    nonstandardTermsRequireApproval: true,
    paymentGuidance:
      "Use the current Ecolus Quotation Settings/payment terms. If the system does not contain approved payment terms, do not invent them; ask the sales team to confirm.",
    supportOffered: true,
    supportDestinationType: "SUPPORT_QUEUE",
    supportHoursNote:
      "Normal published business hours apply. Ecolus also advertises emergency service 24/7.",
    supportCategories: [
      "Solar system fault",
      "Inverter issue",
      "Battery issue",
      "Solar panel issue",
      "System not charging",
      "Low backup duration",
      "Installation issue",
      "Solar geyser issue",
      "Water pump issue",
      "Borehole issue",
      "Maintenance request",
      "Warranty enquiry",
      "Other",
    ],
    autonomousTroubleshooting: false,
    warrantyBoundaries:
      "Use the actual Product warranty, quotation and company warranty policy where available. Do not invent warranty periods or promise coverage. Technical assessment may be required.",
    voicePrimary: "professional",
    voiceSecondary: "warm",
    responseLength: "balanced",
    emojiPolicy: "minimal",
    greetingStyle: "Hi, thanks for contacting Ecolus Energy. How can we help with your solar energy requirements?",
    preferredTerms: [
      { prefer: "quotation", avoid: "estimate" },
      { prefer: "solar solution", avoid: "cheap solar" },
      { prefer: "site assessment", avoid: "inspection" },
      { prefer: "installation", avoid: "fitting" },
      { prefer: "technical team", avoid: "guys" },
      { prefer: "customer", avoid: "lead" },
    ],
    claimsToAvoid: [
      "Do not call Ecolus the best solar company.",
      "Do not call Ecolus the cheapest.",
      "Do not claim Ecolus is number one.",
      "Do not claim guaranteed savings.",
      "Do not claim guaranteed uninterrupted power.",
    ],
    defaultEscalationMessage:
      "I want to make sure this is handled correctly, so I'm bringing a member of the Ecolus team into the conversation.",
  };
  if (!snapshot.exists) {
    brainPatch.quoteFollowUpBusinessDays = 2;
    brainPatch.secondFollowUpBusinessDays = 5;
    brainPatch.maxAutonomousFollowUps = 2;
  } else {
    note(
      "Follow-up timing",
      "First 2 business days / second 5 / max 2",
      "Existing Company Brain follow-up settings were not overwritten. These are SegmiQ defaults, not public Ecolus policy."
    );
  }
  note(
    "Credit offered / payment plans",
    "N/A",
    "Schema only supports boolean credit_offered / payment_plans_offered (default false). N/A cannot be stored; fields were not set as an invented Ecolus policy."
  );
  note(
    "Residential playbook → Appliances type",
    "long text / multi-value",
    "MULTI_SELECT requires a closed list. Mapped to LONG_TEXT so the Agent can capture free-form appliance lists."
  );
  note(
    "Residential playbook → Heavy loads type",
    "yes/no + details",
    "Playbook fields are a single type. Mapped to BOOLEAN plus a conditional LONG_TEXT details field."
  );
  note(
    "500+ projects / 8+ years",
    "Public company facts",
    "years_in_operation set to 8 only if previously empty. 500+ projects stored in knowledge/FAQs, not a new Company Information field."
  );

  const settings = await upsertBrainSettings(clientId, brainPatch);
  created.push({
    action: snapshot.exists ? "updated" : "created",
    type: "company_brain_settings",
    id: clientId,
    name: settings.tradingName ?? TRADING_NAME,
  });
  await recordBrainAudit({
    clientId,
    actorId,
    action: "SETTINGS_UPDATED",
    entityType: "company_brain_settings",
    entityId: clientId,
    summary: "Seeded Ecolus Energy Company Brain settings",
  });

  const customers = [
    {
      name: "Residential Solar Customer",
      description:
        "Homeowner or residential customer looking for backup power, solar generation or a complete household solar installation.",
      typical_requirements:
        "Homeowner or residential customer looking for backup power, solar generation or a complete household solar installation.",
      min_project_size: "N/A",
      typical_decision_maker: "Homeowner / property owner",
      primary_interest: "Solar Package, inverter, battery backup, panels, installation or upgrade.",
      geographic_requirements: "Zimbabwe. Specific project location must be captured.",
      good_fit_indicators:
        "Has a real property/project location; has a defined power requirement; can describe appliances/load; has an intended project timeline; is willing to discuss budget or Package choice; is willing to arrange assessment where required.",
      poor_fit_indicators: "Only collecting generic information; no defined project; unable/unwilling to provide basic requirements.",
      disqualifying_conditions: "Unsafe or unsupported work confirmed outside Ecolus Energy's services.",
      sort_order: 0,
      active: true,
    },
    {
      name: "Commercial Solar Customer",
      description:
        "Business or organisation requiring solar power, backup energy or a commercial photovoltaic installation.",
      typical_requirements:
        "Business or organisation requiring solar power, backup energy or a commercial photovoltaic installation.",
      min_project_size: "N/A",
      typical_decision_maker:
        "Business owner, director, operations manager, facilities manager, procurement representative or another authorised decision maker.",
      primary_interest:
        "Commercial solar installation, reliable backup power, solar generation, reduced generator dependence, energy solution for business operations.",
      geographic_requirements: "Zimbabwe. Exact project location required.",
      good_fit_indicators:
        "Clear business/site; understandable power problem; important operating loads can be identified; decision process exists; site assessment can be arranged if required; project timeline is known.",
      poor_fit_indicators: "No real site/project; no ability to provide load/project information; undefined requirement.",
      disqualifying_conditions: "Project confirmed to be outside Ecolus Energy's approved service capability.",
      sort_order: 1,
      active: true,
    },
    {
      name: "Solar Water & Geyser Customer",
      description:
        "Customer looking for a solar geyser, solar water-heating solution, solar-powered water-pump solution or related water-energy project.",
      typical_requirements:
        "Customer looking for a solar geyser, solar water-heating solution, solar-powered water-pump solution or related water-energy project.",
      min_project_size: "N/A",
      typical_decision_maker: "Homeowner, property owner, business owner or facility manager.",
      primary_interest: "Solar geyser installation, water heating, solar water pumping, borehole-related solution.",
      geographic_requirements: "Zimbabwe. Exact location required.",
      good_fit_indicators:
        "Has a defined property/site; can explain the water requirement; can provide borehole/tank/pump details where relevant; is available for technical assessment if necessary.",
      poor_fit_indicators: "Insufficient project information.",
      disqualifying_conditions: "Unsafe or unsupported requirement confirmed by technical team.",
      sort_order: 2,
      active: true,
    },
  ];
  for (const row of customers) {
    const existing = snapshot.idealCustomers.find((c) => c.name === row.name);
    const item = existing
      ? await brainCollections.updateCustomer(clientId, existing.id, row)
      : await brainCollections.createCustomer(clientId, row);
    created.push({ action: existing ? "updated" : "created", type: "ideal_customer", id: item.id, name: item.name });
  }

  const playbooks = [
    {
      name: "Residential Solar Installation",
      description: "Qualify a residential customer before recommending a standard Ecolus Package or moving toward a custom solar quotation.",
      applies_to: "Residential solar",
      trigger_conditions: {
        keywords: [
          "solar for home",
          "home solar",
          "solar package",
          "solar system",
          "backup power",
          "power cuts",
          "inverter",
          "battery",
          "3kva",
          "3kVA",
          "6.2kva",
          "6.2kVA",
          "10kva",
          "10kVA",
          "solar installation",
        ],
      },
      fields: RESIDENTIAL_FIELDS,
      completion_criteria: { requireAllRequired: true },
      deal_readiness_rules: {
        requiredFieldKeys: ["project_location", "main_requirement", "appliances", "timeline"],
        notes:
          "A residential Deal may normally be created when SegmiQ knows customer identity, location, residential solar requirement, main appliances/load and intended timeline. Budget may remain unknown. Do not create a Deal from a greeting alone. Customer identity comes from the conversation/CRM.",
      },
      enabled: true,
      sort_order: 0,
    },
    {
      name: "Commercial Solar Project",
      description: "Qualify businesses and organisations requiring a commercial solar installation.",
      applies_to: "Commercial solar",
      trigger_conditions: {
        keywords: [
          "commercial solar",
          "solar for business",
          "solar for office",
          "solar for shop",
          "industrial solar",
          "solar for company",
          "business backup",
          "commercial installation",
        ],
      },
      fields: COMMERCIAL_FIELDS,
      completion_criteria: { requireAllRequired: true },
      deal_readiness_rules: {
        notes:
          "Commercial solar projects should normally be treated as requiring technical/scoping review before final commercial commitment.",
      },
      enabled: true,
      sort_order: 1,
    },
    {
      name: "Solar Geyser",
      description: "Qualify customers looking for solar water heating.",
      applies_to: "Solar geyser",
      trigger_conditions: {
        keywords: ["solar geyser", "solar water heater", "water heating", "geyser installation"],
      },
      fields: GEYSER_FIELDS,
      completion_criteria: { requireAllRequired: true },
      deal_readiness_rules: {
        notes: "Do not invent geyser capacity or price.",
      },
      enabled: true,
      sort_order: 2,
    },
    {
      name: "Solar Water Pump / Borehole Project",
      description: "Qualify borehole, water-pumping or solar water-pump enquiries.",
      applies_to: "Water pump / borehole",
      trigger_conditions: {
        keywords: ["water pump", "solar pump", "borehole", "borehole drilling", "booster pump", "pump system"],
      },
      fields: PUMP_FIELDS,
      completion_criteria: { requireAllRequired: true },
      deal_readiness_rules: {
        notes: "Do not invent pump sizing.",
      },
      enabled: true,
      sort_order: 3,
    },
  ];
  for (const row of playbooks) {
    const existing = snapshot.playbooks.find((p) => p.name === row.name);
    const item = existing
      ? await brainCollections.updatePlaybook(clientId, existing.id, row)
      : await brainCollections.createPlaybook(clientId, row);
    created.push({ action: existing ? "updated" : "created", type: "playbook", id: item.id, name: item.name });
  }

  const stages: Array<{ stage: string; guidance: string }> = [
    {
      stage: "QUALIFIED",
      guidance:
        "Required customer/project information has been collected. Confirm whether the customer is asking for an existing standard Package or needs a custom solution. Ensure the Deal has a clear next action.",
    },
    {
      stage: "SCOPING",
      guidance:
        "Confirm load, site and technical requirements. Determine whether an existing Ecolus Package is appropriate or technical assessment/custom configuration is required. Schedule site assessment where necessary.",
    },
    {
      stage: "PROPOSAL_SENT",
      guidance:
        "A SegmiQ quotation has been sent. Keep the quotation version/status separate from Deal stage. Follow up according to configured Company settings. Do not create another quotation unless a revision or new offer is required.",
    },
    {
      stage: "NEGOTIATING",
      guidance:
        "Customer is discussing price, configuration, Package options, payment terms or other changes. Never invent discounts or non-standard commercial terms. Use the existing approval and Commercial Check workflow.",
    },
  ];
  for (const row of stages) {
    const existing = snapshot.stageGuidance.find((g) => g.stage === row.stage);
    const item = await brainCollections.upsertStage(clientId, row);
    created.push({ action: existing ? "updated" : "created", type: "stage_guidance", id: item.id, name: row.stage });
  }

  const areaRow = {
    label: "Zimbabwe",
    city: "Zimbabwe",
    province: null,
    country: "Zimbabwe",
    status: "CONFIRMATION_REQUIRED",
    travel_charge_applies: false,
    travel_charge_note: "N/A — travel charges have not been published and must not be invented.",
    min_order: null,
    manager_confirmation_required: true,
    assigned_note:
      "Ecolus publicly states that projects have been completed across Zimbabwe. Exact project location, logistics, travel cost and availability must be confirmed before the Agent promises an installation.",
    active: true,
  };
  const existingArea = snapshot.serviceAreas.find(
    (a) => a.label === "Zimbabwe" || (a.country === "Zimbabwe" && !a.city) || a.city === "Zimbabwe"
  );
  if (existingArea) {
    const item = await brainCollections.updateArea(clientId, existingArea.id, areaRow);
    created.push({ action: "updated", type: "service_area", id: item.id, name: item.label ?? "Zimbabwe" });
  } else if (!snapshot.serviceAreas.length) {
    const item = await brainCollections.createArea(clientId, areaRow);
    created.push({ action: "created", type: "service_area", id: item.id, name: item.label ?? "Zimbabwe" });
  } else {
    note(
      "Service areas",
      "Zimbabwe (confirmation required)",
      `Existing service-area records (${snapshot.serviceAreas.map((a) => a.label ?? a.city).join(", ")}) were left in place. The conservative Zimbabwe-wide record was not duplicated.`
    );
  }

  const appointments = [
    {
      name: "Sales consultation",
      duration_minutes: 30,
      min_notice_hours: 2,
      location_required: false,
      buffer_minutes: 15,
      working_hours_source: "COMPANY",
      eligible_user_ids: salespersonIds,
      enabled: true,
      sort_order: 0,
    },
    {
      name: "Solar site assessment",
      duration_minutes: 60,
      min_notice_hours: 24,
      location_required: true,
      buffer_minutes: 30,
      working_hours_source: "COMPANY",
      eligible_user_ids: salesAndManagers,
      enabled: true,
      sort_order: 1,
    },
    {
      name: "Commercial technical assessment",
      duration_minutes: 90,
      min_notice_hours: 24,
      location_required: true,
      buffer_minutes: 30,
      working_hours_source: "COMPANY",
      eligible_user_ids: managerIds.length ? [...new Set([...managerIds, ...salespersonIds])] : salesAndManagers,
      enabled: true,
      sort_order: 2,
    },
    {
      name: "Solar geyser / water project assessment",
      duration_minutes: 60,
      min_notice_hours: 24,
      location_required: true,
      buffer_minutes: 30,
      working_hours_source: "COMPANY",
      eligible_user_ids: managerIds.length ? managerIds : allTeamIds,
      enabled: true,
      sort_order: 3,
    },
  ];
  for (const row of appointments) {
    const existing = snapshot.appointmentTypes.find((t) => t.name === row.name);
    if (existing) {
      created.push({ action: "reused", type: "appointment_type", id: existing.id, name: existing.name });
      continue;
    }
    const item = await brainCollections.createAppointment(clientId, row);
    created.push({ action: "created", type: "appointment_type", id: item.id, name: item.name });
  }

  const faqs = [
    {
      question: "What does Ecolus Energy do?",
      aliases: ["What services do you offer", "What do you guys do", "Do you do solar"],
      approved_answer:
        "Ecolus Energy supplies and installs residential and commercial solar solutions. The company also provides solar geysers, water-pump solutions, borehole-related services, solar lighting and solar consultancy.",
      category: "Company / Services",
    },
    {
      question: "Do you do residential solar installations?",
      aliases: ["Do you install home solar", "Can you install solar at my house"],
      approved_answer: "Yes. Ecolus Energy provides residential solar installations and also offers standard residential solar Packages.",
      category: "Solar",
    },
    {
      question: "Do you do commercial solar?",
      aliases: ["Can you install solar for my business", "Do you do business solar"],
      approved_answer:
        "Yes. Ecolus Energy provides commercial solar installations. Commercial projects may require technical scoping or a site assessment before the final system and quotation are confirmed.",
      category: "Commercial Solar",
    },
    {
      question: "Do you install solar geysers?",
      aliases: ["Do you sell solar geysers", "Can you install a solar water heater"],
      approved_answer: "Yes. Solar geyser installation is one of Ecolus Energy's services.",
      category: "Solar Geyser",
    },
    {
      question: "Do you do boreholes?",
      aliases: ["Do you drill boreholes", "Can you help with a borehole"],
      approved_answer:
        "Ecolus Energy lists borehole drilling among its services. We can collect the site details and have the team confirm the project requirements.",
      category: "Water / Borehole",
    },
    {
      question: "Do you provide solar water pumps?",
      aliases: ["Do you do solar pumps", "Can solar pump my borehole"],
      approved_answer:
        "Yes. Ecolus Energy provides water-pump solutions, including solar-related pumping solutions. The correct system depends on the site and pump requirements.",
      category: "Water Pump",
    },
    {
      question: "Where are you located?",
      aliases: ["Where are your offices", "What's your address"],
      approved_answer: "Ecolus Energy is located at 218 Samora Machel Ave, Eastlea, Harare.",
      category: "Company",
    },
    {
      question: "Do you work outside Harare?",
      aliases: ["Do you come to my town", "Do you install around Zimbabwe"],
      approved_answer:
        "Ecolus Energy states that it has completed projects across Zimbabwe. Please share the project location so the team can confirm logistics and availability.",
      category: "Service Area",
    },
    {
      question: "What are your business hours?",
      aliases: ["When are you open", "Are you open Saturday", "Are you open Sunday"],
      approved_answer:
        "Published hours are Monday to Friday 8:00 AM to 4:30 PM and Saturday 9:00 AM to 1:00 PM. Sunday is closed. Ecolus also advertises emergency service 24/7.",
      category: "Company",
    },
    {
      question: "Can you give me a solar price?",
      aliases: ["How much is solar", "How much is a system", "Package prices"],
      approved_answer:
        "Yes. Ecolus Energy has standard solar Packages with published prices. If one of those Packages fits what you are looking for, I can show you the options. Custom systems need to be quoted based on the project requirements.",
      category: "Pricing",
    },
    {
      question: "Does installation come with the Packages?",
      aliases: ["Is labour included", "Does the price include installation"],
      approved_answer:
        "Yes. The supplied Ecolus solar Package information lists materials and accessories plus labour and installation as included.",
      category: "Packages",
    },
    {
      question: "Can you tell me exactly which Package I need?",
      aliases: ["Which system should I buy", "What size system do I need"],
      approved_answer:
        "I can help narrow down the available Packages from your requirements, but the final suitability depends on what you need to power and may require technical confirmation.",
      category: "Technical",
    },
  ];
  const reviewedAt = new Date().toISOString();
  for (const row of faqs) {
    const payload = { ...row, active: true, last_reviewed_at: reviewedAt };
    const existing = snapshot.faqs.find((f) => f.question === row.question);
    const item = existing
      ? await brainCollections.updateFaq(clientId, existing.id, payload, actorId)
      : await brainCollections.createFaq(clientId, payload);
    created.push({ action: existing ? "updated" : "created", type: "faq", id: item.id, name: item.question });
  }

  const examples = [
    {
      situation: "New solar enquiry",
      customer_message: "Hi, I need solar for my house.",
      preferred_response:
        "Hi, thanks for contacting Ecolus Energy. I'd be happy to help. Which area is the property located in, and what would you mainly like the system to power?",
      why_preferred: "Starts the Residential Solar playbook instead of recommending a Package from a greeting.",
      category: "NEW_ENQUIRY",
    },
    {
      situation: "Customer asks for cheapest system",
      customer_message: "What's your cheapest package?",
      preferred_response:
        "Ecolus Energy currently has several standard Packages. I can show you the available options and help narrow them down based on what you need to power.",
      why_preferred: "Does not invent a cheapest ranking or a price from memory.",
      category: "PRICING_REQUEST",
    },
    {
      situation: "Customer asks directly for 3kVA Lite",
      customer_message: "I want the 3kVA Lite.",
      preferred_response:
        "The 3kVA Lite is one of the current Ecolus Packages. It includes 2 × 450W mono panels, 1 × 24V 100Ah lithium battery, 1 × 3kVA inverter, materials and accessories, plus labour and installation. The published Package price is USD 930. Would you like me to prepare the next step for a quotation?",
      why_preferred: "Uses published Package facts. Agent must still retrieve the live Package record at runtime.",
      category: "QUOTATION_REQUEST",
    },
    {
      situation: "Customer asks for recommendation",
      customer_message: "I have two fridges, borehole and washing machine. Will the 3kVA work?",
      preferred_response:
        "Those are heavier loads, so I don't want to recommend the wrong system. Let me collect the full requirements and match them against the appropriate Ecolus Package or have the technical team confirm the configuration.",
      why_preferred: "Does not treat marketing 'It can power' artwork as an engineering guarantee.",
      category: "NEW_ENQUIRY",
    },
    {
      situation: "Discount",
      customer_message: "Give me 10% discount.",
      preferred_response: "I can ask the sales team to review the commercial terms for you.",
      why_preferred: "Does not promise an unauthorized discount.",
      category: "DISCOUNT_REQUEST",
    },
    {
      situation: "Site visit",
      customer_message: "Can you come tomorrow?",
      preferred_response: "I can check the team's site-assessment availability. What time would work best for you?",
      why_preferred: "Does not confirm an appointment before the calendar tool succeeds.",
      category: "APPOINTMENT_REQUEST",
    },
    {
      situation: "Human request",
      customer_message: "I want to talk to someone.",
      preferred_response: "Of course. I'll bring a member of the Ecolus team into the conversation.",
      why_preferred: null,
      category: "HUMAN_HANDOFF",
    },
    {
      situation: "Support",
      customer_message: "My inverter is giving an error.",
      preferred_response:
        "I can help get this to the technical team. Please share the inverter brand/model and the error code showing on the unit, if you can see it.",
      why_preferred: "Does not troubleshoot electrical equipment.",
      category: "SUPPORT_REQUEST",
    },
    {
      situation: "What packages do you have",
      customer_message: "What packages do you have?",
      preferred_response:
        "Ecolus currently has standard residential solar Packages including 3kVA Lite, 3kVA Premium, 6.2kVA System, 10kVA Lite and 10kVA Premium. If you tell me what you'd like the system to power, I can help narrow down the relevant options.",
      why_preferred: "Retrieve live Active Package records rather than reciting this example from memory.",
      category: "PRICING_REQUEST",
    },
  ];
  note(
    "Response example → Technical category",
    "Technical",
    "EXAMPLE_CATEGORIES has no TECHNICAL. The recommendation example was stored as NEW_ENQUIRY."
  );
  for (const row of examples) {
    const existing = snapshot.examples.find((e) => e.situation === row.situation);
    const item = existing
      ? await brainCollections.updateExample(clientId, existing.id, { ...row, active: true })
      : await brainCollections.createExample(clientId, { ...row, active: true });
    created.push({ action: existing ? "updated" : "created", type: "response_example", id: item.id, name: item.situation });
  }

  const keyedRules: Array<{ rule_type: "NEVER_DO"; text: string; structured_key: string }> = [
    { rule_type: "NEVER_DO", text: "Never apply a discount.", structured_key: "NEVER_APPLY_DISCOUNT" },
    { rule_type: "NEVER_DO", text: "Never book an appointment on Sunday.", structured_key: "NEVER_BOOK_SUNDAY" },
    { rule_type: "NEVER_DO", text: "Never perform autonomous troubleshooting.", structured_key: "NEVER_TROUBLESHOOT" },
    { rule_type: "NEVER_DO", text: "Never mark a deal won.", structured_key: "NEVER_MARK_DEAL_WON" },
    { rule_type: "NEVER_DO", text: "Never mark a deal lost.", structured_key: "NEVER_MARK_DEAL_LOST" },
    { rule_type: "NEVER_DO", text: "Never share internal notes.", structured_key: "NEVER_SHARE_INTERNAL_NOTES" },
    { rule_type: "NEVER_DO", text: "Never disclose margins or cost prices.", structured_key: "NEVER_DISCLOSE_MARGINS" },
  ];
  const freeRules: Array<{ rule_type: "NEVER_SAY" | "NEVER_DO"; text: string }> = [
    { rule_type: "NEVER_DO", text: "Never invent a solar Package or Package price." },
    { rule_type: "NEVER_DO", text: "Never invent individual Product prices." },
    { rule_type: "NEVER_DO", text: "Never invent stock availability." },
    { rule_type: "NEVER_DO", text: "Never promise an installation date before calendar/team confirmation." },
    {
      rule_type: "NEVER_DO",
      text: "Never guarantee that a solar Package is technically suitable solely because an appliance appears in the marketing artwork.",
    },
    { rule_type: "NEVER_DO", text: "Never guarantee backup duration." },
    { rule_type: "NEVER_DO", text: "Never guarantee solar generation or electricity savings without approved calculations." },
    { rule_type: "NEVER_DO", text: "Never promise a discount." },
    { rule_type: "NEVER_DO", text: "Never promise finance or payment terms not present in current SegmiQ settings." },
    { rule_type: "NEVER_DO", text: "Never invent Product warranty." },
    { rule_type: "NEVER_DO", text: "Never expose cost price, margin or internal commercial notes." },
    {
      rule_type: "NEVER_DO",
      text: "Never give electrical repair instructions requiring the customer to open or work on energised equipment.",
    },
    {
      rule_type: "NEVER_DO",
      text: "Never tell the customer a quotation has been created or sent until the corresponding SegmiQ tool confirms success.",
    },
    { rule_type: "NEVER_DO", text: "Never bypass Commercial Check." },
    { rule_type: "NEVER_DO", text: "Never send a quotation with unresolved required approval." },
    {
      rule_type: "NEVER_DO",
      text: "If technical suitability is uncertain, ask additional qualification questions or involve the technical team.",
    },
    {
      rule_type: "NEVER_DO",
      text: "When discussing 'It can power' information from an Ecolus Package, explain it as the published Package guidance. Do not guarantee runtime, simultaneous load, energy production or appliance compatibility unless technical rules confirm it.",
    },
    {
      rule_type: "NEVER_DO",
      text: "Do not use an LLM to perform engineering sizing from assumptions. Qualify first, then compare against published Package capability guidance, and escalate if suitability remains uncertain.",
    },
  ];
  note("Agent rule → Never send a quote", "Do not enable NEVER_SEND_QUOTE", "SegmiQ Agent may prepare/send quotations where existing autonomy and Commercial Check allow it.");
  for (const row of keyedRules) {
    const existing = snapshot.rules.find((r) => r.structuredKey === row.structured_key);
    const item = existing
      ? await brainCollections.updateRule(clientId, existing.id, { ...row, enabled: true })
      : await brainCollections.createRule(clientId, { ...row, enabled: true });
    created.push({ action: existing ? "updated" : "created", type: "agent_rule", id: item.id, name: row.structured_key });
  }
  for (const row of freeRules) {
    const existing = snapshot.rules.find((r) => r.text === row.text);
    const item = existing
      ? await brainCollections.updateRule(clientId, existing.id, { ...row, structured_key: null, enabled: true })
      : await brainCollections.createRule(clientId, { ...row, structured_key: null, enabled: true });
    created.push({ action: existing ? "updated" : "created", type: "agent_rule", id: item.id, name: row.text.slice(0, 80) });
  }

  const escalations = [
    {
      name: "Complaint",
      condition_key: "COMPLAINT",
      destination_type: "SALES_MANAGER",
      priority: "HIGH",
      customer_message:
        "I'm sorry you've had this experience. I want to make sure it is handled correctly, so I'm bringing a manager into the conversation.",
    },
    {
      name: "Pricing dispute",
      condition_key: "PRICING_DISPUTE",
      destination_type: "SALES_MANAGER",
      priority: "HIGH",
      customer_message:
        "I want to make sure the pricing is reviewed correctly, so I'm bringing a member of the sales team into the conversation.",
    },
    {
      name: "Discount request",
      condition_key: "DISCOUNT_REQUEST",
      destination_type: "SALES_MANAGER",
      priority: "NORMAL",
      customer_message: "I can ask the sales team to review the commercial terms for you.",
    },
    {
      name: "Technical safety",
      condition_key: "TECHNICAL_SAFETY",
      destination_type: "SUPPORT_QUEUE",
      priority: "URGENT",
      customer_message: "Please avoid touching or opening the equipment. I'm escalating this to the technical team immediately.",
      condition_config: {
        examples: [
          "smoke",
          "fire",
          "sparking",
          "burning smell",
          "battery swelling",
          "exposed live wiring",
          "electrical shock",
          "overheating equipment",
        ],
      },
    },
    {
      name: "Legal threat",
      condition_key: "LEGAL_THREAT",
      destination_type: "ADMIN",
      priority: "URGENT",
      customer_message: "I want to make sure this is handled by the appropriate person, so I'm escalating the matter to management.",
    },
    {
      name: "Unsupported technical request",
      condition_key: "UNSUPPORTED_REQUEST",
      destination_type: "SUPPORT_QUEUE",
      priority: "NORMAL",
      customer_message: "I don't want to give you incorrect technical information. I'll ask the technical team to confirm that for you.",
    },
  ];
  note(
    "Escalation → Quote above value",
    "Not created",
    "No verified Ecolus quotation threshold was supplied. QUOTATION_ABOVE was not seeded."
  );
  for (const row of escalations) {
    const existing = snapshot.escalationRules.find((r) => r.name === row.name);
    const item = existing
      ? await brainCollections.updateEscalation(clientId, existing.id, { ...row, enabled: true })
      : await brainCollections.createEscalation(clientId, { ...row, enabled: true });
    created.push({ action: existing ? "updated" : "created", type: "escalation_rule", id: item.id, name: item.name });
  }

  const documents = [
    {
      title: "Ecolus Energy Company Profile",
      category: "COMPANY",
      content_text:
        "Ecolus Energy is a Zimbabwean solar energy company providing residential and commercial solar solutions. Services include domestic solar installation, commercial solar installation, solar geyser installation, water-pump solutions, borehole drilling, solar lighting and solar consultancy. Ecolus publicly states that it has completed more than 500 projects across Zimbabwe and has more than eight years of experience. The company's tagline is 'Energy for the Long Run.'",
    },
    {
      title: "Ecolus Residential Solar Packages",
      category: "PRODUCT",
      content_text: `Current supplied Package information:

3kVA Lite — USD 930
2 × 450W Mono Panel
1 × 24V 100Ah Lithium Battery
1 × 3kVA Inverter
Materials & Accessories
Labour & Installation
Published guidance: 8 Lights, TV Set, Radio, Laptop & Phone Charging, Small Fridge.

3kVA Premium — USD 1,100
4 × 450W Mono Panel
1 × 24V 100Ah Lithium Battery
1 × 3kVA Inverter
Materials & Accessories
Labour & Installation
Published guidance: 10 Lights, TV Set, Radio, Laptop & Phone Charging, Fridges, Deep Freezer.

6.2kVA System — USD 1,750
6 × 450W Mono Panel
1 × 48V 100Ah Lithium Battery
1 × 6.2kVA Inverter
Materials & Accessories
Labour & Installation
Published guidance: Lights, TV Set, Radio, Laptop & Phone Charging, 2 Fridges, Deep Freezer, Borehole & Booster Pump, Washing Machine.

10kVA Lite — USD 3,150
12 × 450W Mono Panel
2 × 48V 100Ah Lithium Battery
1 × 10kVA Inverter
Materials & Accessories
Labour & Installation
Published guidance: Lights, TV Set, Radio, Laptop & Phone Charging, 2 Fridges, Deep Freezer, Borehole & Booster Pump, Washing Machine.

10kVA Premium — USD 5,250
24 × 450W Mono Panel
4 × 48V 100Ah Lithium Battery
1 × 10kVA Inverter
Materials & Accessories
Labour & Installation
Published guidance: Lights, TV Set, Radio, Laptop & Phone Charging, 2 Fridges, Deep Freezer, Borehole & Booster Pump, Washing Machine.

The 'It can power' descriptions are published Package guidance and must not be treated as guaranteed engineering calculations.`,
    },
    {
      title: "Ecolus Contact & Operating Information",
      category: "COMPANY",
      content_text: `Trading name: Ecolus Energy
Address: 218 Samora Machel Ave, Eastlea, Harare, Zimbabwe
Primary telephone: +263 712 017 222
Additional Package artwork numbers: +263 712 094 535 and +263 778 138 528
Email: info@ecolusenergy.co.zw
Website: https://ecolusgroup.co.zw/energy

Published operating hours:
Monday–Friday: 08:00–16:30
Saturday: 09:00–13:00
Sunday: Closed

Ecolus also advertises emergency service 24/7.`,
    },
    {
      title: "Ecolus Agent Solar Safety Guidance",
      category: "TRAINING",
      content_text:
        "The SegmiQ Agent may collect customer load and appliance requirements and may explain published Ecolus Package information. It must not perform unsupported engineering sizing, guarantee backup runtime, guarantee generation, guarantee appliance compatibility, instruct customers to repair energised electrical equipment, or invent Product specifications. Technical uncertainty must be referred to the Ecolus technical team.",
    },
  ];
  for (const row of documents) {
    const existing = snapshot.knowledgeDocuments.find((d) => d.title === row.title);
    let doc = existing
      ? await brainCollections.updateKnowledge(clientId, existing.id, {
          category: row.category,
          content_text: row.content_text,
          status: "DRAFT",
        })
      : await brainCollections.createKnowledge(clientId, {
          title: row.title,
          category: row.category,
          content_text: row.content_text,
          status: "DRAFT",
          uploaded_by_id: actorId,
        });
    await replaceKnowledgeChunks({
      clientId,
      documentId: doc.id,
      category: row.category,
      content: row.content_text,
    });
    if (actorId) {
      doc = await brainCollections.updateKnowledge(clientId, doc.id, {
        status: "APPROVED",
        approved_by_id: actorId,
        approved_at: new Date().toISOString(),
        last_reviewed_at: new Date().toISOString(),
      });
      await recordBrainAudit({
        clientId,
        actorId,
        action: "KNOWLEDGE_APPROVED",
        entityType: "knowledge",
        entityId: doc.id,
        summary: `Approved knowledge document "${doc.title}"`,
      });
    } else {
      note(
        "Knowledge Library approval",
        row.title,
        "No manager user on this tenant. Document left DRAFT. Agent retrieval only uses APPROVED documents."
      );
    }
    created.push({
      action: existing ? "updated" : "created",
      type: "knowledge_document",
      id: doc.id,
      name: `${doc.title} (${doc.status})`,
    });
  }

  const cats = await listCategories(clientId);
  let residentialCat = (cats.categories ?? []).find((c) => normName(String(c.name)) === "residential solar");
  if (!residentialCat) {
    const made = await createCategory(clientId, { name: "Residential Solar", sort_order: 0 });
    if (made.category) {
      residentialCat = made.category;
      created.push({
        action: "created",
        type: "product_category",
        id: String(made.category.id),
        name: "Residential Solar",
      });
    }
  } else {
    created.push({
      action: "reused",
      type: "product_category",
      id: String(residentialCat.id),
      name: String(residentialCat.name),
    });
  }
  const categoryId = residentialCat ? String(residentialCat.id) : null;

  const { data: existingProducts } = await supabase
    .from("products")
    .select("id, name, item_type, sku, internal_code, selling_price, track_inventory, description, status")
    .eq("client_id", clientId)
    .neq("status", "ARCHIVED");
  const productByKey = new Map<string, string>();

  note(
    "Product schema → selling_price",
    "null not permitted",
    "products.selling_price is numeric not null default 0. Individual Product prices were not invented. New records use the schema default 0. Existing selling prices were preserved. Package fixed prices are the commercial source of truth."
  );
  note(
    "Inventory",
    "Not created",
    "track_inventory=false. on_hand, reserved, available, reorder level and warehouse were not set."
  );

  for (const spec of CATALOGUE) {
    const match =
      (existingProducts ?? []).find((p) => String(p.internal_code ?? "") === spec.key) ??
      (existingProducts ?? []).find((p) => normName(String(p.name)) === normName(spec.name) && p.item_type === spec.item_type);
    if (match) {
      productByKey.set(spec.key, String(match.id));
      const patch: Record<string, unknown> = {};
      if (empty(match.internal_code)) patch.internal_code = spec.key;
      if (empty(match.description) && spec.description) patch.description = spec.description;
      if (match.track_inventory === true) {
        note(
          `Product → ${spec.name} track_inventory`,
          "false",
          "Existing record already tracks inventory. Left unchanged; no stock balances were invented."
        );
      }
      if (Number(match.selling_price) > 0) {
        note(
          `Product → ${spec.name} selling_price`,
          "do not invent",
          `Existing selling_price ${match.selling_price} preserved.`
        );
      }
      if (Object.keys(patch).length && actorId) {
        await updateProduct(clientId, String(match.id), actorId, patch, true);
      }
      created.push({
        action: "reused",
        type: spec.item_type === "SERVICE" ? "service" : "product",
        id: String(match.id),
        name: spec.name,
      });
      continue;
    }
    if (!actorId) {
      note(spec.name, "create skipped", "No manager actor available to create catalogue records.");
      continue;
    }
    const made = await createProduct(clientId, actorId, {
      name: spec.name,
      item_type: spec.item_type,
      internal_code: spec.key,
      description: spec.description ?? null,
      category_id: categoryId,
      status: "ACTIVE",
      unit: "Each",
      currency: "USD",
      track_inventory: false,
      can_be_quoted: true,
    });
    if (!made.product) throw new Error(made.error || `Failed to create ${spec.name}`);
    productByKey.set(spec.key, String(made.product.id));
    created.push({
      action: "created",
      type: spec.item_type === "SERVICE" ? "service" : "product",
      id: String(made.product.id),
      name: spec.name,
    });
  }

  const { data: existingPackages } = await supabase
    .from("commercial_packages")
    .select("id, name, fixed_price, currency, pricing_mode, status, image_url")
    .eq("client_id", clientId)
    .neq("status", "ARCHIVED");

  const imageDir = resolveImageDir();
  if (!imageDir) {
    note(
      "Package images",
      Object.values(PACKAGE_IMAGE_FILES).join(", "),
      "Artwork files were not found. Place them in scripts/seed-assets/ecolus-packages/ or set ECOLUS_PACKAGE_IMAGES_DIR and re-run."
    );
  }

  if (!actorId) {
    note("Packages", "create skipped", "No manager actor available to create Package records.");
  } else {
    for (const spec of PACKAGES) {
      const existing = (existingPackages ?? []).find((p) => normName(String(p.name)) === normName(spec.name));
      const missingComponents = spec.equipment.filter((e) => !productByKey.get(e.productKey));
      if (missingComponents.length) {
        note(
          `Package → ${spec.name} components`,
          missingComponents.map((c) => c.productKey).join(", "),
          "Required Product/Service records were not available. Package contents were not written."
        );
      }

      const imageFile = imageDir ? resolve(imageDir, PACKAGE_IMAGE_FILES[spec.name]) : null;
      let image: { url: string; key: string } | null = null;
      if (imageFile && existsSync(imageFile)) {
        image = await uploadPackageImage(clientId, spec.name, imageFile);
      } else if (imageDir) {
        note(`Package image → ${spec.name}`, PACKAGE_IMAGE_FILES[spec.name], `File not found in ${imageDir}.`);
      }

      const header = {
        name: spec.name,
        category_id: categoryId,
        description: `${spec.capability} Published Package guidance — not a guaranteed engineering calculation.`,
        customer_facing_description: `${spec.description}\n\n${spec.capability}`,
        internal_notes:
          "When discussing 'It can power' information from this Package, explain it as the published Package guidance. Do not guarantee runtime, simultaneous load, energy production or appliance compatibility unless technical rules confirm it.",
        pricing_mode: "FIXED_PRICE" as const,
        fixed_price: spec.price,
        currency: "USD",
        status: "ACTIVE",
        can_be_quoted: true,
        presentation_mode: "SHOW_COMPONENTS",
        tags: ["Residential Solar"],
        image_url: image?.url,
        image_key: image?.key,
      };

      let packageId: string;
      if (existing) {
        packageId = String(existing.id);
        const headerPatch: Record<string, unknown> = { ...header };
        if (existing.fixed_price != null && Number(existing.fixed_price) !== spec.price) {
          note(
            `Package → ${spec.name} price`,
            `USD ${spec.price}`,
            `Existing fixed_price is ${existing.fixed_price} ${existing.currency ?? ""}. Left unchanged.`
          );
          delete headerPatch.fixed_price;
        }
        const updated = await updatePackage(clientId, packageId, actorId, headerPatch);
        if (updated.error) throw new Error(updated.error);
        created.push({ action: "updated", type: "package", id: packageId, name: spec.name });
      } else {
        const made = await createPackage(clientId, actorId, header);
        if (!made.package) throw new Error(made.error || `Failed to create package ${spec.name}`);
        packageId = String(made.package.id);
        created.push({ action: "created", type: "package", id: packageId, name: spec.name });
      }

      if (missingComponents.length) continue;

      const equipmentSectionId = randomUUID();
      const installSectionId = randomUUID();
      const items = spec.equipment.map((e, i) => {
        const cat = CATALOGUE.find((c) => c.key === e.productKey)!;
        const isInstall = e.productKey === "ecolus:materials-accessories" || e.productKey === "ecolus:labour-installation";
        return {
          item_type: cat.item_type,
          product_id: productByKey.get(e.productKey),
          quantity: e.qty,
          optional: false,
          section_id: isInstall ? installSectionId : equipmentSectionId,
          sort_order: i,
          snapshot_name: cat.name,
          variant_mode: "FIXED_VARIANT",
        };
      });
      const saved = await savePackageContents(clientId, packageId, actorId, {
        sections: [
          { id: equipmentSectionId, name: "EQUIPMENT", sort_order: 0 },
          { id: installSectionId, name: "INSTALLATION & MATERIALS", sort_order: 1 },
        ],
        items,
      });
      if ("error" in saved && saved.error) throw new Error(String(saved.error));
    }
  }

  const { data: verifyPkgs } = await supabase
    .from("commercial_packages")
    .select("id, name, fixed_price, currency, pricing_mode, status, image_url")
    .eq("client_id", clientId)
    .in(
      "name",
      PACKAGES.map((p) => p.name)
    );

  console.log("\n=== Created / updated / reused records ===");
  for (const row of created) {
    console.log(`${row.action.padEnd(7)}  ${row.type.padEnd(24)}  ${row.id}  ${row.name}`);
  }
  console.log(`\nTotal: ${created.length}`);

  console.log("\n=== Packages ===");
  for (const spec of PACKAGES) {
    const row = (verifyPkgs ?? []).find((p) => p.name === spec.name);
    console.log(
      `${spec.name.padEnd(18)}  id=${row?.id ?? "MISSING"}  price=${row?.fixed_price ?? "?"} ${row?.currency ?? ""}  mode=${row?.pricing_mode ?? "?"}  status=${row?.status ?? "?"}  image=${row?.image_url ? "yes" : "no"}`
    );
  }

  console.log("\n=== Fields that could not be mapped 1:1 / conflicts preserved ===");
  for (const row of mismatches) {
    console.log(`- ${row.field}`);
    console.log(`  supplied: ${row.value}`);
    console.log(`  ${row.reason}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
