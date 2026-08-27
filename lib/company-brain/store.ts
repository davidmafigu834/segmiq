import { createAdminClient } from "@/lib/supabase/admin";
import { asRow, asRows } from "@/lib/agent/rows";
import { loadQualificationFlow } from "@/lib/whatsapp/load-qualification-flow";
import { defaultOperatingHours, resolveOperatingHours } from "@/lib/sales/intelligence/operating-hours";
import { resolveClientSalesTimezone } from "@/lib/sales/intelligence/daily-plan-service";
import { invalidateBrainCache } from "./cache";
import { chunkText } from "./chunks";
import {
  BRAIN_SETTINGS_DEFAULTS,
  type AgentRule,
  type AppointmentType,
  type BrainFaq,
  type CanonicalSignals,
  type CompanyBrainSettings,
  type CompanyBrainSnapshot,
  type EscalationRule,
  type ExampleCategory,
  type IdealCustomer,
  type KnowledgeChunk,
  type KnowledgeDocument,
  type PlaybookField,
  type QualificationPlaybook,
  type ResponseExample,
  type ServiceArea,
  type StageGuidance,
} from "./types";

type Row = Record<string, unknown>;

function str(row: Row, key: string): string | null {
  const v = row[key];
  return typeof v === "string" && v.trim() ? v : null;
}

function strArr(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  return [];
}

function settingsFromRow(clientId: string, row: Row | null): CompanyBrainSettings {
  const d = BRAIN_SETTINGS_DEFAULTS;
  if (!row) return { clientId, ...d };
  return {
    clientId,
    tradingName: str(row, "trading_name"),
    businessKind: (row.business_kind as CompanyBrainSettings["businessKind"]) ?? null,
    customerModel: (row.customer_model as CompanyBrainSettings["customerModel"]) ?? null,
    agentBusinessExplanation: str(row, "agent_business_explanation"),
    languages: strArr(row.languages).length ? strArr(row.languages) : d.languages,
    primaryOffering: str(row, "primary_offering"),
    catalogueCustomerType: str(row, "catalogue_customer_type"),
    typicalOrderType: str(row, "typical_order_type"),
    weDoNotNormallySell: str(row, "we_do_not_normally_sell"),
    specialSellingConditions: str(row, "special_selling_conditions"),
    pricingGuidance: str(row, "pricing_guidance"),
    neverEstimatePrices: row.never_estimate_prices !== false,
    creditOffered: Boolean(row.credit_offered),
    paymentPlansOffered: Boolean(row.payment_plans_offered),
    nonstandardTermsRequireApproval: row.nonstandard_terms_require_approval !== false,
    paymentGuidance: str(row, "payment_guidance"),
    supportOffered: Boolean(row.support_offered),
    supportHoursNote: str(row, "support_hours_note"),
    supportDestinationType: str(row, "support_destination_type"),
    supportDestinationId: str(row, "support_destination_id"),
    supportCategories: strArr(row.support_categories),
    supportIntakeFields: Array.isArray(row.support_intake_fields)
      ? (row.support_intake_fields as CompanyBrainSettings["supportIntakeFields"])
      : [],
    autonomousTroubleshooting: Boolean(row.autonomous_troubleshooting),
    warrantyBoundaries: str(row, "warranty_boundaries"),
    voicePrimary: (row.voice_primary as CompanyBrainSettings["voicePrimary"]) ?? d.voicePrimary,
    voiceSecondary: (row.voice_secondary as CompanyBrainSettings["voiceSecondary"]) ?? null,
    responseLength: (row.response_length as CompanyBrainSettings["responseLength"]) ?? d.responseLength,
    emojiPolicy: (row.emoji_policy as CompanyBrainSettings["emojiPolicy"]) ?? d.emojiPolicy,
    greetingStyle: str(row, "greeting_style"),
    preferredTerms: Array.isArray(row.preferred_terms)
      ? (row.preferred_terms as CompanyBrainSettings["preferredTerms"])
      : [],
    claimsToAvoid: strArr(row.claims_to_avoid),
    quoteFollowUpBusinessDays: Number(row.quote_follow_up_business_days) || d.quoteFollowUpBusinessDays,
    secondFollowUpBusinessDays: Number(row.second_follow_up_business_days) || d.secondFollowUpBusinessDays,
    maxAutonomousFollowUps: Number(row.max_autonomous_follow_ups) || d.maxAutonomousFollowUps,
    defaultEscalationMessage: str(row, "default_escalation_message"),
    createdAt: str(row, "created_at"),
    updatedAt: str(row, "updated_at"),
  };
}

