import { z } from "zod";
import type { AgentToolDefinition } from "../provider";
import type { AgentToolMetadata } from "../policy";

/**
 * SegmiQ Agent tool registry — the complete allowlist of actions the model
 * may request. Everything else is rejected. Descriptions and schemas are
 * deterministic and system-controlled; tenant or customer content never
 * alters tool definitions.
 *
 * Note the model never supplies companyId / leadId / user ids — those come
 * from the authenticated execution context on the server.
 */

export const QUALIFICATION_FIELDS = [
  "budget",
  "project_type",
  "timeline",
  "location",
  "customer_need",
  "buying_timeframe",
] as const;

const confidence = z.number().min(0).max(1);

export const TOOL_INPUT_SCHEMAS = {
  catalog_search: z.object({
    query: z.string().max(200).optional(),
    limit: z.number().int().min(1).max(12).optional(),
  }),
  "product.search": z.object({
    query: z.string().max(200).optional(),
    limit: z.number().int().min(1).max(12).optional(),
  }),
  "product.get": z.object({
    product_id: z.string().uuid(),
  }),
  "inventory.getAvailability": z.object({
    product_id: z.string().uuid(),
    variant_id: z.string().uuid().optional(),
  }),
  "package.search": z.object({
    query: z.string().max(200).optional(),
    limit: z.number().int().min(1).max(12).optional(),
  }),
  "package.get": z.object({
    package_id: z.string().uuid(),
  }),
  "package.checkAvailability": z.object({
    package_id: z.string().uuid(),
    scale: z.number().positive().max(1000).optional(),
  }),
  brain_lookup: z.object({
    query: z.string().min(2).max(300),
  }),
  calendar_get_availability: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  }),
  quotation_get_current: z.object({}),
  lead_update_qualification: z.object({
    updates: z
      .array(
        z.object({
          field: z.string().min(1).max(80),
          value: z.string().min(1).max(300),
          confidence,
          evidence: z.string().max(200).optional(),
        })
      )
      .min(1)
      .max(8),
  }),
  memory_update: z.object({
    updates: z
      .array(
        z.object({
          key: z.string().min(3).max(80),
          value: z.string().min(1).max(300),
          confidence,
          evidence: z.string().max(200).optional(),
        })
      )
      .min(1)
      .max(10),
  }),
  deal_create: z.object({
    name: z.string().min(3).max(120),
    customer_need: z.string().max(400).optional(),
    customer_budget: z.number().positive().max(100_000_000).optional(),
    buying_timeframe: z.string().max(120).optional(),
    location: z.string().max(200).optional(),
    reason: z.string().min(10).max(400),
  }),
  task_create_follow_up: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
    description: z.string().min(3).max(300),
    source: z.enum(["CUSTOMER_REQUEST", "AGENT_RECOMMENDED"]),
  }),
  calendar_schedule_callback: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
    time: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm (24h, company timezone)"),
    purpose: z.string().min(3).max(200),
  }),
  calendar_reschedule_callback: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
    time: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm (24h, company timezone)"),
    reason: z.string().max(200).optional(),
  }),
  quotation_prepare_draft: z.object({
    package_id: z.string().uuid(),
    template_id: z.string().uuid().optional(),
    note_to_team: z.string().max(400).optional(),
  }),
  quotation_send: z.object({
    quotation_id: z.string().uuid(),
  }),
  conversation_transfer_support: z.object({
    reason_category: z.enum([
      "TECHNICAL",
      "INSTALLATION",
      "WARRANTY",
      "CUSTOMER_SERVICE",
      "OTHER",
    ]),
    issue_summary: z.string().min(5).max(600),
  }),
  conversation_add_internal_note: z.object({
    note: z.string().min(3).max(800),
  }),
  agent_escalate: z.object({
    reason: z.enum([
      "LOW_CONFIDENCE",
      "CUSTOMER_REQUESTED_HUMAN",
      "PRICING_DISPUTE",
      "COMPLAINT",
      "TECHNICAL_RISK",
      "COMMERCIAL_APPROVAL",
      "UNSUPPORTED_REQUEST",
      "POLICY_BLOCKED",
      "CONFLICTING_CUSTOMER_DATA",
      "ATTACHMENT_REVIEW",
      "KNOWLEDGE_CONFLICT",
    ]),
    summary: z.string().min(10).max(600),
    customer_request: z.string().max(400).optional(),
  }),
  agent_notify_owner: z.object({
    message: z.string().min(5).max(300),
  }),
} as const;

