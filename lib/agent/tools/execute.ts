import { createAdminClient } from "@/lib/supabase/admin";
import { assembleCompanyBrainContext } from "@/lib/company-brain";
import { logFollowUpSet, logLeadEvent } from "@/lib/lead-events";
import { createDealFromLead } from "@/lib/sales/deals/create-deal";
import { parseLeadFields } from "@/lib/lead-helpers";
import { createAgentEscalation } from "../escalation";
import { saveCustomerMemoryUpdates } from "../memory";
import { notifyAgentAlert } from "../notifications";
import { evaluateRealEstateToolPolicy, isReAgentTool } from "../real-estate/policy";
import { evaluateToolPolicy } from "../policy";
import {
  executeBuyerRequirementsUpdate,
  executeListingGet,
  executeListingSearch,
  executeListingSendMatch,
  executePropertyMatch,
} from "../real-estate/tools";
import {
  executeViewingGetAvailability,
  executeViewingRequestApproval,
  executeViewingSchedule,
} from "../real-estate/viewing-tools";
import type { AgentEscalationReason } from "../types";
import {
  executeGetAvailability,
  executeRescheduleCallback,
  executeScheduleCallback,
} from "./calendar";
import { AGENT_ACTOR, toolFailure, toolSuccess, type ToolExecutionContext, type ToolResult } from "./context";
import {
  executeCatalogSearch,
  executeInventoryGetAvailability,
  executePackageCheckAvailability,
  executePackageGet,
  executePackageSearch,
  executeProductGet,
  executeProductSearch,
} from "./commercial";
import {
  executeGetCurrentQuotation,
  executePrepareQuotationDraft,
  executeSendQuotation,
} from "./quotation";
import {
  ASSIST_SAFE_TOOLS,
  TOOL_METADATA,
  isRegisteredTool,
  validateToolInput,
  type AgentToolName,
} from "./registry";

/**
 * Tool execution layer: validates model-requested tool calls against the
 * registry schemas and company policy, then executes them via canonical
 * SegmiQ services. Tenancy always derives from the execution context.
 */

// ---------------------------------------------------------------------------
// Individual executors.