const SETTINGS_COLUMNS: Record<string, string> = {
  tradingName: "trading_name",
  businessKind: "business_kind",
  customerModel: "customer_model",
  agentBusinessExplanation: "agent_business_explanation",
  languages: "languages",
  primaryOffering: "primary_offering",
  catalogueCustomerType: "catalogue_customer_type",
  typicalOrderType: "typical_order_type",
  weDoNotNormallySell: "we_do_not_normally_sell",
  specialSellingConditions: "special_selling_conditions",
  pricingGuidance: "pricing_guidance",
  neverEstimatePrices: "never_estimate_prices",
  creditOffered: "credit_offered",
  paymentPlansOffered: "payment_plans_offered",
  nonstandardTermsRequireApproval: "nonstandard_terms_require_approval",
  paymentGuidance: "payment_guidance",
  supportOffered: "support_offered",
  supportHoursNote: "support_hours_note",
  supportDestinationType: "support_destination_type",
  supportDestinationId: "support_destination_id",
  supportCategories: "support_categories",
  supportIntakeFields: "support_intake_fields",
  autonomousTroubleshooting: "autonomous_troubleshooting",
  warrantyBoundaries: "warranty_boundaries",
  voicePrimary: "voice_primary",
  voiceSecondary: "voice_secondary",
  responseLength: "response_length",
  emojiPolicy: "emoji_policy",
  greetingStyle: "greeting_style",
  preferredTerms: "preferred_terms",
  claimsToAvoid: "claims_to_avoid",
  quoteFollowUpBusinessDays: "quote_follow_up_business_days",
  secondFollowUpBusinessDays: "second_follow_up_business_days",
  maxAutonomousFollowUps: "max_autonomous_follow_ups",
  defaultEscalationMessage: "default_escalation_message",
};

export type BrainSettingsPatch = Partial<Omit<CompanyBrainSettings, "clientId" | "createdAt" | "updatedAt">>;

function parsePlaybook(row: Row): QualificationPlaybook {
  const fields = Array.isArray(row.fields) ? (row.fields as PlaybookField[]) : [];
  const trigger = (row.trigger_conditions && typeof row.trigger_conditions === "object"
    ? row.trigger_conditions
    : {}) as QualificationPlaybook["trigger"];
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    name: String(row.name ?? ""),
    description: str(row, "description"),
    appliesTo: str(row, "applies_to"),
    trigger,
    fields,
    completion: (row.completion_criteria as QualificationPlaybook["completion"]) ?? {},
    dealReadiness: (row.deal_readiness_rules as Record<string, unknown>) ?? {},
    enabled: row.enabled !== false,
    sortOrder: Number(row.sort_order) || 0,
    updatedAt: String(row.updated_at ?? ""),
  };
}

function parseCustomer(row: Row): IdealCustomer {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: str(row, "description"),
    typicalRequirements: str(row, "typical_requirements"),
    minProjectSize: str(row, "min_project_size"),
    typicalDecisionMaker: str(row, "typical_decision_maker"),
    primaryInterest: str(row, "primary_interest"),
    geographicRequirements: str(row, "geographic_requirements"),
    goodFitIndicators: str(row, "good_fit_indicators"),
    poorFitIndicators: str(row, "poor_fit_indicators"),
    disqualifyingConditions: str(row, "disqualifying_conditions"),
    sortOrder: Number(row.sort_order) || 0,
    active: row.active !== false,
  };
}