export type AgentToolName = keyof typeof TOOL_INPUT_SCHEMAS;

export const TOOL_METADATA: Record<AgentToolName, AgentToolMetadata> = {
  catalog_search: {
    name: "catalog_search",
    riskLevel: "LOW",
    customerVisible: false,
    reversible: true,
    readOnly: true,
  },
  "product.search": {
    name: "product.search",
    riskLevel: "LOW",
    customerVisible: false,
    reversible: true,
    readOnly: true,
  },
  "product.get": {
    name: "product.get",
    riskLevel: "LOW",
    customerVisible: false,
    reversible: true,
    readOnly: true,
  },
  "inventory.getAvailability": {
    name: "inventory.getAvailability",
    riskLevel: "LOW",
    customerVisible: false,
    reversible: true,
    readOnly: true,
  },
  "package.search": {
    name: "package.search",
    riskLevel: "LOW",
    customerVisible: false,
    reversible: true,
    readOnly: true,
  },
  "package.get": {
    name: "package.get",
    riskLevel: "LOW",
    customerVisible: false,
    reversible: true,
    readOnly: true,
  },
  "package.checkAvailability": {
    name: "package.checkAvailability",
    riskLevel: "LOW",
    customerVisible: false,
    reversible: true,
    readOnly: true,
  },
  brain_lookup: {
    name: "brain_lookup",
    riskLevel: "LOW",
    customerVisible: false,
    reversible: true,
    readOnly: true,
  },
  calendar_get_availability: {
    name: "calendar_get_availability",
    riskLevel: "LOW",
    customerVisible: false,
    reversible: true,
    readOnly: true,
  },
  quotation_get_current: {
    name: "quotation_get_current",
    riskLevel: "LOW",
    customerVisible: false,
    reversible: true,
    readOnly: true,
  },
  lead_update_qualification: {
    name: "lead_update_qualification",
    riskLevel: "LOW",
    capability: "qualifyLeads",
    customerVisible: false,
    reversible: true,
    readOnly: false,
  },
  memory_update: {
    name: "memory_update",
    riskLevel: "LOW",
    customerVisible: false,
    reversible: true,
    readOnly: false,
  },
  deal_create: {
    name: "deal_create",
    riskLevel: "MEDIUM",
    capability: "createDeals",
    customerVisible: false,
    reversible: false,
    readOnly: false,
  },
  task_create_follow_up: {
    name: "task_create_follow_up",
    riskLevel: "LOW",
    capability: "createTasks",
    customerVisible: false,
    reversible: true,
    readOnly: false,
  },
  calendar_schedule_callback: {
    name: "calendar_schedule_callback",
    riskLevel: "MEDIUM",
    capability: "scheduleCallbacks",
    customerVisible: false,
    reversible: true,
    readOnly: false,
  },
  calendar_reschedule_callback: {
    name: "calendar_reschedule_callback",
    riskLevel: "MEDIUM",
    capability: "rescheduleAppointments",
    customerVisible: false,
    reversible: true,
    readOnly: false,
  },
  quotation_prepare_draft: {
    name: "quotation_prepare_draft",
    riskLevel: "MEDIUM",
    capability: "prepareQuotations",
    customerVisible: false,
    reversible: true,
    readOnly: false,
  },
  quotation_send: {
    name: "quotation_send",
    riskLevel: "HIGH",
    capability: "sendQuotations",
    customerVisible: true,
    reversible: false,
    readOnly: false,
  },
  conversation_transfer_support: {
    name: "conversation_transfer_support",
    riskLevel: "MEDIUM",
    capability: "transferSupport",
    customerVisible: false,
    reversible: true,
    readOnly: false,
  },
  conversation_add_internal_note: {
    name: "conversation_add_internal_note",
    riskLevel: "LOW",
    customerVisible: false,
    reversible: true,
    readOnly: false,
  },
  agent_escalate: {
    name: "agent_escalate",
    riskLevel: "LOW",
    customerVisible: false,
    reversible: true,
    readOnly: false,
  },
  agent_notify_owner: {
    name: "agent_notify_owner",
    riskLevel: "LOW",
    customerVisible: false,
    reversible: true,
    readOnly: false,
  },
};

