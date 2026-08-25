import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCompanyBrainManager } from "@/lib/company-brain/access";
import { recordBrainAudit } from "@/lib/company-brain/audit";
import { brainCollections, replaceKnowledgeChunks } from "@/lib/company-brain/store";
import {
  EXAMPLE_CATEGORIES,
  KNOWLEDGE_CATEGORIES,
  OPERATIONAL_RULE_KEYS,
  PLAYBOOK_FIELD_TYPES,
  SERVICE_AREA_STATUSES,
} from "@/lib/company-brain/types";

function asEnum<T extends string>(values: readonly T[]) {
  return z.enum(values as unknown as [T, ...T[]]);
}

export const dynamic = "force-dynamic";

const RESOURCES = [
  "customers",
  "playbooks",
  "stage-guidance",
  "service-areas",
  "appointment-types",
  "faqs",
  "examples",
  "rules",
  "escalation-rules",
  "knowledge",
] as const;

type Resource = (typeof RESOURCES)[number];

function isResource(value: string): value is Resource {
  return (RESOURCES as readonly string[]).includes(value);
}

const playbookFieldSchema = z.object({
  id: z.string().max(80),
  label: z.string().min(1).max(120),
  internalKey: z.string().min(1).max(80).regex(/^[a-z0-9_]+$/),
  type: asEnum(PLAYBOOK_FIELD_TYPES),
  required: z.boolean(),
  possibleValues: z.array(z.string().max(80)).max(40),
  validation: z.string().max(200).nullable(),
  agentQuestionGuidance: z.string().max(500).nullable(),
  crmMapping: z.string().max(80).nullable(),
  priority: z.number().int().min(0).max(100),
  conditional: z
    .object({
      field: z.string().max(80),
      op: z.enum(["equals", "not_equals", "truthy", "falsy"]),
      value: z.string().max(80).optional(),
    })
    .nullable(),
});