function parseArea(row: Row): ServiceArea {
  return {
    id: String(row.id),
    label: str(row, "label"),
    country: str(row, "country"),
    province: str(row, "province"),
    city: str(row, "city"),
    region: str(row, "region"),
    radiusKm: row.radius_km == null ? null : Number(row.radius_km),
    serviceCategory: str(row, "service_category"),
    status: (row.status as ServiceArea["status"]) ?? "PRIMARY",
    travelChargeApplies: Boolean(row.travel_charge_applies),
    travelChargeNote: str(row, "travel_charge_note"),
    minOrder: str(row, "min_order"),
    managerConfirmationRequired: Boolean(row.manager_confirmation_required),
    assignedNote: str(row, "assigned_note"),
    active: row.active !== false,
  };
}

function parseAppointment(row: Row): AppointmentType {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    durationMinutes: Number(row.duration_minutes) || 60,
    eligibleUserIds: strArr(row.eligible_user_ids),
    workingHoursSource: (row.working_hours_source as AppointmentType["workingHoursSource"]) ?? "COMPANY",
    customWorkingDays: Array.isArray(row.custom_working_days)
      ? (row.custom_working_days as number[])
      : null,
    customStartTime: str(row, "custom_start_time"),
    customEndTime: str(row, "custom_end_time"),
    minNoticeHours: Number(row.min_notice_hours) || 0,
    locationRequired: Boolean(row.location_required),
    bufferMinutes: Number(row.buffer_minutes) || 0,
    enabled: row.enabled !== false,
    sortOrder: Number(row.sort_order) || 0,
  };
}

function parseFaq(row: Row): BrainFaq {
  return {
    id: String(row.id),
    question: String(row.question ?? ""),
    approvedAnswer: String(row.approved_answer ?? ""),
    aliases: strArr(row.aliases),
    category: str(row, "category"),
    active: row.active !== false,
    productIds: strArr(row.product_ids),
    lastReviewedAt: str(row, "last_reviewed_at"),
    reviewerId: str(row, "reviewer_id"),
    version: Number(row.version) || 1,
    updatedAt: String(row.updated_at ?? ""),
  };
}

function parseExample(row: Row): ResponseExample {
  return {
    id: String(row.id),
    situation: String(row.situation ?? ""),
    customerMessage: String(row.customer_message ?? ""),
    preferredResponse: String(row.preferred_response ?? ""),
    whyPreferred: str(row, "why_preferred"),
    category: (row.category as ExampleCategory) ?? "NEW_ENQUIRY",
    active: row.active !== false,
  };
}

function parseRule(row: Row): AgentRule {
  return {
    id: String(row.id),
    ruleType: row.rule_type === "NEVER_DO" ? "NEVER_DO" : "NEVER_SAY",
    text: String(row.text ?? ""),
    structuredKey: (row.structured_key as AgentRule["structuredKey"]) ?? null,
    enabled: row.enabled !== false,
  };
}

function parseEscalation(row: Row): EscalationRule {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    conditionKey: String(row.condition_key ?? ""),
    conditionConfig: (row.condition_config as Record<string, unknown>) ?? {},
    destinationType: (row.destination_type as EscalationRule["destinationType"]) ?? "OWNER",
    destinationId: str(row, "destination_id"),
    priority: (row.priority as EscalationRule["priority"]) ?? "NORMAL",
    customerMessage: str(row, "customer_message"),
    enabled: row.enabled !== false,
  };
}

function parseStage(row: Row): StageGuidance {
  return {
    id: String(row.id),
    stage: String(row.stage ?? ""),
    guidance: str(row, "guidance"),
    preconditions: Array.isArray(row.preconditions)
      ? (row.preconditions as StageGuidance["preconditions"])
      : [],
  };
}