/**
 * Tools that remain internal even in ASSIST mode: escalation, notes and
 * notifications never touch the customer or commercial records.
 */
export const TOOL_DISPLAY_NAMES: Record<AgentToolName, string> = {
  catalog_search: "Search catalogue",
  "product.search": "Search products",
  "product.get": "Get product",
  "inventory.getAvailability": "Check inventory",
  "package.search": "Search packages",
  "package.get": "Get package",
  "package.checkAvailability": "Check package availability",
  brain_lookup: "Look up Company Brain",
  calendar_get_availability: "Check availability",
  quotation_get_current: "Read current quotation",
  lead_update_qualification: "Update qualification",
  memory_update: "Update customer memory",
  deal_create: "Create deal",
  task_create_follow_up: "Create follow-up",
  calendar_schedule_callback: "Schedule callback",
  calendar_reschedule_callback: "Reschedule callback",
  quotation_prepare_draft: "Prepare quotation",
  quotation_send: "Send quotation",
  conversation_transfer_support: "Transfer to support",
  conversation_add_internal_note: "Add internal note",
  agent_escalate: "Escalate to human",
  agent_notify_owner: "Notify owner",
};

export const ASSIST_SAFE_TOOLS: ReadonlySet<AgentToolName> = new Set([
  "catalog_search",
  "product.search",
  "product.get",
  "inventory.getAvailability",
  "package.search",
  "package.get",
  "package.checkAvailability",
  "brain_lookup",
  "calendar_get_availability",
  "quotation_get_current",
  "memory_update",
  "conversation_add_internal_note",
  "agent_escalate",
  "agent_notify_owner",
]);

