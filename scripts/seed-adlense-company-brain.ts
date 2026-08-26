/**
 * Populate the Adlense Network demo tenant Company Brain.
 * Uses the same store/service functions as the manager API.
 *
 * Run: npx tsx scripts/seed-adlense-company-brain.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordBrainAudit } from "@/lib/company-brain/audit";
import {
  brainCollections,
  loadCompanyBrainSnapshot,
  replaceKnowledgeChunks,
  upsertBrainSettings,
} from "@/lib/company-brain/store";
import { quotationAutomationBlockers } from "@/lib/company-brain/readiness";
import { updateAgentCompanySettings } from "@/lib/agent/settings";
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

type ReportRow = { action: "created" | "updated"; type: string; id: string; name: string };
type Mismatch = { field: string; value: string; reason: string };

const created: ReportRow[] = [];
const mismatches: Mismatch[] = [];

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

const RESIDENTIAL_FIELDS: PlaybookField[] = [
  field({
    prefix: "res",
    priority: 1,
    label: "Installation location",
    key: "installation_location",
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
    ask: "Is this for a house, apartment, townhouse or another type of property?",
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
    ask: "What would you mainly like the system to do: provide backup during power cuts, run most of the home on solar, or both?",
    values: ["Backup only", "Solar generation", "Both"],
    crm: "customer_need",
  }),
  field({
    prefix: "res",
    priority: 4,
    label: "Appliances / load",
    key: "appliances",
    type: "TEXT",
    required: true,
    ask: "Which appliances would you like the system to keep running during a power cut?",
  }),
  field({
    prefix: "res",
    priority: 5,
    label: "Heavy appliances",
    key: "heavy_appliances",
    type: "BOOLEAN",
    required: true,
    ask: "Do you need the system to run any heavy appliances such as a borehole pump, geyser, electric stove or air conditioner?",
    values: yesNo(),
  }),
  field({
    prefix: "res",
    priority: 6,
    label: "Grid electricity",
    key: "grid_electricity",
    type: "BOOLEAN",
    required: true,
    ask: "Is ZESA/grid electricity available at the property?",
    values: yesNo(),
  }),
  field({
    prefix: "res",
    priority: 7,
    label: "Existing solar",
    key: "existing_solar",
    type: "BOOLEAN",
    required: true,
    ask: "Do you already have any solar equipment installed at the property?",
    values: yesNo(),
  }),
  field({
    prefix: "res",
    priority: 8,
    label: "Existing equipment",
    key: "existing_equipment",
    type: "LONG_TEXT",
    required: false,
    ask: "What inverter, batteries or panels are currently installed?",
    showIf: { field: "existing_solar", op: "equals", value: "Yes" },
  }),
  field({
    prefix: "res",
    priority: 9,
    label: "Battery requirement",
    key: "battery_requirement",
    type: "BOOLEAN",
    required: true,
    ask: "Would you like battery backup included in the solution?",
    values: yesNo(),
    showIf: { field: "main_requirement", op: "not_equals", value: "Solar generation" },
  }),
  field({
    prefix: "res",
    priority: 10,
    label: "Budget",
    key: "budget",
    type: "CURRENCY",
    required: true,
    ask: "What approximate budget range are you working with for the project?",
    crm: "budget",
  }),
  field({
    prefix: "res",
    priority: 11,
    label: "Installation timeline",
    key: "installation_timeline",
    type: "SINGLE_SELECT",
    required: true,
    ask: "When would you ideally like the system installed?",
    values: ["Immediately", "Within 2 weeks", "Within 1 month", "1–3 months", "3–6 months", "Researching"],
    crm: "buying_timeframe",
  }),
  field({
    prefix: "res",
    priority: 12,
    label: "Site assessment",
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
    label: "Company name",
    key: "company_name",
    type: "TEXT",
    required: true,
    ask: "What is the name of the business?",
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
    label: "Business type",
    key: "business_type",
    type: "TEXT",
    required: true,
    ask: "What type of business or facility is this?",
    crm: "project_type",
  }),
  field({
    prefix: "com",
    priority: 4,
    label: "Main power problem",
    key: "main_power_problem",
    type: "SINGLE_SELECT",
    required: true,
    ask: "What is the main reason you are considering solar: power cuts, generator costs, electricity costs, or a combination?",
    values: ["Power cuts", "Generator costs", "Electricity costs", "Combination", "Other"],
    crm: "customer_need",
  }),
  field({
    prefix: "com",
    priority: 5,
    label: "Operating hours",
    key: "operating_hours",
    type: "TEXT",
    required: false,
    ask: "What are the business's normal operating hours?",
  }),
  field({
    prefix: "com",
    priority: 6,
    label: "Critical equipment",
    key: "critical_equipment",
    type: "LONG_TEXT",
    required: true,
    ask: "Which equipment must remain operational when grid power is unavailable?",
  }),
  field({
    prefix: "com",
    priority: 7,
    label: "Existing generator",
    key: "existing_generator",
    type: "BOOLEAN",
    required: false,
    ask: "Are you currently using a generator?",
    values: yesNo(),
  }),
  field({
    prefix: "com",
    priority: 8,
    label: "Existing solar",
    key: "existing_solar",
    type: "BOOLEAN",
    required: true,
    ask: "Is there already a solar system installed at the site?",
    values: yesNo(),
  }),
  field({
    prefix: "com",
    priority: 9,
    label: "Existing system",
    key: "existing_system",
    type: "LONG_TEXT",
    required: false,
    ask: "Please share the inverter, battery and panel details if known.",
    showIf: { field: "existing_solar", op: "equals", value: "Yes" },
  }),
  field({
    prefix: "com",
    priority: 10,
    label: "Budget",
    key: "budget",
    type: "CURRENCY",
    required: true,
    ask: "What approximate budget has been set aside for the project?",
    crm: "budget",
  }),
  field({
    prefix: "com",
    priority: 11,
    label: "Project timeline",
    key: "project_timeline",
    type: "DATE_RANGE",
    required: true,
    ask: "When would you ideally like the project completed?",
    crm: "buying_timeframe",
  }),
  field({
    prefix: "com",
    priority: 12,
    label: "Decision maker",
    key: "decision_maker",
    type: "TEXT",
    required: true,
    ask: "Are you the person responsible for approving the project, or will someone else also be involved?",
  }),
  field({
    prefix: "com",
    priority: 13,
    label: "Site assessment",
    key: "site_assessment",
    type: "BOOLEAN",
    required: true,
    ask: "Would the team be able to conduct a technical site assessment?",
    values: yesNo(),
  }),
];

const UPGRADE_FIELDS: PlaybookField[] = [
  field({
    prefix: "upg",
    priority: 1,
    label: "Location",
    key: "location",
    type: "LOCATION",
    required: true,
    ask: "Which area is the existing system installed in?",
    crm: "location",
  }),
  field({
    prefix: "upg",
    priority: 2,
    label: "Upgrade requirement",
    key: "upgrade_requirement",
    type: "SINGLE_SELECT",
    required: true,
    ask: "What would you like to improve: battery backup, inverter capacity, solar generation, or something else?",
    values: ["Battery", "Inverter", "Panels", "Full upgrade", "Other"],
    crm: "customer_need",
  }),
  field({
    prefix: "upg",
    priority: 3,
    label: "Inverter details",
    key: "inverter_details",
    type: "TEXT",
    required: true,
    ask: "What inverter brand, model and size are you currently using?",
  }),
  field({
    prefix: "upg",
    priority: 4,
    label: "Battery details",
    key: "battery_details",
    type: "LONG_TEXT",
    required: true,
    ask: "What batteries are currently installed, including size and quantity if known?",
  }),
  field({
    prefix: "upg",
    priority: 5,
    label: "Panel details",
    key: "panel_details",
    type: "LONG_TEXT",
    required: false,
    ask: "How many panels are currently installed and what size are they, if known?",
  }),
  field({
    prefix: "upg",
    priority: 6,
    label: "Current problem",
    key: "current_problem",
    type: "LONG_TEXT",
    required: true,
    ask: "What problem are you trying to solve with the upgrade?",
  }),
  field({
    prefix: "upg",
    priority: 7,
    label: "Budget",
    key: "budget",
    type: "CURRENCY",
    required: true,
    ask: "What budget range are you working with?",
    crm: "budget",
  }),
  field({
    prefix: "upg",
    priority: 8,
    label: "Timeline",
    key: "timeline",
    type: "DATE_RANGE",
    required: true,
    ask: "When would you like the upgrade completed?",
    crm: "buying_timeframe",
  }),
  field({
    prefix: "upg",
    priority: 9,
    label: "Assessment",
    key: "assessment",
    type: "BOOLEAN",
    required: true,
    ask: "Would you be available for a technical assessment if compatibility needs to be confirmed?",
    values: yesNo(),
  }),
];

async function main() {
  const supabase = createAdminClient();

  const { data: clients, error: clientErr } = await supabase
    .from("clients")
    .select("id, name, slug, industry, website, is_archived")
    .or("name.ilike.%Adlense%,slug.ilike.%adlense%")
    .eq("is_archived", false);
  if (clientErr) throw clientErr;
  const exact = (clients ?? []).find((c) => String(c.name).toLowerCase() === "adlense network");
  const client = exact ?? (clients ?? [])[0];
  if (!client) {
    throw new Error('No demo tenant named "Adlense Network" (or slug/name containing Adlense) was found.');
  }
  const clientId = String(client.id);
  console.log(`Seeding Company Brain for ${client.name} (${clientId}, slug=${client.slug})`);

  const { data: users } = await supabase
    .from("users")
    .select("id, name, role, also_sells, is_active")
    .eq("client_id", clientId)
    .eq("is_active", true);
  const team = users ?? [];
  const manager = team.find((u) => u.role === "CLIENT_MANAGER") ?? team[0];
  const actorId = manager ? String(manager.id) : null;
  const salespersonIds = team
    .filter((u) => u.role === "SALESPERSON" || u.also_sells === true)
    .map((u) => String(u.id));
  const managerIds = team.filter((u) => u.role === "CLIENT_MANAGER").map((u) => String(u.id));
  const allTeamIds = team.map((u) => String(u.id));

  if (!salespersonIds.length) {
    mismatches.push({
      field: "Appointment type → Who can take it (Salespeople)",
      value: "Salespeople",
      reason: "No SALESPERSON users (or also_sells managers) on this tenant. eligible_user_ids left empty.",
    });
  }
  mismatches.push({
    field: "Appointment type → Who can take it (Technical team / Support)",
    value: "Technical team, Support / Technical team, Senior salesperson",
    reason:
      "Users only have CLIENT_MANAGER / SALESPERSON roles. Technical and Support are not first-class roles. Mapped Technical/Support slots to managers + salespeople where a person is required.",
  });

  const snapshot = await loadCompanyBrainSnapshot(clientId);
  const canonical = snapshot.canonical;
  console.log("Canonical (not duplicated into Company Brain):", {
    companyName: canonical.companyName,
    industry: canonical.industry,
    timezone: canonical.timezone,
    website: canonical.website,
    phone: canonical.phone,
    email: canonical.email,
    currency: canonical.currency,
    paymentTerms: canonical.paymentTerms,
    products: canonical.productCount,
    services: canonical.serviceCount,
    packages: canonical.packageCount,
    quoteTemplates: canonical.quoteTemplateCount,
    hours: `${canonical.workStartTime}–${canonical.workEndTime}`,
    workingDays: canonical.workingDays,
    allowQuotationDiscount: canonical.allowQuotationDiscount,
    quoteAutoSendLimit: canonical.quoteAutoSendLimit,
  });

  if (canonical.companyName && canonical.companyName !== "Adlense Network") {
    mismatches.push({
      field: "Company Information → Legal name",
      value: "Adlense Network",
      reason: `Existing legal name is "${canonical.companyName}". Left unchanged as requested.`,
    });
  }
  if (canonical.timezone && canonical.timezone !== "Africa/Harare") {
    mismatches.push({
      field: "Company Information → Timezone",
      value: "Africa/Harare",
      reason: `Existing timezone is "${canonical.timezone}". Left unchanged.`,
    });
  }
  mismatches.push({
    field: "Business hours → Saturday 08:00–13:00 vs weekday 08:00–17:00",
    value: "Mon–Fri 08:00–17:00, Sat 08:00–13:00, Sun closed",
    reason:
      "Canonical sales_execution_settings store one start/end time for all working days. Saturday half-day cannot be represented separately. Existing Company Information / sales hours were not overwritten.",
  });

  const quoteCap =
    canonical.quoteAutoSendLimit != null && Number.isFinite(canonical.quoteAutoSendLimit)
      ? Number(canonical.quoteAutoSendLimit)
      : 5000;
  if (canonical.quoteAutoSendLimit != null && canonical.quoteAutoSendLimit !== 5000) {
    mismatches.push({
      field: "Escalation → High-value quotation threshold",
      value: "USD 5,000",
      reason: `Used existing agent quote_auto_send_limit (${canonical.quoteAutoSendLimit}) instead of inventing a second threshold.`,
    });
  }

  const settings = await upsertBrainSettings(clientId, {
    tradingName: "Adlense Solar",
    businessKind: "installer",
    customerModel: "BOTH",
    languages: ["English", "Shona"],
    agentBusinessExplanation:
      "We supply and install residential and commercial solar energy systems in Zimbabwe. We provide solar panels, hybrid inverters, lithium batteries, protection equipment, mounting systems, installation, commissioning, upgrades, maintenance and after-sales support. We serve homeowners and businesses. Final system sizing may require technical assessment or a site visit. The Agent must not invent system sizes, product compatibility, prices, stock availability or technical guarantees.",
    primaryOffering: "Supply and professional installation of residential and commercial solar and backup-power systems.",
    catalogueCustomerType:
      "Homeowners, offices, shops, schools, farms, lodges, clinics and small to medium businesses.",
    typicalOrderType: "Project supply and installation.",
    weDoNotNormallySell:
      "Unverified technical designs, unsupported electrical modifications, products that are not in the current SegmiQ catalogue, or solutions that the technical team has ruled incompatible with the customer's requirements.",
    specialSellingConditions:
      "Custom and larger systems may require a site assessment or technical review before the final quotation is sent. Product compatibility and system sizing must be confirmed using approved packages, technical rules or a human technical reviewer. Commercial solar projects should normally receive technical review before the final quotation is sent.",
    pricingGuidance:
      "Only use current prices from SegmiQ Products, Services, Packages or an existing quotation. Do not invent or estimate a price when there is no approved catalogue or quotation price. Standard package pricing may be discussed where the current catalogue supports it. Custom solar installations may require technical assessment and a quotation before a final price is provided. Do not call an indicative price a final quotation. Do not promise a discount. Do not invent transport costs. Do not promise that equipment is available unless inventory/catalogue data confirms this. Do not describe prices as negotiable unless company policy allows it. Final commercial offers must use SegmiQ's quotation system.",
    paymentGuidance:
      "Use the payment terms attached to the quotation or the company's active quotation settings. Do not invent deposit percentages or alternative arrangements. If a customer requests different terms, submit the request for human review.",
    neverEstimatePrices: true,
    creditOffered: false,
    paymentPlansOffered: false,
    nonstandardTermsRequireApproval: true,
    supportOffered: true,
    supportDestinationType: "SUPPORT_QUEUE",
    supportHoursNote: "Monday-Friday 08:00-17:00, Saturday 08:00-13:00",
    supportCategories: [
      "Product fault",
      "Installation issue",
      "Inverter error",
      "Battery issue",
      "Solar panel issue",
      "System not charging",
      "Low backup duration",
      "Warranty claim",
      "Maintenance request",
      "Upgrade request",
      "Delivery issue",
      "Billing/payment issue",
      "Other",
    ],
    supportIntakeFields: [
      { key: "customer_identity", label: "Customer/project identity", required: true },
      { key: "installation_location", label: "Installation location", required: true },
      { key: "installation_date", label: "Approximate installation date" },
      { key: "inverter_model", label: "Inverter brand/model" },
      { key: "battery_model", label: "Battery brand/model" },
      { key: "error_code", label: "Error code" },
      { key: "problem_description", label: "Problem description", required: true },
      { key: "problem_started", label: "When the problem started" },
      { key: "system_supplying_power", label: "Whether the system is still supplying power" },
      { key: "photo", label: "Relevant photo or screenshot" },
      { key: "safety_concern", label: "Whether there is an immediate safety concern" },
    ],
    autonomousTroubleshooting: false,
    warrantyBoundaries:
      "We support equipment supplied or installed by the company according to the applicable product and workmanship warranty. Warranty does not cover unauthorized modifications, misuse, physical damage or third-party alterations where those are excluded by the applicable warranty. For products not supplied or installed by us, technical assessment may be required before support is offered.",
    voicePrimary: "professional",
    voiceSecondary: "warm",
    responseLength: "balanced",
    emojiPolicy: "minimal",
    greetingStyle: "Hi, thanks for contacting Adlense Solar. I'd be happy to help with your solar requirements.",
    preferredTerms: [
      { prefer: "quotation", avoid: "estimate" },
      { prefer: "solar solution", avoid: "cheap solar system" },
      { prefer: "installation", avoid: "fitting" },
      { prefer: "customer", avoid: "lead" },
      { prefer: "site assessment", avoid: "inspection visit" },
      { prefer: "payment terms", avoid: "payment deal" },
      { prefer: "technical team", avoid: "guys" },
    ],
    claimsToAvoid: [
      "Do not call us the cheapest solar company.",
      "Do not call us the best solar company in Zimbabwe.",
      "Do not claim we are number one unless formally verified.",
      "Do not guarantee electricity savings.",
      "Do not guarantee that the customer will never experience a power cut.",
      "Do not promise same-day installation.",
      "Do not promise stock availability unless confirmed.",
      "Do not promise a discount.",
      "Do not promise finance or credit.",
      "Do not guarantee system size without approved technical confirmation.",
      "Do not guarantee installation dates before calendar and project confirmation.",
      "Do not describe estimated solar generation as guaranteed generation.",
    ],
    quoteFollowUpBusinessDays: 2,
    secondFollowUpBusinessDays: 5,
    maxAutonomousFollowUps: 2,
    defaultEscalationMessage:
      "I want to make sure this is handled correctly, so I'm bringing a member of the team into the conversation.",
  });
  created.push({
    action: snapshot.exists ? "updated" : "created",
    type: "company_brain_settings",
    id: clientId,
    name: settings.tradingName ?? "Adlense Solar",
  });
  await recordBrainAudit({
    clientId,
    actorId,
    action: "SETTINGS_UPDATED",
    entityType: "company_brain_settings",
    entityId: clientId,
    summary: "Seeded Adlense Solar Company Brain demo settings",
  });

  mismatches.push({
    field: "Support intake → Agent must not give electrical repair instructions",
    value: "Must not give electrical repair instructions",
    reason: "No dedicated support-intake policy field. Stored as a NEVER_DO agent rule and in the support knowledge document.",
  });
  mismatches.push({
    field: "Residential playbook → Appliances / load allowed answers",
    value: "Short text / pick several",
    reason: "MULTI_SELECT requires a closed list. Mapped to TEXT so the Agent can capture free-form appliance lists without inventing options.",
  });
  mismatches.push({
    field: "Residential playbook → Battery requirement only ask if",
    value: "Existing/new system requires backup",
    reason:
      "Playbook conditionals support one field equals/not_equals. Mapped to show unless Main requirement is 'Solar generation' (covers Backup only and Both).",
  });
  mismatches.push({
    field: "Residential Deal readiness → Customer identity",
    value: "Customer identity required before Deal create",
    reason: "Not a playbook field. Identity comes from the conversation/CRM. Stored on deal_readiness_rules.requiredFieldKeys without a customer_identity field.",
  });
  mismatches.push({
    field: "Follow-up suppression rules",
    value:
      "Do not follow up if customer replied / opted out / quote superseded / deal closed / newer salesperson task / complaint escalation / customer asked another date",
    reason:
      "No Company Brain collection for follow-up suppression. Runtime conversation/task state already owns these. Not duplicated as a new model.",
  });
  mismatches.push({
    field: "Residential site assessment custom hours",
    value: "Mon–Fri 09:00–16:00 and Saturday 09:00–12:30",
    reason:
      "appointment_types custom hours are one start/end plus working_days. Stored CUSTOM Mon–Sat 09:00–16:00. Saturday 12:30 close cannot be a second window.",
  });
  mismatches.push({
    field: "Create Customer capability",
    value: "ON",
    reason: "agent_company_settings has createLeads, not a separate createCustomer flag. Mapped to createLeads.",
  });
  mismatches.push({
    field: "Response example 2 category",
    value: "Qualification",
    reason: "EXAMPLE_CATEGORIES has no QUALIFICATION. Mapped to NEW_ENQUIRY.",
  });
  mismatches.push({
    field: "Response example 5 after-booking reply",
    value: "Thursday at 10:00 is confirmed...",
    reason: "Only one preferred_response column. Combined the pre-booking reply with the post-booking line in preferred_response.",
  });
  mismatches.push({
    field: "Escalation 8 HIGH_VALUE_DEAL matching",
    value: "Commercial solar project / High-value deal",
    reason:
      "condition_key HIGH_VALUE_DEAL exists on company_brain_escalation_rules, but matchEscalationRules currently does not evaluate it. Rule is still stored.",
  });
  mismatches.push({
    field: "Technical safety example list",
    value: "Smoke, burning smell, fire, sparking, swollen battery, exposed wiring, shock, overheating",
    reason:
      "Matching uses hardcoded TECHNICAL_SAFETY regex, not a stored keyword list. Examples saved on condition_config.examples for operators; runtime still uses the existing matcher.",
  });

  const customers = [
    {
      name: "Residential Homeowner",
      description:
        "Homeowner looking for solar backup, reduced dependence on grid electricity, improved battery backup or a complete home solar installation.",
      typical_requirements:
        "Homeowner looking for solar backup, reduced dependence on grid electricity, improved battery backup or a complete home solar installation.",
      min_project_size: "No fixed minimum. Must have a genuine solar or backup-power requirement.",
      typical_decision_maker: "Homeowner, spouse or property owner.",
      primary_interest:
        "Solar panels, inverter, lithium battery, installation, backup during outages, whole-home or selected-load power.",
      geographic_requirements:
        "Zimbabwe. Primary service areas are preferred. Locations outside normal service areas may require confirmation.",
      good_fit_indicators:
        "Clear power problem, known installation location, willingness to discuss appliances, budget available, installation required within three months, willing to arrange site assessment if required.",
      poor_fit_indicators:
        "Only collecting prices, no defined location, no timeline, unwilling to provide basic requirements, project is more than twelve months away.",
      disqualifying_conditions:
        "Customer requires work that the company does not provide or requests unsafe/illegal electrical work.",
      sort_order: 0,
      active: true,
    },
    {
      name: "Commercial Solar Customer",
      description:
        "Business experiencing unreliable electricity, high generator costs or needing backup and solar generation for business operations.",
      typical_requirements:
        "Business experiencing unreliable electricity, high generator costs or needing backup and solar generation for business operations.",
      min_project_size: "No fixed minimum. Project must require a commercial solar or backup-power solution.",
      typical_decision_maker:
        "Business owner, managing director, operations manager, facilities manager or finance manager.",
      primary_interest:
        "Solar installation, backup power, battery storage, generator reduction, energy reliability or expansion of an existing system.",
      geographic_requirements: "Zimbabwe. Projects outside normal service areas require logistics confirmation.",
      good_fit_indicators:
        "Clear operational power problem, decision maker involved, site available for assessment, project planned within ninety days, budget or commercial approval process understood.",
      poor_fit_indicators:
        "No identified project, no decision maker, no willingness to provide load information, long undefined timeline.",
      disqualifying_conditions: "Project requires services outside Adlense Solar's approved capabilities.",
      sort_order: 1,
      active: true,
    },
    {
      name: "Solar Upgrade Customer",
      description:
        "Customer already using solar and wanting additional batteries, more panels, a larger inverter, maintenance or replacement equipment.",
      typical_requirements:
        "Customer already using solar and wanting additional batteries, more panels, a larger inverter, maintenance or replacement equipment.",
      min_project_size: null,
      typical_decision_maker: "System owner or property owner.",
      primary_interest:
        "Battery expansion, inverter upgrade, more panels, fault assessment, replacement equipment or increased backup duration.",
      geographic_requirements: "Zimbabwe. Service-area rules apply.",
      good_fit_indicators: "Can provide details of existing inverter, batteries or solar installation.",
      poor_fit_indicators: "No information about existing equipment and unwilling to arrange technical assessment.",
      disqualifying_conditions:
        "Requested equipment combination is confirmed unsafe or incompatible by the technical team.",
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
      description: "Qualify homeowners looking for a new solar or backup-power installation.",
      applies_to: "Residential solar",
      trigger_conditions: {
        keywords: [
          "solar for my house",
          "home solar",
          "residential solar",
          "power cuts",
          "backup power",
          "5kVA",
          "inverter and battery",
          "solar installation",
          "solar system for home",
        ],
      },
      fields: RESIDENTIAL_FIELDS,
      completion_criteria: { requireAllRequired: true },
      deal_readiness_rules: {
        requiredFieldKeys: [
          "installation_location",
          "main_requirement",
          "appliances",
          "budget",
          "installation_timeline",
        ],
        notes:
          "Customer identity comes from the conversation/CRM. The Agent may continue collecting technical information after Deal creation.",
      },
      enabled: true,
      sort_order: 0,
    },
    {
      name: "Commercial Solar Installation",
      description: "Qualify businesses looking for solar generation, backup power or energy-cost reduction.",
      applies_to: "Commercial solar",
      trigger_conditions: {
        keywords: [
          "solar for business",
          "commercial solar",
          "solar for office",
          "shop solar",
          "factory solar",
          "school solar",
          "lodge solar",
          "commercial installation",
        ],
      },
      fields: COMMERCIAL_FIELDS,
      completion_criteria: { requireAllRequired: true },
      deal_readiness_rules: {
        notes: "Commercial solar projects should normally receive technical review before the final quotation is sent.",
      },
      enabled: true,
      sort_order: 1,
    },
    {
      name: "Solar System Upgrade",
      description: "Collect information about an existing system before recommending an upgrade.",
      applies_to: "Existing solar upgrade",
      trigger_conditions: {
        keywords: [
          "add battery",
          "more batteries",
          "upgrade inverter",
          "add panels",
          "increase backup",
          "existing solar",
          "replace inverter",
          "battery upgrade",
        ],
      },
      fields: UPGRADE_FIELDS,
      completion_criteria: { requireAllRequired: true },
      deal_readiness_rules: {
        notes:
          "Never guarantee compatibility between a new inverter, battery or panel and an existing solar installation unless compatibility has been confirmed by an approved product rule or technical reviewer.",
      },
      enabled: true,
      sort_order: 2,
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
        "Customer has a genuine requirement and the required qualification information has been captured. Create or maintain the Deal, identify whether a site assessment is required and ensure there is a next action.",
    },
    {
      stage: "SCOPING",
      guidance:
        "Technical requirements are being confirmed. Collect missing site/load information, schedule site assessment where required and avoid making final technical promises before confirmation. Commercial solar projects should normally receive technical review before the final quotation is sent.",
    },
    {
      stage: "PROPOSAL_SENT",
      guidance:
        "The customer has received a quotation. Do not create another quotation unless a revision is required. Monitor customer response and create follow-up according to company rules. Do not send an automated follow-up if the customer has already replied, opted out, the quotation has been superseded, the deal is closed, a salesperson has a newer follow-up task, the conversation is under complaint escalation, or the customer asked to be contacted on another date.",
    },
    {
      stage: "NEGOTIATING",
      guidance:
        "Customer is discussing pricing, options, payment terms or changes. Do not agree to discounts or non-standard terms without the required commercial approval. Escalate pricing disputes and material commercial exceptions.",
    },
  ];
  for (const row of stages) {
    const existing = snapshot.stageGuidance.find((g) => g.stage === row.stage);
    const item = await brainCollections.upsertStage(clientId, row);
    created.push({
      action: existing ? "updated" : "created",
      type: "stage_guidance",
      id: item.id,
      name: row.stage,
    });
  }

  const areas = [
    {
      label: "Harare",
      city: "Harare",
      province: "Harare",
      country: "Zimbabwe",
      status: "PRIMARY",
      travel_charge_applies: false,
      travel_charge_note:
        "No standard travel charge inside normal Harare coverage. Final project logistics remain subject to quotation.",
      min_order: null,
      manager_confirmation_required: false,
    },
    {
      label: "Chitungwiza",
      city: "Chitungwiza",
      province: "Harare",
      country: "Zimbabwe",
      status: "PRIMARY",
      travel_charge_applies: false,
      travel_charge_note: "No standard travel charge. Project logistics remain subject to quotation.",
      min_order: null,
      manager_confirmation_required: false,
    },
    {
      label: "Ruwa",
      city: "Ruwa",
      province: "Mashonaland East",
      country: "Zimbabwe",
      status: "EXTENDED",
      travel_charge_applies: true,
      travel_charge_note: "Transport/logistics may be added to the quotation depending on the project.",
      min_order: null,
      manager_confirmation_required: false,
    },
    {
      label: "Norton",
      city: "Norton",
      province: "Mashonaland West",
      country: "Zimbabwe",
      status: "EXTENDED",
      travel_charge_applies: true,
      travel_charge_note: "Transport/logistics may be added to the quotation.",
      min_order: null,
      manager_confirmation_required: false,
    },
    {
      label: "Marondera",
      city: "Marondera",
      province: "Mashonaland East",
      country: "Zimbabwe",
      status: "EXTENDED",
      travel_charge_applies: true,
      travel_charge_note: "Transport and site logistics may affect the quotation.",
      min_order: null,
      manager_confirmation_required: false,
    },
    {
      label: "Mutare",
      city: "Mutare",
      province: "Manicaland",
      country: "Zimbabwe",
      status: "CONFIRMATION_REQUIRED",
      travel_charge_applies: true,
      travel_charge_note: "Transport and logistics must be confirmed.",
      min_order: null,
      manager_confirmation_required: true,
    },
    {
      label: "Bulawayo",
      city: "Bulawayo",
      province: "Bulawayo",
      country: "Zimbabwe",
      status: "CONFIRMATION_REQUIRED",
      travel_charge_applies: true,
      travel_charge_note: "Transport and logistics must be confirmed.",
      min_order: null,
      manager_confirmation_required: true,
    },
    {
      label: "Other locations in Zimbabwe",
      city: "Other locations in Zimbabwe",
      province: null,
      country: "Zimbabwe",
      status: "CONFIRMATION_REQUIRED",
      travel_charge_applies: true,
      travel_charge_note: "Depends on project location and logistics.",
      min_order: null,
      manager_confirmation_required: true,
    },
  ];
  for (const row of areas) {
    const existing = snapshot.serviceAreas.find(
      (a) => a.label === row.label || (a.city === row.city && a.country === row.country)
    );
    const item = existing
      ? await brainCollections.updateArea(clientId, existing.id, row)
      : await brainCollections.createArea(clientId, row);
    created.push({
      action: existing ? "updated" : "created",
      type: "service_area",
      id: item.id,
      name: item.label ?? item.city ?? row.label,
    });
  }

  const appointments = [
    {
      name: "Sales consultation call",
      duration_minutes: 30,
      min_notice_hours: 2,
      location_required: false,
      buffer_minutes: 15,
      working_hours_source: "SALES",
      eligible_user_ids: salespersonIds,
      enabled: true,
      sort_order: 0,
    },
    {
      name: "Residential site assessment",
      duration_minutes: 45,
      min_notice_hours: 24,
      location_required: true,
      buffer_minutes: 30,
      working_hours_source: "CUSTOM",
      custom_working_days: [1, 2, 3, 4, 5, 6],
      custom_start_time: "09:00",
      custom_end_time: "16:00",
      eligible_user_ids: [...new Set([...salespersonIds, ...managerIds])],
      enabled: true,
      sort_order: 1,
    },
    {
      name: "Commercial site assessment",
      duration_minutes: 90,
      min_notice_hours: 24,
      location_required: true,
      buffer_minutes: 30,
      working_hours_source: "COMPANY",
      eligible_user_ids: [...new Set([...managerIds, ...salespersonIds])],
      enabled: true,
      sort_order: 2,
    },
    {
      name: "Quotation review call",
      duration_minutes: 30,
      min_notice_hours: 2,
      location_required: false,
      buffer_minutes: 15,
      working_hours_source: "SALES",
      eligible_user_ids: salespersonIds,
      enabled: true,
      sort_order: 3,
    },
    {
      name: "Technical consultation",
      duration_minutes: 45,
      min_notice_hours: 4,
      location_required: false,
      buffer_minutes: 15,
      working_hours_source: "COMPANY",
      eligible_user_ids: managerIds.length ? managerIds : allTeamIds,
      enabled: true,
      sort_order: 4,
    },
    {
      name: "Support visit",
      duration_minutes: 60,
      min_notice_hours: 4,
      location_required: true,
      buffer_minutes: 30,
      working_hours_source: "SUPPORT",
      eligible_user_ids: allTeamIds,
      enabled: true,
      sort_order: 5,
    },
  ];
  for (const row of appointments) {
    const existing = snapshot.appointmentTypes.find((t) => t.name === row.name);
    const item = existing
      ? await brainCollections.updateAppointment(clientId, existing.id, row)
      : await brainCollections.createAppointment(clientId, row);
    created.push({
      action: existing ? "updated" : "created",
      type: "appointment_type",
      id: item.id,
      name: item.name,
    });
  }

  const faqs = [
    {
      question: "Do you install solar?",
      aliases: ["Do you do installation", "Can you install it", "Do you fit solar systems"],
      approved_answer: "Yes. Adlense Solar supplies and installs residential and commercial solar systems.",
      category: "Company / Installation",
    },
    {
      question: "Where are you located?",
      aliases: ["Where are your offices", "Where are you based"],
      approved_answer: "Our main operations are in Harare, Zimbabwe.",
      category: "Company",
    },
    {
      question: "Do you install outside Harare?",
      aliases: ["Do you come to Mutare", "Do you work outside Harare", "Can you install in another city"],
      approved_answer:
        "Some projects can be completed outside Harare. Transport and logistics may affect the quotation, and some locations require confirmation from the team before we commit.",
      category: "Service area",
    },
    {
      question: "Can you give me a price?",
      aliases: ["How much is solar", "How much is a 5kVA system", "What's the price"],
      approved_answer:
        "Yes. The correct price depends on the equipment, battery capacity, solar panels, installation requirements and what you need the system to power. We first collect the main requirements and then use our current products or quotation system to provide the appropriate price.",
      category: "Pricing",
    },
    {
      question: "Do you provide site visits?",
      aliases: ["Can someone come see the house", "Do you do site assessments", "Can you assess my property"],
      approved_answer:
        "Yes. Site assessments can be arranged when the project requires technical evaluation before the final system is recommended.",
      category: "Installation",
    },
    {
      question: "Can you install tomorrow?",
      aliases: ["Can you install today", "How soon can you install"],
      approved_answer:
        "Installation timing depends on equipment availability, site readiness and the team's schedule. We can check the available assessment or installation process for your project before confirming a date.",
      category: "Installation",
    },
    {
      question: "Do your products have warranties?",
      aliases: ["Is there a warranty", "What's the battery warranty", "What's the inverter warranty"],
      approved_answer:
        "Yes. Warranty periods depend on the specific panels, inverter, battery and other equipment supplied. The applicable warranty will be shown on the quotation or confirmed from the product information.",
      category: "Warranty",
    },
    {
      question: "Do you have payment plans?",
      aliases: ["Can I pay monthly", "Can I pay in instalments", "Do you offer finance"],
      approved_answer:
        "We do not currently offer a standard customer credit or payment-plan facility. The payment terms applicable to the project will be shown on the quotation. Non-standard terms require approval.",
      category: "Payment",
    },
    {
      question: "Can I pay after installation?",
      aliases: ["Can I pay when you're done", "Can I pay balance after installation"],
      approved_answer:
        "Projects use the payment terms shown on the quotation. If you need different terms, we can submit the request to the team for review.",
      category: "Payment",
    },
    {
      question: "Can you upgrade my existing solar system?",
      aliases: ["Can I add batteries", "Can I add more panels", "Can I upgrade my inverter"],
      approved_answer:
        "Yes. We can assess upgrades such as additional batteries, panels or inverter changes. We first need details of the existing equipment so that compatibility can be checked.",
      category: "Product / Upgrade",
    },
    {
      question: "Can you install batteries only?",
      aliases: ["I only need another battery", "Can you add battery backup"],
      approved_answer: "Yes, subject to compatibility with the existing inverter, batteries and electrical system.",
      category: "Upgrade",
    },
    {
      question: "Do you repair solar systems?",
      aliases: ["Can you fix my solar", "My inverter isn't working", "Do you repair inverters"],
      approved_answer:
        "We provide solar assessment, maintenance and support services. We can collect information about the system and route the request to the support team.",
      category: "Support",
    },
    {
      question: "How long does installation take?",
      aliases: ["How many days does solar installation take", "How long will you be at the house"],
      approved_answer:
        "Installation time depends on the system size, site conditions and project scope. The team will confirm the expected duration for the specific project before installation.",
      category: "Installation",
    },
    {
      question: "Can solar run my whole house?",
      aliases: ["Can it power everything", "Will everything work on solar"],
      approved_answer:
        "That depends on the system size, battery capacity and the appliances you want to run. We first need to understand the home's load before confirming what the system can support.",
      category: "Technical",
    },
    {
      question: "Will I still have power when ZESA goes off?",
      aliases: ["Does solar work during load shedding", "Will I have backup"],
      approved_answer:
        "A properly configured system with battery storage can provide backup when grid power is unavailable. The actual backup duration depends on the battery capacity and the appliances being used.",
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
      customer_message: "How much is a 5kVA system?",
      preferred_response:
        "I'd be happy to help. The right price depends on the battery capacity, panels and what you'd like the system to power. Is this for a home or business, and which area are you located in?",
      why_preferred: "It begins qualification instead of inventing a price.",
      category: "NEW_ENQUIRY",
    },
    {
      situation: "Customer provides budget",
      customer_message: "I have about $5,000.",
      preferred_response:
        "Thanks, that helps. Let me understand what you'd like the system to power so we can match the requirement to the appropriate solution.",
      why_preferred: null,
      category: "NEW_ENQUIRY",
    },
    {
      situation: "Quotation requested before enough information exists",
      customer_message: "Just send me a quotation.",
      preferred_response:
        "I can help get the quotation prepared. I first need a few details about what you'd like the system to power so that we don't quote the wrong configuration.",
      why_preferred: null,
      category: "QUOTATION_REQUEST",
    },
    {
      situation: "Discount request",
      customer_message: "Can you give me 10% off?",
      preferred_response: "I can ask the team to review the quotation and see what commercial flexibility is available.",
      why_preferred: "Does not promise an unauthorized discount.",
      category: "DISCOUNT_REQUEST",
    },
    {
      situation: "Appointment request",
      customer_message: "Can someone come Thursday at 10?",
      preferred_response:
        "Certainly. I'll check the team's site-assessment availability for Thursday at 10:00. After the calendar confirms the booking: Thursday at 10:00 is confirmed. The site assessment has been scheduled with the team.",
      why_preferred: "Must not confirm the appointment until the calendar tool succeeds.",
      category: "APPOINTMENT_REQUEST",
    },
    {
      situation: "Human handoff",
      customer_message: "I want to speak to a person.",
      preferred_response: "Of course. I'll bring a member of our team into the conversation.",
      why_preferred: null,
      category: "HUMAN_HANDOFF",
    },
    {
      situation: "Customer wants later follow-up",
      customer_message: "I'm waiting for payday. Contact me next Friday.",
      preferred_response: "No problem. I've noted a follow-up for next Friday and the team will contact you then.",
      why_preferred: "Use only after the follow-up task is created.",
      category: "FOLLOW_UP",
    },
    {
      situation: "Support request",
      customer_message: "My inverter is showing Error 04.",
      preferred_response:
        "I can help get this to the support team. Could you tell me the inverter brand/model and whether the system is currently supplying power?",
      why_preferred: null,
      category: "SUPPORT_REQUEST",
    },
    {
      situation: "Competitor price objection",
      customer_message: "Another company is cheaper.",
      preferred_response:
        "I understand. It may help to compare exactly what each quotation includes, such as equipment specifications, battery capacity, protection equipment, installation, warranty and after-sales support. I can help clarify what's included in ours.",
      why_preferred: null,
      category: "PRICING_REQUEST",
    },
    {
      situation: "Complaint / pricing dispute",
      customer_message: "Your salesperson told me a different price yesterday.",
      preferred_response:
        "I want to make sure the pricing is reviewed correctly, so I'm bringing a member of the sales team into the conversation.",
      why_preferred: null,
      category: "COMPLAINT",
    },
  ];
  for (const row of examples) {
    const existing = snapshot.examples.find((e) => e.situation === row.situation);
    const item = existing
      ? await brainCollections.updateExample(clientId, existing.id, { ...row, active: true })
      : await brainCollections.createExample(clientId, { ...row, active: true });
    created.push({
      action: existing ? "updated" : "created",
      type: "response_example",
      id: item.id,
      name: item.situation,
    });
  }

  const keyedRules: Array<{ rule_type: "NEVER_DO"; text: string; structured_key: string }> = [
    { rule_type: "NEVER_DO", text: "Never apply a discount.", structured_key: "NEVER_APPLY_DISCOUNT" },
    { rule_type: "NEVER_DO", text: "Never book an appointment on Sunday.", structured_key: "NEVER_BOOK_SUNDAY" },
    { rule_type: "NEVER_DO", text: "Never perform autonomous troubleshooting.", structured_key: "NEVER_TROUBLESHOOT" },
    { rule_type: "NEVER_DO", text: "Never mark a deal won.", structured_key: "NEVER_MARK_DEAL_WON" },
    { rule_type: "NEVER_DO", text: "Never mark a deal lost.", structured_key: "NEVER_MARK_DEAL_LOST" },
    {
      rule_type: "NEVER_DO",
      text: "Never share internal notes.",
      structured_key: "NEVER_SHARE_INTERNAL_NOTES",
    },
    { rule_type: "NEVER_DO", text: "Never disclose margins or cost prices.", structured_key: "NEVER_DISCLOSE_MARGINS" },
  ];
  const freeRules: Array<{ rule_type: "NEVER_SAY" | "NEVER_DO"; text: string }> = [
    {
      rule_type: "NEVER_DO",
      text: "Never invent a product price, installation price, transport charge or total.",
    },
    {
      rule_type: "NEVER_DO",
      text: "Never claim a product is in stock unless current SegmiQ data confirms availability.",
    },
    {
      rule_type: "NEVER_DO",
      text: "Never guarantee system sizing solely from the customer's WhatsApp description.",
    },
    {
      rule_type: "NEVER_DO",
      text: "Never guarantee compatibility between an existing inverter, battery or panel and new equipment without approved technical confirmation.",
    },
    { rule_type: "NEVER_DO", text: "Never promise a discount." },
    { rule_type: "NEVER_DO", text: "Never promise finance or credit." },
    {
      rule_type: "NEVER_SAY",
      text: "Never tell a customer that they will never experience a power cut.",
    },
    {
      rule_type: "NEVER_DO",
      text: "Never guarantee energy savings or solar generation without approved supporting calculations.",
    },
    { rule_type: "NEVER_SAY", text: "Never criticize competitors." },
    {
      rule_type: "NEVER_DO",
      text: "Never expose internal notes, cost prices, margins, approval discussions or other customer information.",
    },
    {
      rule_type: "NEVER_DO",
      text: "Never give instructions that require a customer to open, dismantle or work on energized electrical equipment.",
    },
    {
      rule_type: "NEVER_DO",
      text: "Never confirm an appointment until the SegmiQ calendar tool confirms that it was created.",
    },
    {
      rule_type: "NEVER_DO",
      text: "Never tell a customer a quotation was sent until the send action succeeds.",
    },
    {
      rule_type: "NEVER_DO",
      text: "Never send a quotation if Commercial Check is blocked.",
    },
    {
      rule_type: "NEVER_DO",
      text: "Never send a quotation that still requires commercial approval.",
    },
    {
      rule_type: "NEVER_DO",
      text: "If there is not enough information to answer a company-specific or technical question safely, ask the team rather than guessing.",
    },
  ];
  for (const row of keyedRules) {
    const existing = snapshot.rules.find((r) => r.structuredKey === row.structured_key);
    const item = existing
      ? await brainCollections.updateRule(clientId, existing.id, { ...row, enabled: true })
      : await brainCollections.createRule(clientId, { ...row, enabled: true });
    created.push({
      action: existing ? "updated" : "created",
      type: "agent_rule",
      id: item.id,
      name: row.structured_key,
    });
  }
  for (const row of freeRules) {
    const existing = snapshot.rules.find((r) => r.text === row.text);
    const item = existing
      ? await brainCollections.updateRule(clientId, existing.id, { ...row, structured_key: null, enabled: true })
      : await brainCollections.createRule(clientId, { ...row, structured_key: null, enabled: true });
    created.push({
      action: existing ? "updated" : "created",
      type: "agent_rule",
      id: item.id,
      name: row.text.slice(0, 80),
    });
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
      customer_message: "I can ask the team to review the quotation and see what commercial flexibility is available.",
    },
    {
      name: "Technical safety issue",
      condition_key: "TECHNICAL_SAFETY",
      destination_type: "SUPPORT_QUEUE",
      priority: "URGENT",
      customer_message:
        "Please avoid touching or opening the equipment. I'm escalating this to the technical team immediately.",
      condition_config: {
        examples: [
          "Smoke",
          "Burning smell",
          "Fire",
          "Sparking",
          "Swollen battery",
          "Exposed electrical wiring",
          "Electrical shock",
          "Overheating equipment",
        ],
      },
    },
    {
      name: "Legal threat",
      condition_key: "LEGAL_THREAT",
      destination_type: "ADMIN",
      priority: "URGENT",
      customer_message: "I want to make sure this is handled by the appropriate person. I'm escalating the matter to management.",
    },
    {
      name: "Contract change",
      condition_key: "CONTRACT_CHANGE",
      destination_type: "SALES_MANAGER",
      priority: "HIGH",
      customer_message: "I'll ask the team to review the requested change before anything is confirmed.",
    },
    {
      name: "High-value quotation",
      condition_key: "QUOTATION_ABOVE",
      destination_type: "SALES_MANAGER",
      priority: "NORMAL",
      customer_message: "I'm preparing the quotation for the team to review before it is sent.",
      condition_config: { amount: quoteCap, currency: "USD" },
    },
    {
      name: "Commercial solar project",
      condition_key: "HIGH_VALUE_DEAL",
      destination_type: "SALES_MANAGER",
      priority: "NORMAL",
      customer_message:
        "Thanks. I'll have the commercial team review the project requirements so we can take the correct next step.",
    },
    {
      name: "Unsupported technical question",
      condition_key: "UNSUPPORTED_REQUEST",
      destination_type: "SUPPORT_QUEUE",
      priority: "NORMAL",
      customer_message:
        "I don't want to give you incorrect technical information. I'll ask the technical team to confirm that for you.",
    },
  ];
  for (const row of escalations) {
    const existing = snapshot.escalationRules.find((r) => r.name === row.name);
    const item = existing
      ? await brainCollections.updateEscalation(clientId, existing.id, { ...row, enabled: true })
      : await brainCollections.createEscalation(clientId, { ...row, enabled: true });
    created.push({
      action: existing ? "updated" : "created",
      type: "escalation_rule",
      id: item.id,
      name: item.name,
    });
  }

  const documents = [
    {
      title: "Adlense Solar Company Profile 2026",
      category: "COMPANY",
      effective_date: "2026-08-01",
      content_text:
        "Adlense Solar is a solar energy solutions company serving residential and commercial customers in Zimbabwe. The company supplies and installs solar panels, hybrid inverters, lithium batteries, protection equipment, mounting equipment and related solar components. Services include residential installations, commercial installations, system upgrades, battery replacements, site assessments, maintenance and after-sales support. The company's primary operating area is Harare, with selected projects completed in other parts of Zimbabwe subject to logistics confirmation.",
    },
    {
      title: "Residential Solar Installation Process",
      category: "INSTALLATION",
      effective_date: "2026-08-01",
      content_text:
        "Residential solar projects normally begin with customer qualification. The sales team establishes the installation location, customer requirements, appliances/load, budget and installation timeline. A site assessment may be required where technical information cannot be confirmed remotely. After the system configuration is confirmed, a quotation is prepared in SegmiQ. The customer reviews the quotation and any requested commercial changes are handled through the company's approval process. Installation proceeds only after the company has completed the required commercial and project confirmation.",
    },
    {
      title: "Solar Warranty Guidance 2026",
      category: "WARRANTY",
      effective_date: "2026-08-01",
      content_text:
        "Warranty periods depend on the specific product supplied. The applicable product warranty should be taken from the current SegmiQ Product record or the customer's quotation. The Agent must not assume one warranty period applies to every inverter, battery or panel. Workmanship or installation warranty should use the company's current approved warranty policy. Unauthorized alterations, misuse, physical damage and third-party modifications may affect warranty coverage according to the applicable terms.",
    },
    {
      title: "Solar Support Intake Guide",
      category: "SUPPORT",
      effective_date: "2026-08-01",
      content_text:
        "When a customer reports a solar-system problem, identify the customer and related project where possible. Collect the installation location, approximate installation date, inverter brand and model, battery details where relevant, error code, description of the problem, when the problem began and whether the system is currently supplying power. Ask for a photograph or screenshot only when useful. If there is smoke, fire, sparking, battery swelling, exposed wiring or another immediate electrical safety concern, instruct the customer not to touch or open the equipment and escalate to the technical team. The Agent must not independently provide electrical repair instructions.",
    },
    {
      title: "Solar Pricing and Quotation Guidance",
      category: "PRICING",
      effective_date: "2026-08-01",
      content_text:
        "Product and service prices must come from the current SegmiQ catalogue, approved Packages or an existing quotation. The Agent must not create an estimated price where no current price exists. Custom installations may require technical assessment before final pricing. Every customer-facing commercial offer must use the SegmiQ quotation system and pass the applicable Commercial Check. Discounts and non-standard payment terms require the appropriate company approval. The Agent must not disclose internal cost or margin information.",
    },
    {
      title: "Adlense Solar Service Area Guidance",
      category: "SERVICE_AREA",
      effective_date: "2026-08-01",
      content_text:
        "Harare and Chitungwiza are primary service areas. Ruwa, Norton and Marondera are extended areas where project logistics or transport may affect pricing. Mutare, Bulawayo and other locations outside normal operating areas require confirmation before the Agent promises installation or books a site visit. Where confirmation is required, the Agent should create the appropriate human escalation rather than refusing the customer automatically.",
    },
  ];
  for (const row of documents) {
    const existing = snapshot.knowledgeDocuments.find((d) => d.title === row.title);
    let doc = existing
      ? await brainCollections.updateKnowledge(clientId, existing.id, {
          category: row.category,
          content_text: row.content_text,
          effective_date: row.effective_date,
          status: "DRAFT",
        })
      : await brainCollections.createKnowledge(clientId, {
          title: row.title,
          category: row.category,
          content_text: row.content_text,
          effective_date: row.effective_date,
          status: "DRAFT",
          uploaded_by_id: actorId,
        });
    await replaceKnowledgeChunks({
      clientId,
      documentId: doc.id,
      category: row.category,
      content: row.content_text,
    });
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
    created.push({
      action: existing ? "updated" : "created",
      type: "knowledge_document",
      id: doc.id,
      name: `${doc.title} (${doc.status})`,
    });
  }

  const agentPatch: Parameters<typeof updateAgentCompanySettings>[1] = {
    enabled: true,
    autonomyMode: "COPILOT",
    respondToEnquiries: true,
    qualifyLeads: true,
    createLeads: true,
    createDeals: true,
    createTasks: true,
    scheduleCallbacks: true,
    scheduleAppointments: true,
    prepareQuotations: true,
    sendQuotations: false,
    sendFollowUps: true,
    transferSupport: true,
    createSupportCases: true,
    negotiateDiscounts: false,
  };
  if (canonical.quoteAutoSendLimit == null) {
    agentPatch.quoteAutoSendLimit = 5000;
  }

  const refreshed = await loadCompanyBrainSnapshot(clientId);
  const quoteBlockers = quotationAutomationBlockers(refreshed);
  try {
    if (!quoteBlockers.length) {
      agentPatch.autonomyMode = "AUTOPILOT";
      agentPatch.sendQuotations = true;
    } else {
      mismatches.push({
        field: "Demo Agent autonomy → Send commercially safe standard quotations",
        value: "ON",
        reason: `Left sendQuotations OFF / COPILOT because quotation readiness is incomplete: ${quoteBlockers.join(", ")}.`,
      });
    }
    const agent = await updateAgentCompanySettings(clientId, agentPatch);
    created.push({
      action: "updated",
      type: "agent_company_settings",
      id: clientId,
      name: `${agent.autonomyMode} sendQuotations=${agent.sendQuotations}`,
    });
  } catch (err) {
    mismatches.push({
      field: "Demo Agent autonomy",
      value: "Respond/qualify/create/schedule/quote settings",
      reason: err instanceof Error ? err.message : String(err),
    });
  }

  console.log("\n=== Created / updated records ===");
  for (const row of created) {
    console.log(`${row.action.padEnd(7)}  ${row.type.padEnd(24)}  ${row.id}  ${row.name}`);
  }
  console.log(`\nTotal: ${created.length}`);
  console.log("\n=== Fields that could not be mapped 1:1 ===");
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