function parseDocument(row: Row): KnowledgeDocument {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    category: (row.category as KnowledgeDocument["category"]) ?? "COMPANY",
    description: str(row, "description"),
    storageKey: str(row, "storage_key"),
    contentText: str(row, "content_text"),
    status: (row.status as KnowledgeDocument["status"]) ?? "DRAFT",
    version: Number(row.version) || 1,
    uploadedById: str(row, "uploaded_by_id"),
    lastReviewedAt: str(row, "last_reviewed_at"),
    effectiveDate: str(row, "effective_date"),
    expiresAt: str(row, "expires_at"),
    approvedById: str(row, "approved_by_id"),
    approvedAt: str(row, "approved_at"),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

async function loadCanonical(clientId: string): Promise<CanonicalSignals> {
  const supabase = createAdminClient();
  const hoursFallback = defaultOperatingHours();
  const [
    clientRes,
    quoteRes,
    productsRes,
    servicesRes,
    packagesRes,
    templatesRes,
    hoursRes,
    usersRes,
    timezone,
    qualification,
    agentRes,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("name, industry, website, country, owner_email, dial_code")
      .eq("id", clientId)
      .maybeSingle(),
    supabase
      .from("quotation_settings")
      .select(
        "company_phone, company_email, company_address, default_payment_terms, default_currency, allow_quotation_discount, price_edit_policy"
      )
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "ACTIVE")
      .eq("item_type", "PRODUCT"),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "ACTIVE")
      .eq("item_type", "SERVICE"),
    supabase
      .from("commercial_packages")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "ACTIVE"),
    supabase
      .from("quote_templates")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId),
    supabase
      .from("sales_execution_settings")
      .select("working_days, work_start_time, work_end_time")
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId),
    resolveClientSalesTimezone(clientId).catch(() => "Africa/Harare"),
    loadQualificationFlow(clientId).catch(() => null),
    supabase
      .from("agent_company_settings")
      .select("autonomy_mode, quote_auto_send_limit")
      .eq("client_id", clientId)
      .maybeSingle(),
  ]);

  const client = asRow<Row>(clientRes.data);
  const quote = asRow<Row>(quoteRes.data);
  const hoursRow = asRow<Row>(hoursRes.data);
  const hours = resolveOperatingHours(
    hoursRow
      ? {
          workingDays: Array.isArray(hoursRow.working_days) ? (hoursRow.working_days as number[]) : null,
          workStartTime: (hoursRow.work_start_time as string | null) ?? null,
          workEndTime: (hoursRow.work_end_time as string | null) ?? null,
        }
      : null
  );

  return {
    companyName: (client?.name as string) ?? "Company",
    industry: (client?.industry as string | null) ?? null,
    timezone,
    website: (client?.website as string | null) ?? null,
    phone: (quote?.company_phone as string | null) ?? null,
    email: (quote?.company_email as string | null) ?? (client?.owner_email as string | null) ?? null,
    address: (quote?.company_address as string | null) ?? null,
    country: (client?.country as string | null) ?? null,
    productCount: productsRes.count ?? 0,
    serviceCount: servicesRes.count ?? 0,
    packageCount: packagesRes.count ?? 0,
    quoteTemplateCount: templatesRes.count ?? 0,
    currency: (quote?.default_currency as string | null) ?? "USD",
    paymentTerms: (quote?.default_payment_terms as string | null) ?? null,
    allowQuotationDiscount:
      quote && typeof quote.allow_quotation_discount === "boolean"
        ? quote.allow_quotation_discount
        : null,
    priceEditPolicy: (quote?.price_edit_policy as string | null) ?? null,
    hasOperatingHoursRow: Boolean(hoursRow),
    workingDays: hours.workingDays.length ? hours.workingDays : [...hoursFallback.workingDays],
    workStartTime: hours.workStartTime,
    workEndTime: hours.workEndTime,
    hasQualificationFlow: Boolean(qualification?.questions?.length),
    teamUserCount: usersRes.count ?? 0,
    agentAutonomyMode: (asRow<Row>(agentRes.data)?.autonomy_mode as string | null) ?? null,
    quoteAutoSendLimit:
      typeof asRow<Row>(agentRes.data)?.quote_auto_send_limit === "number"
        ? (asRow<Row>(agentRes.data)!.quote_auto_send_limit as number)
        : null,
  };
}