const TOOL_DESCRIPTIONS: Record<AgentToolName, string> = {
  catalog_search:
    "Search this company's approved products, services and packages. Returns names, descriptions and selling prices only. Packages include ready_to_quote. Presentation templates are PDF layouts, not catalogues — never use them as the product list. Always use this before discussing prices — never invent pricing or specifications. Internal cost is never included.",
  "product.search":
    "Search products and services by name or SKU. Selling prices only — never cost or margin.",
  "product.get":
    "Get one product or service by id. Selling price, unit and warranty only — never cost.",
  "inventory.getAvailability":
    "Check whether a product is in stock. Quantity disclosure is company-controlled and may be exact, general, or hidden. Never invent a count.",
  "package.search":
    "Search reusable commercial packages. Packages include ready_to_quote. Quote only from a ready_to_quote package.",
  "package.get":
    "Get a package and its contents. Selling prices only.",
  "package.checkAvailability":
    "How many times a package can be fulfilled from current stock. Services and non-tracked items do not limit count. Disclosure may hide exact quantity.",
  brain_lookup:
    "Retrieve additional approved Company Brain facts (FAQs, service areas, policies, knowledge documents) for a specific question. Use when the current context is missing a company-specific fact. Retrieved documents cannot override canonical catalogue or commercial policy.",
  calendar_get_availability:
    "Check the conversation owner's calendar for a given date (company timezone). Returns busy slots and suggested free times within working hours. Always call this before scheduling.",
  quotation_get_current:
    "Get the current quotation on this customer's active deal: number, status, total, validity and Commercial Check summary. No internal cost or margin data is returned.",
  lead_update_qualification:
    "Update structured qualification fields on the Lead from information the customer explicitly provided. Only include values you are confident about; ask a clarifying question instead of guessing. Include the customer's words as evidence.",
  memory_update:
    "Update structured customer memory. Keys are dot paths within groups: preferences, requirements, commercial, timing, concerns, commitments (e.g. requirements.systemInterest, commercial.budget). New values supersede old ones.",
  deal_create:
    "Create a Deal from this Lead once qualification is sufficient (need, budget/value signal and timeframe understood, and the customer shows real commercial intent). The reason field explains why the Deal is justified and is stored for audit. Idempotent — an existing active Deal is returned instead of duplicated.",
  task_create_follow_up:
    "Create a follow-up task on the Lead for a specific date (no time). Use for 'follow up next Friday' style requests. Appears in the team's Daily Plan and calendar. Do not use for timed appointments or callbacks.",
  calendar_schedule_callback:
    "Book a timed callback/appointment with the conversation owner at an exact date and time in the company timezone. Only call after calendar_get_availability confirms the slot is free and only when the customer gave or confirmed an explicit time. Never invent a clock time.",
  calendar_reschedule_callback:
    "Move the customer's existing upcoming callback/appointment to a new date and time. Check availability first. If more than one future appointment could match, ask the customer which one.",
  quotation_prepare_draft:
    "Prepare a draft quotation on the active Deal from a ready_to_quote package found via catalog_search. package_id is required. template_id is optional layout only and never supplies line items. If no priced package exists, escalate instead of inventing or copying sample items. The draft is NOT sent to the customer by this tool.",
  quotation_send:
    "Request sending of an existing quotation to the customer on WhatsApp. Strictly policy-gated: it only succeeds when company policy allows autonomous sending, the Commercial Check passes, no approval is required and the total is within the autonomous limit. If blocked, the team is notified instead — do not tell the customer it was sent.",
  conversation_transfer_support:
    "Classify this conversation as Support and route it to the support queue with a handover summary. Use for post-sale technical issues, installations, warranty or service complaints. Does not create a new conversation.",
  conversation_add_internal_note:
    "Add an internal note to the conversation timeline for the team. The customer never sees internal notes.",
  agent_escalate:
    "Stop autonomous handling and bring a human in. Marks the conversation HUMAN NEEDED with your summary and notifies the owner. Use immediately when the customer asks for a person, disputes pricing, complains, or when you are not confident how to proceed.",
  agent_notify_owner:
    "Send a short internal notification to the conversation owner without stopping the conversation.",
};