const schemas: Record<Resource, z.ZodTypeAny> = {
  customers: z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(800).optional().nullable(),
    typical_requirements: z.string().max(800).optional().nullable(),
    min_project_size: z.string().max(120).optional().nullable(),
    typical_decision_maker: z.string().max(120).optional().nullable(),
    primary_interest: z.string().max(200).optional().nullable(),
    geographic_requirements: z.string().max(200).optional().nullable(),
    good_fit_indicators: z.string().max(800).optional().nullable(),
    poor_fit_indicators: z.string().max(800).optional().nullable(),
    disqualifying_conditions: z.string().max(800).optional().nullable(),
    sort_order: z.number().int().optional(),
    active: z.boolean().optional(),
  }),
  playbooks: z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(800).optional().nullable(),
    applies_to: z.string().max(200).optional().nullable(),
    trigger_conditions: z
      .object({
        keywords: z.array(z.string().max(60)).max(20).optional(),
        itemKinds: z.array(z.string().max(40)).optional(),
        conversationType: z.string().max(20).optional(),
      })
      .optional(),
    fields: z.array(playbookFieldSchema).max(40).optional(),
    completion_criteria: z
      .object({ requireAllRequired: z.boolean().optional(), minRequiredCount: z.number().int().optional() })
      .optional(),
    deal_readiness_rules: z.record(z.unknown()).optional(),
    enabled: z.boolean().optional(),
    sort_order: z.number().int().optional(),
  }),
  "stage-guidance": z.object({
    stage: z.string().min(1).max(40),
    guidance: z.string().max(800).optional().nullable(),
    preconditions: z
      .array(z.object({ action: z.string().max(80), requires: z.string().max(80), note: z.string().max(200).optional() }))
      .optional(),
  }),
  "service-areas": z.object({
    label: z.string().max(120).optional().nullable(),
    country: z.string().max(80).optional().nullable(),
    province: z.string().max(80).optional().nullable(),
    city: z.string().max(80).optional().nullable(),
    region: z.string().max(80).optional().nullable(),
    radius_km: z.number().nonnegative().optional().nullable(),
    service_category: z.string().max(80).optional().nullable(),
    status: asEnum(SERVICE_AREA_STATUSES).optional(),
    travel_charge_applies: z.boolean().optional(),
    travel_charge_note: z.string().max(200).optional().nullable(),
    min_order: z.string().max(120).optional().nullable(),
    manager_confirmation_required: z.boolean().optional(),
    assigned_note: z.string().max(200).optional().nullable(),
    active: z.boolean().optional(),
  }),
  "appointment-types": z.object({
    name: z.string().min(1).max(80),
    duration_minutes: z.number().int().min(15).max(480).optional(),
    eligible_user_ids: z.array(z.string().uuid()).max(40).optional(),
    working_hours_source: z.enum(["COMPANY", "SALES", "SUPPORT", "CUSTOM"]).optional(),
    min_notice_hours: z.number().int().min(0).max(168).optional(),
    location_required: z.boolean().optional(),
    buffer_minutes: z.number().int().min(0).max(120).optional(),
    enabled: z.boolean().optional(),
    sort_order: z.number().int().optional(),
  }),
  faqs: z.object({
    question: z.string().min(3).max(240),
    approved_answer: z.string().min(3).max(4000),
    aliases: z.array(z.string().max(240)).max(12).optional(),
    category: z.string().max(80).optional().nullable(),
    active: z.boolean().optional(),
    product_ids: z.array(z.string().uuid()).max(20).optional(),
    last_reviewed_at: z.string().optional().nullable(),
  }),
  examples: z.object({
    situation: z.string().min(3).max(300),
    customer_message: z.string().min(1).max(800),
    preferred_response: z.string().min(1).max(1500),
    why_preferred: z.string().max(400).optional().nullable(),
    category: asEnum(EXAMPLE_CATEGORIES).optional(),
    active: z.boolean().optional(),
  }),
  rules: z.object({
    rule_type: z.enum(["NEVER_SAY", "NEVER_DO"]),
    text: z.string().min(3).max(400),
    structured_key: asEnum(OPERATIONAL_RULE_KEYS).nullable().optional(),
    enabled: z.boolean().optional(),
  }),
  "escalation-rules": z.object({
    name: z.string().min(2).max(120),
    condition_key: z.string().min(2).max(60),
    condition_config: z.record(z.unknown()).optional(),
    destination_type: z.enum(["USER", "TEAM", "OWNER", "SALES_MANAGER", "SUPPORT_QUEUE", "ADMIN"]).optional(),
    destination_id: z.string().uuid().nullable().optional(),
    priority: z.enum(["NORMAL", "HIGH", "URGENT"]).optional(),
    customer_message: z.string().max(400).nullable().optional(),
    enabled: z.boolean().optional(),
  }),
  knowledge: z.object({
    title: z.string().min(2).max(160),
    category: asEnum(KNOWLEDGE_CATEGORIES).optional(),
    description: z.string().max(800).optional().nullable(),
    storage_key: z.string().max(400).optional().nullable(),
    content_text: z.string().max(80_000).optional().nullable(),
    status: z.enum(["DRAFT", "APPROVED", "OUTDATED", "ARCHIVED"]).optional(),
    last_reviewed_at: z.string().optional().nullable(),
    effective_date: z.string().optional().nullable(),
    expires_at: z.string().optional().nullable(),
  }),
};

async function createResource(resource: Resource, clientId: string, payload: Record<string, unknown>, userId: string) {
  switch (resource) {
    case "customers":
      return brainCollections.createCustomer(clientId, payload);
    case "playbooks":
      return brainCollections.createPlaybook(clientId, payload);
    case "stage-guidance":
      return brainCollections.upsertStage(clientId, payload);
    case "service-areas":
      return brainCollections.createArea(clientId, payload);
    case "appointment-types":
      return brainCollections.createAppointment(clientId, payload);
    case "faqs":
      return brainCollections.createFaq(clientId, payload);
    case "examples":
      return brainCollections.createExample(clientId, payload);
    case "rules":
      return brainCollections.createRule(clientId, payload);
    case "escalation-rules":
      return brainCollections.createEscalation(clientId, payload);
    case "knowledge": {
      const doc = await brainCollections.createKnowledge(clientId, {
        ...payload,
        uploaded_by_id: userId,
        status: payload.status ?? "DRAFT",
      });
      if (typeof payload.content_text === "string" && payload.content_text.trim()) {
        await replaceKnowledgeChunks({
          clientId,
          documentId: doc.id,
          category: doc.category,
          content: payload.content_text,
        });
      }
      return doc;
    }
  }
}

export async function POST(req: Request, { params }: { params: { resource: string } }) {
  const access = await requireCompanyBrainManager(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!isResource(params.resource)) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  const parsed = schemas[params.resource].safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }
  try {
    const item = await createResource(params.resource, access.clientId, parsed.data, access.userId);
    await recordBrainAudit({
      clientId: access.clientId,
      actorId: access.userId,
      action: "CREATED",
      entityType: params.resource,
      entityId: typeof item === "object" && item && "id" in item ? String(item.id) : null,
      summary: `Created ${params.resource}`,
    });
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