export async function loadCompanyBrainSnapshot(clientId: string): Promise<CompanyBrainSnapshot> {
  const supabase = createAdminClient();
  const [
    settingsRes,
    customersRes,
    playbooksRes,
    stagesRes,
    areasRes,
    appointmentsRes,
    faqsRes,
    examplesRes,
    rulesRes,
    escalationRes,
    knowledgeRes,
    canonical,
  ] = await Promise.all([
    supabase.from("company_brain_settings").select("*").eq("client_id", clientId).maybeSingle(),
    supabase
      .from("company_brain_ideal_customers")
      .select("*")
      .eq("client_id", clientId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("company_brain_playbooks")
      .select("*")
      .eq("client_id", clientId)
      .order("sort_order", { ascending: true }),
    supabase.from("company_brain_stage_guidance").select("*").eq("client_id", clientId),
    supabase
      .from("company_brain_service_areas")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true }),
    supabase
      .from("company_brain_appointment_types")
      .select("*")
      .eq("client_id", clientId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("company_brain_faqs")
      .select("*")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("company_brain_response_examples")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase.from("company_brain_rules").select("*").eq("client_id", clientId),
    supabase.from("company_brain_escalation_rules").select("*").eq("client_id", clientId),
    supabase
      .from("company_brain_knowledge_documents")
      .select("*")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false }),
    loadCanonical(clientId),
  ]);

  const settingsRow = asRow<Row>(settingsRes.data);
  return {
    settings: settingsFromRow(clientId, settingsRow),
    exists: Boolean(settingsRow),
    idealCustomers: asRows<Row>(customersRes.data).map(parseCustomer),
    playbooks: asRows<Row>(playbooksRes.data).map(parsePlaybook),
    stageGuidance: asRows<Row>(stagesRes.data).map(parseStage),
    serviceAreas: asRows<Row>(areasRes.data).map(parseArea),
    appointmentTypes: asRows<Row>(appointmentsRes.data).map(parseAppointment),
    faqs: asRows<Row>(faqsRes.data).map(parseFaq),
    examples: asRows<Row>(examplesRes.data).map(parseExample),
    rules: asRows<Row>(rulesRes.data).map(parseRule),
    escalationRules: asRows<Row>(escalationRes.data).map(parseEscalation),
    knowledgeDocuments: asRows<Row>(knowledgeRes.data).map(parseDocument),
    canonical,
  };
}

export async function upsertBrainSettings(
  clientId: string,
  patch: BrainSettingsPatch
): Promise<CompanyBrainSettings> {
  const supabase = createAdminClient();
  const update: Record<string, unknown> = { client_id: clientId, updated_at: new Date().toISOString() };
  for (const [key, column] of Object.entries(SETTINGS_COLUMNS)) {
    if ((patch as Record<string, unknown>)[key] !== undefined) {
      update[column] = (patch as Record<string, unknown>)[key];
    }
  }
  const { data, error } = await supabase
    .from("company_brain_settings")
    .upsert(update, { onConflict: "client_id" })
    .select("*")
    .single();
  if (error) throw new Error(`Failed to save Company Brain: ${error.message}`);
  invalidateBrainCache(clientId);
  try {
    const { background } = await import("@/lib/background");
    background("learningBrainUpdated", async () => {
      const { flagLearnedKnowledgeAgainstBrain } = await import("@/lib/agent/learning/comparator");
      await flagLearnedKnowledgeAgainstBrain(clientId);
    });
  } catch {
    /* learning conflict check is best-effort */
  }
  return settingsFromRow(clientId, asRow<Row>(data));
}

async function scopedInsert(table: string, clientId: string, payload: Record<string, unknown>) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(table)
    .insert({ ...payload, client_id: clientId })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  invalidateBrainCache(clientId);
  return asRow<Row>(data)!;
}

async function scopedUpdate(
  table: string,
  clientId: string,
  id: string,
  payload: Record<string, unknown>
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(table)
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("client_id", clientId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Not found");
  invalidateBrainCache(clientId);
  return asRow<Row>(data)!;
}

async function scopedDelete(table: string, clientId: string, id: string) {
  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) throw new Error(error.message);
  if (!count) throw new Error("Not found");
  invalidateBrainCache(clientId);
}