async function executeBrainLookup(
  ctx: ToolExecutionContext,
  input: { query: string }
): Promise<ToolResult> {
  try {
    const assembled = await assembleCompanyBrainContext({
      clientId: ctx.clientId,
      customerMessage: input.query,
    });
    if (assembled.context.retrievalFailed) {
      return toolFailure(
        "Company Brain lookup failed. Do not invent the answer from general knowledge. Confirm with the team."
      );
    }
    return toolSuccess({
      faqs: assembled.context.faqs.map((row) => ({
        question: row.faq.question,
        answer: row.faq.approvedAnswer,
      })),
      service_area: assembled.context.serviceAreaMatch
        ? {
            place: [
              assembled.context.serviceAreaMatch.area.city,
              assembled.context.serviceAreaMatch.area.region,
              assembled.context.serviceAreaMatch.area.country,
            ]
              .filter(Boolean)
              .join(", "),
            status: assembled.context.serviceAreaMatch.area.status,
            confirmation_required:
              assembled.context.serviceAreaMatch.area.status === "CONFIRMATION_REQUIRED" ||
              assembled.context.serviceAreaMatch.area.managerConfirmationRequired,
          }
        : assembled.context.serviceAreasUnconfigured
          ? { status: "UNCONFIGURED" }
          : null,
      documents: assembled.context.knowledgeChunks.map((chunk) => ({
        title: chunk.documentTitle ?? "Document",
        excerpt: chunk.content.slice(0, 400),
      })),
      conflicts: assembled.context.conflicts,
      note: "Canonical catalogue and commercial policy still override these documents.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolFailure(
      `Company Brain lookup failed (${message.slice(0, 120)}). Do not invent company-specific facts.`
    );
  }
}

const QUALIFICATION_COLUMN_MAP: Record<string, string | null> = {
  budget: "budget",
  project_type: "project_type",
  timeline: "timeline",
  location: null, // no leads.location column; stored in form_data
  customer_need: "customer_need",
  buying_timeframe: "buying_timeframe",
};

async function executeUpdateQualification(
  ctx: ToolExecutionContext,
  input: {
    updates: Array<{ field: string; value: string; confidence: number; evidence?: string }>;
  }
): Promise<ToolResult> {
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, form_data, budget, project_type, timeline, customer_need, buying_timeframe")
    .eq("id", ctx.leadId)
    .eq("client_id", ctx.clientId)
    .maybeSingle();
  if (!lead) return toolFailure("Lead not found.");

  const confident = input.updates.filter((u) => u.confidence >= 0.6);
  const skipped = input.updates.filter((u) => u.confidence < 0.6).map((u) => u.field);
  if (!confident.length) {
    return toolFailure(
      "All updates were below the confidence threshold (0.6). Ask the customer to clarify instead of writing uncertain CRM data.",
      { skipped }
    );
  }

  if (ctx.testMode) {
    return toolSuccess({
      simulated: true,
      applied: confident.map((u) => u.field),
      skipped_low_confidence: skipped,
    });
  }

  const formData = ((lead.form_data as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  const brainQual =
    formData._brain_qualification && typeof formData._brain_qualification === "object"
      ? { ...(formData._brain_qualification as Record<string, unknown>) }
      : {};
  const columnPatch: Record<string, unknown> = {};
  const changes: Array<{ field: string; from: unknown; to: string }> = [];
  const allowedExtra = new Set(ctx.playbookFieldKeys ?? []);
  for (const update of confident) {
    const column = QUALIFICATION_COLUMN_MAP[update.field];
    const extra = allowedExtra.has(update.field);
    if (column === undefined && !extra) continue;
    const previous = column
      ? (lead as Record<string, unknown>)[column]
      : extra
        ? brainQual[update.field]
        : formData[update.field];
    if (column) columnPatch[column] = update.value;
    formData[update.field] = update.value;
    if (extra) brainQual[update.field] = update.value;
    changes.push({ field: update.field, from: previous ?? null, to: update.value });
  }
  if (Object.keys(brainQual).length) formData._brain_qualification = brainQual;
  if (!changes.length) {
    return toolFailure(
      "None of the fields are recognised on this company's qualification playbook or CRM schema."
    );
  }

  // Reuse canonical parsing so budget/timeline normalization stays consistent.
  const parsed = parseLeadFields(formData);
  if (parsed.budget) columnPatch.budget = parsed.budget;
  if (parsed.project_type && !columnPatch.project_type) columnPatch.project_type = parsed.project_type;
  if (parsed.timeline && !columnPatch.timeline) columnPatch.timeline = parsed.timeline;

  const { error } = await supabase
    .from("leads")
    .update({ ...columnPatch, form_data: formData, updated_at: new Date().toISOString() })
    .eq("id", ctx.leadId)
    .eq("client_id", ctx.clientId);
  if (error) return toolFailure(`Failed to update qualification: ${error.message}`);

  await logLeadEvent({
    leadId: ctx.leadId,
    clientId: ctx.clientId,
    actor: AGENT_ACTOR,
    eventType: "NOTE_ADDED",
    eventData: {
      note: `Qualification updated by SegmiQ Agent: ${changes
        .map((c) => `${c.field} → ${c.to}`)
        .join(", ")}`,
      agent: true,
      qualification_changes: changes,
      evidence: confident.map((u) => u.evidence).filter(Boolean),
    },
  });

  // Mirror into structured memory so future runs remember without re-reading CRM history.
  if (ctx.contactId) {
    const memoryKeyByField: Record<string, string> = {
      budget: "commercial.budget",
      project_type: "requirements.projectType",
      timeline: "timing.desiredTimeline",
      location: "requirements.location",
      customer_need: "requirements.customerNeed",
      buying_timeframe: "timing.buyingTimeframe",
    };
    await saveCustomerMemoryUpdates({
      clientId: ctx.clientId,
      contactId: ctx.contactId,
      updates: confident
        .filter((u) => memoryKeyByField[u.field])
        .map((u) => ({
          key: memoryKeyByField[u.field],
          value: u.value,
          confidence: u.confidence,
          evidence: u.evidence,
        })),
    }).catch(() => null);
  }

  return toolSuccess({
    applied: changes.map((c) => c.field),
    skipped_low_confidence: skipped,
  });
}

async function executeMemoryUpdate(
  ctx: ToolExecutionContext,
  input: { updates: Array<{ key: string; value: string; confidence: number; evidence?: string }> }
): Promise<ToolResult> {
  if (!ctx.contactId) {
    return toolFailure("No contact record exists for this customer yet; memory cannot be stored.");
  }
  if (ctx.testMode) {
    return toolSuccess({ simulated: true, applied: input.updates.map((u) => u.key) });
  }
  const { applied, rejected } = await saveCustomerMemoryUpdates({
    clientId: ctx.clientId,
    contactId: ctx.contactId,
    updates: input.updates,
  });
  return toolSuccess({ applied, rejected });
}

async function executeCreateDeal(
  ctx: ToolExecutionContext,
  input: {
    name: string;
    customer_need?: string;
    customer_budget?: number;
    buying_timeframe?: string;
    location?: string;
    reason: string;
  }
): Promise<ToolResult> {
  if (ctx.playbookRequiredKeys?.length) {
    const supabase = createAdminClient();
    const { data: lead } = await supabase
      .from("leads")
      .select("form_data, budget, project_type, timeline, customer_need, buying_timeframe")
      .eq("id", ctx.leadId)
      .eq("client_id", ctx.clientId)
      .maybeSingle();
    const formData = ((lead?.form_data as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
    const brainQual =
      formData._brain_qualification && typeof formData._brain_qualification === "object"
        ? (formData._brain_qualification as Record<string, string>)
        : {};
    const answers: Record<string, string | null> = { ...brainQual };
    for (const key of ["budget", "project_type", "timeline", "customer_need", "buying_timeframe", "location"]) {
      const v = (lead as Record<string, unknown> | null)?.[key] ?? formData[key];
      if (typeof v === "string" && v.trim()) answers[key] = v;
    }
    const missing = ctx.playbookRequiredKeys.filter((key) => !String(answers[key] ?? "").trim());
    if (missing.length) {
      return toolFailure(
        `Deal is not ready: qualification playbook still missing ${missing.join(", ")}. Continue qualifying instead of creating a Deal.`
      );
    }
  }

  if (!ctx.ownerId) {
    return toolFailure(
      "No salesperson owns this conversation, so a Deal cannot be created. Escalate so a manager can assign an owner."
    );
  }

  if (ctx.testMode) {
    return toolSuccess({ simulated: true, deal_name: input.name, reason: input.reason });
  }

  const result = await createDealFromLead({
    leadId: ctx.leadId,
    actorId: ctx.ownerId,
    name: input.name,
    customerNeed: input.customer_need ?? null,
    customerBudget: input.customer_budget ?? null,
    buyingTimeframe: input.buying_timeframe ?? null,
    location: input.location ?? null,
    notes: `Created by SegmiQ Agent. Reason: ${input.reason}`,
  });

  if (!result.ok) {
    return toolFailure(
      `Deal not created: ${result.error} Continue qualifying or escalate if the customer is clearly ready.`,
      { code: result.code }
    );
  }

  // Tenancy assertion — the deal must belong to this company.
  if ((result.deal.client_id as string) !== ctx.clientId) {
    return toolFailure("Deal creation returned a record outside this company. Aborted.");
  }

  if (!result.alreadyExisted) {
    await logLeadEvent({
      leadId: ctx.leadId,
      clientId: ctx.clientId,
      actor: AGENT_ACTOR,
      eventType: "NOTE_ADDED",
      eventData: {
        note: `Deal "${input.name}" created by SegmiQ Agent. Why: ${input.reason}`,
        agent: true,
        deal_id: result.deal.id,
      },
    });
  }

  return toolSuccess(
    {
      deal_id: result.deal.id,
      deal_name: result.deal.name,
      stage: result.deal.stage,
      already_existed: result.alreadyExisted,
    },
    { type: "deal", id: result.deal.id as string }
  );
}

async function executeCreateFollowUp(
  ctx: ToolExecutionContext,
  input: { date: string; description: string; source: "CUSTOMER_REQUEST" | "AGENT_RECOMMENDED" }
): Promise<ToolResult> {
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, follow_up_date")
    .eq("id", ctx.leadId)
    .eq("client_id", ctx.clientId)
    .maybeSingle();
  if (!lead) return toolFailure("Lead not found.");

  const [y, m, d] = input.date.split("-").map(Number);
  const requested = new Date(Date.UTC(y, m - 1, d, 12));
  if (Number.isNaN(requested.getTime()) || requested.getTime() < Date.now() - 24 * 3600 * 1000) {
    return toolFailure("Follow-up date must be today or in the future.");
  }

  // No duplicate follow-ups for the same date.
  if ((lead.follow_up_date as string | null) === input.date) {
    return toolSuccess({
      already_scheduled: true,
      date: input.date,
      note: "A follow-up already exists for this date — no duplicate created.",
    });
  }

  if (ctx.testMode) {
    return toolSuccess({ simulated: true, date: input.date, description: input.description });
  }

  const { error } = await supabase
    .from("leads")
    .update({
      follow_up_date: input.date,
      follow_up_source: input.source === "CUSTOMER_REQUEST" ? "CUSTOMER_COMMITMENT" : "AGENT_CREATED",
      follow_up_execution_mode: "AGENT_ALLOWED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.leadId)
    .eq("client_id", ctx.clientId);
  if (error) return toolFailure(`Failed to create follow-up: ${error.message}`);

  await logFollowUpSet({
    leadId: ctx.leadId,
    clientId: ctx.clientId,
    actor: AGENT_ACTOR,
    followUpDate: input.date,
    notes: `${input.source === "CUSTOMER_REQUEST" ? "Customer requested" : "SegmiQ Agent recommended"}: ${input.description}`,
  });

  await supabase.from("agent_conversation_state").upsert(
    {
      lead_id: ctx.leadId,
      client_id: ctx.clientId,
      status: "FOLLOW_UP_SCHEDULED",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "lead_id" }
  );

  const { hookFollowUpSet } = await import("@/lib/agent/proactive");
  void hookFollowUpSet({
    clientId: ctx.clientId,
    leadId: ctx.leadId,
    dueDate: input.date,
    source: input.source === "CUSTOMER_REQUEST" ? "CUSTOMER_COMMITMENT" : "AGENT_CREATED",
    actorType: input.source === "CUSTOMER_REQUEST" ? "CUSTOMER" : "AGENT",
  });

  return toolSuccess(
    { date: input.date, description: input.description, source: input.source },
    { type: "follow_up", id: ctx.leadId }
  );
}

async function executeTransferSupport(
  ctx: ToolExecutionContext,
  input: { reason_category: string; issue_summary: string }
): Promise<ToolResult> {
  const supabase = createAdminClient();

  if (ctx.testMode) {
    return toolSuccess({ simulated: true, routed_to: "SUPPORT", issue: input.issue_summary });
  }

  const { error } = await supabase
    .from("leads")
    .update({
      whatsapp_conversation_type: "SUPPORT",
      whatsapp_queue: "SUPPORT",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.leadId)
    .eq("client_id", ctx.clientId);
  if (error) return toolFailure(`Could not route the conversation to Support: ${error.message}`);

  let caseId: string | null = null;
  if (ctx.settings.createSupportCases) {
    const { data: existingCase } = await supabase
      .from("support_cases")
      .select("id")
      .eq("lead_id", ctx.leadId)
      .neq("status", "RESOLVED")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingCase) {
      caseId = existingCase.id as string;
    } else {
      const { data: created } = await supabase
        .from("support_cases")
        .insert({
          client_id: ctx.clientId,
          lead_id: ctx.leadId,
          contact_id: ctx.contactId,
          status: "OPEN",
          reason_category: input.reason_category,
          reason: input.issue_summary.slice(0, 300),
          notes: `SegmiQ Agent handover\n\nIssue: ${input.issue_summary}`,
        })
        .select("id")
        .single();
      caseId = (created?.id as string) ?? null;
    }
  }

  if (caseId) {
    const { hookSupportCaseCreated } = await import("@/lib/agent/proactive");
    void hookSupportCaseCreated({
      clientId: ctx.clientId,
      caseId,
      leadId: ctx.leadId,
      actorType: "AGENT",
    });
  }

  await logLeadEvent({
    leadId: ctx.leadId,
    clientId: ctx.clientId,
    actor: AGENT_ACTOR,
    eventType: "NOTE_ADDED",
    eventData: {
      note: `SegmiQ Agent handover to Support — ${input.reason_category}: ${input.issue_summary}`,
      agent: true,
      support_case_id: caseId,
    },
  });

  await notifyAgentAlert({
    userId: ctx.ownerId ?? "",
    message: `SegmiQ Agent transferred a conversation to Support: ${input.issue_summary.slice(0, 120)}`,
    leadId: ctx.leadId,
  }).catch(() => null);

  return toolSuccess(
    {
      routed_to: "SUPPORT",
      support_case_created: Boolean(caseId),
      handover_note_added: true,
    },
    caseId ? { type: "support_case", id: caseId } : undefined
  );
}

async function executeAddInternalNote(
  ctx: ToolExecutionContext,
  input: { note: string }
): Promise<ToolResult> {
  if (ctx.testMode) return toolSuccess({ simulated: true });
  await logLeadEvent({
    leadId: ctx.leadId,
    clientId: ctx.clientId,
    actor: AGENT_ACTOR,
    eventType: "NOTE_ADDED",
    eventData: { note: input.note, agent: true },
  });
  return toolSuccess({ note_added: true });
}

async function executeEscalate(
  ctx: ToolExecutionContext,
  input: { reason: AgentEscalationReason; summary: string; customer_request?: string }
): Promise<ToolResult> {
  if (ctx.testMode) {
    return toolSuccess({ simulated: true, reason: input.reason, summary: input.summary });
  }
  const escalationId = await createAgentEscalation({
    clientId: ctx.clientId,
    leadId: ctx.leadId,
    executionId: ctx.executionId,
    reason: input.reason,
    summary: input.summary,
    briefing: input.customer_request ? { customer_request: input.customer_request } : null,
    ownerId: ctx.ownerId,
    escalationUserId: ctx.settings.escalationUserId,
  });
  if (!escalationId) return toolFailure("Failed to create the escalation record.");
  return toolSuccess(
    { escalated: true, reason: input.reason },
    { type: "escalation", id: escalationId }
  );
}

async function executeNotifyOwner(
  ctx: ToolExecutionContext,
  input: { message: string }
): Promise<ToolResult> {
  if (ctx.testMode) return toolSuccess({ simulated: true });
  if (!ctx.ownerId) {
    return toolFailure("No owner is assigned to this conversation; use agent_escalate instead.");
  }
  await notifyAgentAlert({ userId: ctx.ownerId, message: input.message, leadId: ctx.leadId });
  return toolSuccess({ notified: true });
}

// ---------------------------------------------------------------------------
// Dispatch.

type Executor = (ctx: ToolExecutionContext, input: never) => Promise<ToolResult>;

const EXECUTORS: Record<AgentToolName, Executor> = {
  catalog_search: executeCatalogSearch as Executor,
  "product.search": executeProductSearch as Executor,
  "product.get": executeProductGet as Executor,
  "inventory.getAvailability": executeInventoryGetAvailability as Executor,
  "package.search": executePackageSearch as Executor,
  "package.get": executePackageGet as Executor,
  "package.checkAvailability": executePackageCheckAvailability as Executor,
  brain_lookup: executeBrainLookup as Executor,
  calendar_get_availability: executeGetAvailability as Executor,
  quotation_get_current: executeGetCurrentQuotation as Executor,
  lead_update_qualification: executeUpdateQualification as Executor,
  memory_update: executeMemoryUpdate as Executor,
  deal_create: executeCreateDeal as Executor,
  task_create_follow_up: executeCreateFollowUp as Executor,
  calendar_schedule_callback: executeScheduleCallback as Executor,
  calendar_reschedule_callback: executeRescheduleCallback as Executor,
  quotation_prepare_draft: executePrepareQuotationDraft as Executor,
  quotation_send: executeSendQuotation as Executor,
  conversation_transfer_support: executeTransferSupport as Executor,
  conversation_add_internal_note: executeAddInternalNote as Executor,
  agent_escalate: executeEscalate as Executor,
  agent_notify_owner: executeNotifyOwner as Executor,
  "listing.search": executeListingSearch as Executor,
  "listing.get": executeListingGet as Executor,
  "property.match": executePropertyMatch as Executor,
  "buyer_requirements.update": executeBuyerRequirementsUpdate as Executor,
  "listing.send_match": executeListingSendMatch as Executor,
  "viewing.get_availability": executeViewingGetAvailability as Executor,
  "viewing.request_approval": executeViewingRequestApproval as Executor,
  "viewing.schedule": executeViewingSchedule as Executor,
};

export type ExecutedToolCall = {
  toolName: string;
  status: "EXECUTED" | "BLOCKED" | "FAILED" | "SIMULATED" | "INVALID";
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  result: ToolResult;
  blockedReason?: string;
};

/**
 * Validate + authorize + execute one model-requested tool call.
 * Unknown tools, invalid arguments and policy violations never execute.
 */
export async function runAgentTool(
  ctx: ToolExecutionContext,
  toolName: string,
  rawInput: unknown,
  opts?: { humanApproved?: boolean }
): Promise<ExecutedToolCall> {
  if (!isRegisteredTool(toolName)) {
    return {
      toolName,
      status: "INVALID",
      riskLevel: "VERY_HIGH",
      result: toolFailure(`Unknown tool "${toolName}". Only registered tools may be called.`),
    };
  }

  const metadata = TOOL_METADATA[toolName];

  if (isReAgentTool(toolName)) {
    const reDecision = evaluateRealEstateToolPolicy(toolName, ctx.settings.realEstate);
    if (!reDecision.allowed) {
      return {
        toolName,
        status: "BLOCKED",
        riskLevel: metadata.riskLevel,
        blockedReason: reDecision.reason,
        result: toolFailure(
          `Blocked by Real Estate Agent policy: ${reDecision.reason} Explain to the customer that a human agent will help, or escalate.`
        ),
      };
    }
  }

  if (ctx.operationalRuleKeys?.includes("NEVER_SEND_QUOTE") && toolName === "quotation_send") {
    return {
      toolName,
      status: "BLOCKED",
      riskLevel: metadata.riskLevel,
      blockedReason: "Company Brain rule NEVER_SEND_QUOTE blocks autonomous quotation sending.",
      result: toolFailure("Company rule blocks sending quotations. Escalate instead."),
    };
  }
  if (ctx.operationalRuleKeys?.includes("NEVER_APPLY_DISCOUNT") && toolName === "quotation_prepare_draft") {
    // Drafts are still allowed; discounts remain impossible via tools.
  }
  if (ctx.operationalRuleKeys?.includes("NEVER_CHANGE_DEAL_STAGE")) {
    // No deal-stage tools exist; keep the restriction documented for policy.
  }

  const validation = validateToolInput(toolName, rawInput);
  if (!validation.ok) {
    return {
      toolName,
      status: "INVALID",
      riskLevel: metadata.riskLevel,
      result: toolFailure(validation.error),
    };
  }

  if (
    toolName === "viewing.schedule" &&
    ctx.settings.realEstate?.requireViewingApproval &&
    !opts?.humanApproved
  ) {
    return {
      toolName,
      status: "BLOCKED",
      riskLevel: metadata.riskLevel,
      blockedReason: "Viewing confirmation requires listing agent approval.",
      result: toolFailure(
        "Blocked: viewing confirmation requires listing agent approval. Use viewing.request_approval and tell the customer you are checking with the agent. A human can approve the schedule action in the Hub."
      ),
    };
  }

  if (opts?.humanApproved) {
    if (metadata.riskLevel === "VERY_HIGH") {
      return {
        toolName,
        status: "BLOCKED",
        riskLevel: metadata.riskLevel,
        blockedReason: "Restricted actions cannot be approved for the agent.",
        result: toolFailure("This action is never available to SegmiQ Agent."),
      };
    }
    if (metadata.capability && !ctx.settings[metadata.capability]) {
      return {
        toolName,
        status: "BLOCKED",
        riskLevel: metadata.riskLevel,
        blockedReason: `Company settings disable this capability (${String(metadata.capability)}).`,
        result: toolFailure("Company settings disable this capability."),
      };
    }
  } else {
    // ASSIST mode: internal-safe tools still work so the agent can draft +
    // escalate; everything else is policy-checked below.
    const assistException =
      ctx.settings.autonomyMode === "ASSIST" && ASSIST_SAFE_TOOLS.has(toolName);
    if (!assistException) {
      const decision = evaluateToolPolicy(metadata, ctx.settings);
      if (!decision.allowed) {
        return {
          toolName,
          status: "BLOCKED",
          riskLevel: metadata.riskLevel,
          blockedReason: decision.reason,
          result: toolFailure(
            `Blocked by company policy: ${decision.reason} Do not perform this action; adjust your plan (e.g. notify the owner or escalate).`
          ),
        };
      }
    }
  }

  // Company Brain Test Agent: mutating tools never touch CRM / WhatsApp, even
  // when there is no real lead. Read-only lookups still run.
  if (ctx.standalone && !metadata.readOnly) {
    return {
      toolName,
      status: "SIMULATED",
      riskLevel: metadata.riskLevel,
      result: toolSuccess({
        simulated: true,
        would_call: toolName,
        arguments: validation.data as Record<string, unknown>,
      }),
    };
  }

  try {
    const result = await EXECUTORS[toolName](ctx, validation.data as never);
    const simulated = ctx.testMode && !metadata.readOnly;
    return {
      toolName,
      status: result.ok ? (simulated ? "SIMULATED" : "EXECUTED") : "FAILED",
      riskLevel: metadata.riskLevel,
      result,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[agent] tool ${toolName} threw`, err);
    return {
      toolName,
      status: "FAILED",
      riskLevel: metadata.riskLevel,
      result: toolFailure(
        `The ${toolName} operation failed (${message.slice(0, 200)}). Do not claim this action succeeded. Consider notifying the team or escalating.`
      ),
    };
  }
}