function zodShapeToJsonSchema(name: AgentToolName): Record<string, unknown> {
  // Hand-mapped JSON Schemas keep the provider payload deterministic and free
  // of zod internals. They must stay in sync with TOOL_INPUT_SCHEMAS.
  const schemas: Record<AgentToolName, Record<string, unknown>> = {
    catalog_search: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search words, e.g. '5kva solar package'" },
        limit: { type: "integer", minimum: 1, maximum: 12 },
      },
    },
    "product.search": {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 12 },
      },
    },
    "product.get": {
      type: "object",
      properties: { product_id: { type: "string" } },
      required: ["product_id"],
    },
    "inventory.getAvailability": {
      type: "object",
      properties: {
        product_id: { type: "string" },
        variant_id: { type: "string" },
      },
      required: ["product_id"],
    },
    "package.search": {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 12 },
      },
    },
    "package.get": {
      type: "object",
      properties: { package_id: { type: "string" } },
      required: ["package_id"],
    },
    "package.checkAvailability": {
      type: "object",
      properties: {
        package_id: { type: "string" },
        scale: { type: "number" },
      },
      required: ["package_id"],
    },
    brain_lookup: {
      type: "object",
      properties: {
        query: { type: "string", description: "The company-specific question to look up" },
      },
      required: ["query"],
    },
    calendar_get_availability: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD in the company timezone" },
      },
      required: ["date"],
    },
    quotation_get_current: { type: "object", properties: {} },
    lead_update_qualification: {
      type: "object",
      properties: {
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: { type: "string", description: "Playbook or CRM field key" },
              value: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              evidence: { type: "string", description: "The customer's words supporting this value" },
            },
            required: ["field", "value", "confidence"],
          },
        },
      },
      required: ["updates"],
    },
    memory_update: {
      type: "object",
      properties: {
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string", description: "Dot path, e.g. commercial.budget" },
              value: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              evidence: { type: "string" },
            },
            required: ["key", "value", "confidence"],
          },
        },
      },
      required: ["updates"],
    },
    deal_create: {
      type: "object",
      properties: {
        name: { type: "string", description: "Deal name, e.g. 'Residential solar — Borrowdale'" },
        customer_need: { type: "string" },
        customer_budget: { type: "number", description: "Numeric budget if the customer stated one" },
        buying_timeframe: { type: "string" },
        location: { type: "string" },
        reason: {
          type: "string",
          description: "Why this Lead is ready for a Deal (stored for audit)",
        },
      },
      required: ["name", "reason"],
    },
    task_create_follow_up: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        description: { type: "string" },
        source: { type: "string", enum: ["CUSTOMER_REQUEST", "AGENT_RECOMMENDED"] },
      },
      required: ["date", "description", "source"],
    },
    calendar_schedule_callback: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD in company timezone" },
        time: { type: "string", description: "HH:mm 24h in company timezone" },
        purpose: { type: "string" },
      },
      required: ["date", "time", "purpose"],
    },
    calendar_reschedule_callback: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD in company timezone" },
        time: { type: "string", description: "HH:mm 24h in company timezone" },
        reason: { type: "string" },
      },
      required: ["date", "time"],
    },
    quotation_prepare_draft: {
      type: "object",
      properties: {
        package_id: {
          type: "string",
          description: "Required. ready_to_quote package id from catalog_search",
        },
        template_id: {
          type: "string",
          description: "Optional PDF layout only. Never used as the product list.",
        },
        note_to_team: { type: "string" },
      },
      required: ["package_id"],
    },
    quotation_send: {
      type: "object",
      properties: {
        quotation_id: { type: "string", description: "Quotation id from quotation_prepare_draft or quotation_get_current" },
      },
      required: ["quotation_id"],
    },
    conversation_transfer_support: {
      type: "object",
      properties: {
        reason_category: {
          type: "string",
          enum: ["TECHNICAL", "INSTALLATION", "WARRANTY", "CUSTOMER_SERVICE", "OTHER"],
        },
        issue_summary: { type: "string", description: "What the customer reported, for the support team" },
      },
      required: ["reason_category", "issue_summary"],
    },
    conversation_add_internal_note: {
      type: "object",
      properties: { note: { type: "string" } },
      required: ["note"],
    },
    agent_escalate: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          enum: [
            "LOW_CONFIDENCE",
            "CUSTOMER_REQUESTED_HUMAN",
            "PRICING_DISPUTE",
            "COMPLAINT",
            "TECHNICAL_RISK",
            "COMMERCIAL_APPROVAL",
            "UNSUPPORTED_REQUEST",
            "POLICY_BLOCKED",
            "CONFLICTING_CUSTOMER_DATA",
            "ATTACHMENT_REVIEW",
            "KNOWLEDGE_CONFLICT",
          ],
        },
        summary: { type: "string", description: "Factual handover summary for the human" },
        customer_request: { type: "string", description: "What the customer wants, in one line" },
      },
      required: ["reason", "summary"],
    },
    agent_notify_owner: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
    },
  };
  return schemas[name];
}

export function isRegisteredTool(name: string): name is AgentToolName {
  return Object.prototype.hasOwnProperty.call(TOOL_INPUT_SCHEMAS, name);
}

/** Provider-facing tool definitions for the tools the current policy exposes. */
export function buildToolDefinitions(toolNames: AgentToolName[]): AgentToolDefinition[] {
  return toolNames.map((name) => ({
    name,
    description: TOOL_DESCRIPTIONS[name],
    inputSchema: zodShapeToJsonSchema(name),
  }));
}

export function validateToolInput(
  name: AgentToolName,
  input: unknown
): { ok: true; data: unknown } | { ok: false; error: string } {
  const parsed = TOOL_INPUT_SCHEMAS[name].safeParse(input ?? {});
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return { ok: false, error: `Invalid input for ${name}: ${issues}` };
  }
  return { ok: true, data: parsed.data };
}