export const brainCollections = {
  async createCustomer(clientId: string, payload: Record<string, unknown>) {
    return parseCustomer(await scopedInsert("company_brain_ideal_customers", clientId, payload));
  },
  async updateCustomer(clientId: string, id: string, payload: Record<string, unknown>) {
    return parseCustomer(await scopedUpdate("company_brain_ideal_customers", clientId, id, payload));
  },
  async deleteCustomer(clientId: string, id: string) {
    await scopedDelete("company_brain_ideal_customers", clientId, id);
  },
  async createPlaybook(clientId: string, payload: Record<string, unknown>) {
    return parsePlaybook(await scopedInsert("company_brain_playbooks", clientId, payload));
  },
  async updatePlaybook(clientId: string, id: string, payload: Record<string, unknown>) {
    return parsePlaybook(await scopedUpdate("company_brain_playbooks", clientId, id, payload));
  },
  async deletePlaybook(clientId: string, id: string) {
    await scopedDelete("company_brain_playbooks", clientId, id);
  },
  async deleteStage(clientId: string, id: string) {
    await scopedDelete("company_brain_stage_guidance", clientId, id);
  },
  async upsertStage(clientId: string, payload: Record<string, unknown>) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("company_brain_stage_guidance")
      .upsert(
        { ...payload, client_id: clientId, updated_at: new Date().toISOString() },
        { onConflict: "client_id,stage" }
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    invalidateBrainCache(clientId);
    return parseStage(asRow<Row>(data)!);
  },
  async createArea(clientId: string, payload: Record<string, unknown>) {
    return parseArea(await scopedInsert("company_brain_service_areas", clientId, payload));
  },
  async updateArea(clientId: string, id: string, payload: Record<string, unknown>) {
    return parseArea(await scopedUpdate("company_brain_service_areas", clientId, id, payload));
  },
  async deleteArea(clientId: string, id: string) {
    await scopedDelete("company_brain_service_areas", clientId, id);
  },
  async createAppointment(clientId: string, payload: Record<string, unknown>) {
    return parseAppointment(await scopedInsert("company_brain_appointment_types", clientId, payload));
  },
  async updateAppointment(clientId: string, id: string, payload: Record<string, unknown>) {
    return parseAppointment(await scopedUpdate("company_brain_appointment_types", clientId, id, payload));
  },
  async deleteAppointment(clientId: string, id: string) {
    await scopedDelete("company_brain_appointment_types", clientId, id);
  },
  async createFaq(clientId: string, payload: Record<string, unknown>) {
    return parseFaq(await scopedInsert("company_brain_faqs", clientId, payload));
  },
  async updateFaq(clientId: string, id: string, payload: Record<string, unknown>, actorId?: string | null) {
    const supabase = createAdminClient();
    const { data: current } = await supabase
      .from("company_brain_faqs")
      .select("*")
      .eq("id", id)
      .eq("client_id", clientId)
      .maybeSingle();
    if (current) {
      await supabase.from("company_brain_faq_versions").insert({
        faq_id: id,
        client_id: clientId,
        version: Number(current.version) || 1,
        question: current.question,
        approved_answer: current.approved_answer,
        aliases: current.aliases ?? [],
        changed_by_id: actorId ?? null,
      });
      payload.version = (Number(current.version) || 1) + 1;
    }
    return parseFaq(await scopedUpdate("company_brain_faqs", clientId, id, payload));
  },
  async deleteFaq(clientId: string, id: string) {
    await scopedDelete("company_brain_faqs", clientId, id);
  },
  async createExample(clientId: string, payload: Record<string, unknown>) {
    return parseExample(await scopedInsert("company_brain_response_examples", clientId, payload));
  },
  async updateExample(clientId: string, id: string, payload: Record<string, unknown>) {
    return parseExample(await scopedUpdate("company_brain_response_examples", clientId, id, payload));
  },
  async deleteExample(clientId: string, id: string) {
    await scopedDelete("company_brain_response_examples", clientId, id);
  },
  async createRule(clientId: string, payload: Record<string, unknown>) {
    return parseRule(await scopedInsert("company_brain_rules", clientId, payload));
  },
  async updateRule(clientId: string, id: string, payload: Record<string, unknown>) {
    return parseRule(await scopedUpdate("company_brain_rules", clientId, id, payload));
  },
  async deleteRule(clientId: string, id: string) {
    await scopedDelete("company_brain_rules", clientId, id);
  },
  async createEscalation(clientId: string, payload: Record<string, unknown>) {
    return parseEscalation(await scopedInsert("company_brain_escalation_rules", clientId, payload));
  },
  async updateEscalation(clientId: string, id: string, payload: Record<string, unknown>) {
    return parseEscalation(await scopedUpdate("company_brain_escalation_rules", clientId, id, payload));
  },
  async deleteEscalation(clientId: string, id: string) {
    await scopedDelete("company_brain_escalation_rules", clientId, id);
  },
  async createKnowledge(clientId: string, payload: Record<string, unknown>) {
    return parseDocument(await scopedInsert("company_brain_knowledge_documents", clientId, payload));
  },
  async updateKnowledge(clientId: string, id: string, payload: Record<string, unknown>) {
    return parseDocument(await scopedUpdate("company_brain_knowledge_documents", clientId, id, payload));
  },
  async deleteKnowledge(clientId: string, id: string) {
    await scopedDelete("company_brain_knowledge_documents", clientId, id);
  },
};

export async function replaceKnowledgeChunks(opts: {
  clientId: string;
  documentId: string;
  category: string;
  content: string;
}): Promise<number> {
  const supabase = createAdminClient();
  await supabase
    .from("company_brain_knowledge_chunks")
    .delete()
    .eq("document_id", opts.documentId)
    .eq("client_id", opts.clientId);
  const parts = chunkText(opts.content);
  if (!parts.length) return 0;
  const rows = parts.map((content, chunk_index) => ({
    document_id: opts.documentId,
    client_id: opts.clientId,
    chunk_index,
    content,
    category: opts.category,
  }));
  const { error } = await supabase.from("company_brain_knowledge_chunks").insert(rows);
  if (error) throw new Error(error.message);
  invalidateBrainCache(opts.clientId);
  return parts.length;
}

export async function loadApprovedChunks(
  clientId: string,
  documentIds: string[]
): Promise<KnowledgeChunk[]> {
  if (!documentIds.length) return [];
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("company_brain_knowledge_chunks")
    .select("id, document_id, chunk_index, content, page_ref, category")
    .eq("client_id", clientId)
    .in("document_id", documentIds)
    .order("chunk_index", { ascending: true })
    .limit(200);
  return asRows<Row>(data).map((row) => ({
    id: String(row.id),
    documentId: String(row.document_id),
    chunkIndex: Number(row.chunk_index) || 0,
    content: String(row.content ?? ""),
    pageRef: typeof row.page_ref === "string" ? row.page_ref : null,
    category: typeof row.category === "string" ? row.category : null,
  }));
}

export async function searchApprovedChunks(clientId: string, query: string, limit = 6): Promise<KnowledgeChunk[]> {
  const supabase = createAdminClient();
  const { data: approved } = await supabase
    .from("company_brain_knowledge_documents")
    .select("id, title, category")
    .eq("client_id", clientId)
    .eq("status", "APPROVED");
  const docs = asRows<Row>(approved);
  if (!docs.length) return [];
  const ids = docs.map((d) => String(d.id));
  const titleById = new Map(docs.map((d) => [String(d.id), String(d.title ?? "")]));
  const { data } = await supabase
    .from("company_brain_knowledge_chunks")
    .select("id, document_id, chunk_index, content, page_ref, category")
    .eq("client_id", clientId)
    .in("document_id", ids)
    .textSearch("search_vector", query.split(/\s+/).filter(Boolean).slice(0, 8).join(" & "), {
      type: "plain",
      config: "simple",
    })
    .limit(limit);
  const rows = asRows<Row>(data);
  if (rows.length) {
    return rows.map((row) => ({
      id: String(row.id),
      documentId: String(row.document_id),
      chunkIndex: Number(row.chunk_index) || 0,
      content: String(row.content ?? ""),
      pageRef: typeof row.page_ref === "string" ? row.page_ref : null,
      category: typeof row.category === "string" ? row.category : null,
      documentTitle: titleById.get(String(row.document_id)),
    }));
  }
  const all = await loadApprovedChunks(clientId, ids);
  return all.map((chunk) => ({
    ...chunk,
    documentTitle: titleById.get(chunk.documentId),
  }));
}
