import { z } from "zod";
import type { AgentToolDefinition } from "@/lib/agent/provider";
import { sanitizeConfigText } from "@/lib/agent/prompt";
import { addDays, startOfDay } from "date-fns";
import { now } from "@/lib/clock";
import { resolveNaturalDateTime } from "@/lib/agent/dates";
import { LOST_REASONS } from "@/lib/call-log-constants";
import { getManagerAttention, attentionReply } from "./attention";
import {
  comparePeriods,
  explainDeal,
  getCustomer360,
  getPipelineSummary,
  resolveLeadsByName,
  resolveUserByName,
  searchAppointments,
  searchConversations,
  searchAgentExecutions,
  searchDeals,
  searchFollowUps,
  searchLeads,
  searchProactive,
  searchQuotations,
  searchSupport,
  searchProducts,
  searchPackages,
  getInventoryAvailability,
  searchLearning,
  getLearningSummary,
} from "./query";
import { previousComparableRange, resolveDatePreset, isDatePreset } from "./dates";
import {
  cancelProactiveAction,
  closeDealAction,
  createFollowUpsAction,
  decideQuotationAction,
  pauseOrResumeAgent,
  previewReassign,
  quotationPreview,
  reassignLeadsAction,
  updateDealStageAction,
} from "./actions";
import { createConfirmation } from "./confirmations";
import { evaluateWritePolicy } from "./policy";
import type { ManagerActor, ManagerBlock, ResultRow, TableBlock } from "./types";
import { formatDealValue } from "@/lib/sales/sales-dashboard-display";

export type ToolRun = {
  name: string;
  ok: boolean;
  summary: Record<string, unknown>;
  blocks: ManagerBlock[];
  phase: string;
};

const searchLeadsArgs = z.object({
  status: z.array(z.string()).optional(),
  ownerName: z.string().max(80).optional(),
  hot: z.boolean().optional(),
  uncontacted: z.boolean().optional(),
  unassigned: z.boolean().optional(),
  facebook: z.boolean().optional(),
  sourceContains: z.string().max(40).optional(),
  hasDeal: z.boolean().optional(),
  createdPreset: z.string().optional(),
});

const searchDealsArgs = z.object({
  stage: z.array(z.string()).optional(),
  ownerName: z.string().max(80).optional(),
  minValue: z.number().nonnegative().optional(),
  noNextAction: z.boolean().optional(),
  noQuotation: z.boolean().optional(),
  inactiveDays: z.number().int().min(1).max(90).optional(),
});

const searchQuotesArgs = z.object({
  pendingApproval: z.boolean().optional(),
  status: z.array(z.string()).optional(),
  minTotal: z.number().nonnegative().optional(),
  expiringDays: z.number().int().min(1).max(30).optional(),
  declined: z.boolean().optional(),
  sentPreset: z.string().optional(),
});

export const MANAGER_TOOL_DEFINITIONS: AgentToolDefinition[] = [
  { name: "get_attention", description: "Deterministic list of what needs the manager's attention now.", inputSchema: { type: "object", properties: {} } },
  { name: "get_brief", description: "Today's sales brief from live operational counts.", inputSchema: { type: "object", properties: {} } },
  { name: "search_leads", description: "Search Leads with structured filters. Never invent scores.", inputSchema: { type: "object", properties: { status: { type: "array", items: { type: "string" } }, ownerName: { type: "string" }, hot: { type: "boolean" }, uncontacted: { type: "boolean" }, unassigned: { type: "boolean" }, facebook: { type: "boolean" }, hasDeal: { type: "boolean" }, createdPreset: { type: "string" } } } },
  { name: "search_deals", description: "Search Deals. Value is quoted/estimated Deal value, never called revenue unless stage is Won.", inputSchema: { type: "object", properties: { stage: { type: "array", items: { type: "string" } }, ownerName: { type: "string" }, minValue: { type: "number" }, noNextAction: { type: "boolean" }, noQuotation: { type: "boolean" }, inactiveDays: { type: "number" } } } },
  { name: "search_quotations", description: "Search quotations. Use pendingApproval for the approval queue.", inputSchema: { type: "object", properties: { pendingApproval: { type: "boolean" }, status: { type: "array", items: { type: "string" } }, minTotal: { type: "number" }, expiringDays: { type: "number" }, declined: { type: "boolean" }, sentPreset: { type: "string" } } } },
  { name: "search_products", description: "Search products and services. Selling prices are live catalogue prices.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "search_packages", description: "Search commercial packages.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "get_inventory_availability", description: "Stock on hand / reserved / available for a product.", inputSchema: { type: "object", properties: { productId: { type: "string" } }, required: ["productId"] } },
  { name: "adjust_inventory", description: "Adjust on-hand stock. Always requires confirmation. Does not change quotations.", inputSchema: { type: "object", properties: { productId: { type: "string" }, locationId: { type: "string" }, delta: { type: "number" }, reason: { type: "string" }, note: { type: "string" } }, required: ["productId", "locationId", "delta", "reason"] } },
  { name: "search_follow_ups", description: "Canonical follow-up work on leads.follow_up_date.", inputSchema: { type: "object", properties: { overdue: { type: "boolean" }, ownerName: { type: "string" } } } },
  { name: "search_appointments", description: "Callbacks on call_logs.callback_at.", inputSchema: { type: "object", properties: { preset: { type: "string" } } } },
  { name: "search_conversations", description: "WhatsApp conversations / Agent state.", inputSchema: { type: "object", properties: { waiting: { type: "boolean" }, humanNeeded: { type: "boolean" }, support: { type: "boolean" } } } },
  { name: "search_agent_executions", description: "SegmiQ Agent execution history for customer WhatsApp conversations. Use preset overnight for what the agent handled since close of business.", inputSchema: { type: "object", properties: { preset: { type: "string", enum: ["overnight", "today", "last_7"] } } } },
  { name: "get_overnight_agent_summary", description: "Summarise what SegmiQ Agent handled overnight for a real-estate company: completions, replies sent, viewing approvals, handoffs.", inputSchema: { type: "object", properties: {} } },
  { name: "search_support", description: "Open support cases.", inputSchema: { type: "object", properties: {} } },
  { name: "search_proactive", description: "Scheduled/skipped/failed Proactive Agent evaluations — not guaranteed messages.", inputSchema: { type: "object", properties: { failed: { type: "boolean" }, skipped: { type: "boolean" }, preset: { type: "string" } } } },
  { name: "get_pipeline_summary", description: "Counts and quoted value by Deal stage. Backend arithmetic only.", inputSchema: { type: "object", properties: {} } },
  { name: "compare_periods", description: "Compare this week vs last week (or other presets) using backend aggregates.", inputSchema: { type: "object", properties: { currentPreset: { type: "string" } } } },
  { name: "get_customer_360", description: "Concise customer snapshot. Pass leadId from prior results.", inputSchema: { type: "object", properties: { leadId: { type: "string" }, customerName: { type: "string" } }, } },
  { name: "explain_deal", description: "Evidence-based explanation of why a Deal is stuck. Label inference as likely, not certain.", inputSchema: { type: "object", properties: { dealId: { type: "string" } } } },
  { name: "resolve_person", description: "Resolve a salesperson or customer name. If multiple matches, do not pick arbitrarily.", inputSchema: { type: "object", properties: { name: { type: "string" }, kind: { type: "string", enum: ["user", "customer"] } }, required: ["name", "kind"] } },
  { name: "preview_reassign_leads", description: "Preview reassignment. Does not write. Always preview before bulk writes.", inputSchema: { type: "object", properties: { fromName: { type: "string" }, toName: { type: "string" } }, required: ["fromName", "toName"] } },
  { name: "create_follow_ups", description: "Create canonical follow-up dates. Preview if more than one record.", inputSchema: { type: "object", properties: { leadIds: { type: "array", items: { type: "string" } }, duePhrase: { type: "string" } }, required: ["leadIds"] } },
  { name: "approve_quotation", description: "Preview then approve a pending quotation. Server enforces permission and current version.", inputSchema: { type: "object", properties: { quotationId: { type: "string" } }, required: ["quotationId"] } },
  { name: "reject_quotation", description: "Reject a pending quotation.", inputSchema: { type: "object", properties: { quotationId: { type: "string" }, note: { type: "string" } }, required: ["quotationId"] } },
  { name: "request_quote_changes", description: "Request changes on a pending quotation. Does not edit line items.", inputSchema: { type: "object", properties: { quotationId: { type: "string" }, note: { type: "string" } }, required: ["quotationId", "note"] } },
  { name: "update_deal_stage", description: "Move a Deal to QUALIFIED, SCOPING, PROPOSAL_SENT, or NEGOTIATING. Won/Lost use close tools.", inputSchema: { type: "object", properties: { dealId: { type: "string" }, stage: { type: "string" } }, required: ["dealId", "stage"] } },
  { name: "close_deal_won", description: "Mark Deal Won. Always requires confirmation. Do not call unless the manager explicitly asked.", inputSchema: { type: "object", properties: { dealId: { type: "string" }, wonValue: { type: "number" } }, required: ["dealId"] } },
  { name: "close_deal_lost", description: "Mark Deal Lost. lostReason is required from the company list — never default to Other.", inputSchema: { type: "object", properties: { dealId: { type: "string" }, lostReason: { type: "string" } }, required: ["dealId", "lostReason"] } },
  { name: "pause_agent", description: "Pause SegmiQ Agent on a conversation.", inputSchema: { type: "object", properties: { leadId: { type: "string" } }, required: ["leadId"] } },
  { name: "resume_agent", description: "Let the Agent handle the conversation again.", inputSchema: { type: "object", properties: { leadId: { type: "string" } }, required: ["leadId"] } },
  { name: "cancel_proactive_job", description: "Cancel a scheduled Proactive evaluation.", inputSchema: { type: "object", properties: { jobId: { type: "string" } }, required: ["jobId"] } },
  { name: "search_learning", description: "Search Learning Center candidates. Use conflicts, corrections, or faqs filters. Never invent evidence counts.", inputSchema: { type: "object", properties: { conflicts: { type: "boolean" }, corrections: { type: "boolean" }, faqs: { type: "boolean" }, sinceDays: { type: "number" } } } },
  { name: "get_learning_summary", description: "Grounded summary of what SegmiQ observed from the sales team. Counts only, no fake readiness scores.", inputSchema: { type: "object", properties: { sinceDays: { type: "number" } } } },
  { name: "approve_learning_candidate", description: "Approve a LOW or MEDIUM risk Learning Candidate after confirmation. High-risk commercial learning must use Learning Center.", inputSchema: { type: "object", properties: { candidateId: { type: "string" } }, required: ["candidateId"] } },
  { name: "reject_learning_candidate", description: "Reject a Learning Candidate after confirmation.", inputSchema: { type: "object", properties: { candidateId: { type: "string" }, reason: { type: "string" } }, required: ["candidateId"] } },
];

function tableReply(block: TableBlock): string {
  if (!block.rows.length) return `No ${block.title.toLowerCase()} matched.`;
  const extra = block.truncated ? ` Showing ${block.rows.length}; refine filters for more.` : "";
  return `${block.totalMatched} ${block.title.toLowerCase()}.${extra}`;
}

async function ownerIdFromName(actor: ManagerActor, name?: string): Promise<{ id?: string; block?: ManagerBlock }> {
  if (!name) return {};
  const matches = await resolveUserByName(actor, name);
  if (matches.length === 0) return { block: { type: "status", kind: "error", message: `No team member named ${name}.` } };
  if (matches.length > 1) {
    return {
      block: {
        type: "disambiguation",
        prompt: `Which ${name}?`,
        options: matches.map((m) => ({
          id: m.id,
          entityType: "USER" as const,
          title: m.name,
          subtitle: "Team member",
          status: null,
          valueLabel: null,
          ownerName: null,
          ownerId: m.id,
          href: `/client/team/${m.id}`,
          meta: {},
        })),
      },
    };
  }
  return { id: matches[0]!.id };
}

function dueDateFromPhrase(phrase: string | undefined, timezone: string): string {
  if (!phrase) return addDays(startOfDay(now()), 1).toISOString().slice(0, 10);
  const resolved = resolveNaturalDateTime(phrase, { timezone });
  if (resolved) return resolved.localDate;
  return addDays(startOfDay(now()), 1).toISOString().slice(0, 10);
}

async function maybeConfirm(opts: {
  actor: ManagerActor;
  sessionId: string;
  toolName: string;
  args: Record<string, unknown>;
  preview: import("./types").ConfirmationPreview;
  versions?: Record<string, string>;
  execute: () => Promise<ToolRun>;
}): Promise<ToolRun> {
  const policy = await evaluateWritePolicy({
    actor: opts.actor,
    toolName: opts.toolName,
    recordCount: opts.preview.records.length || 1,
    dealId: typeof opts.args.dealId === "string" ? opts.args.dealId : undefined,
  });
  if (!policy.allowed) {
    return {
      name: opts.toolName,
      ok: false,
      summary: { error: policy.reason, code: policy.code },
      blocks: [{ type: "status", kind: "denied", message: policy.reason }],
      phase: "Permission check",
    };
  }
  if (policy.confirmationRequired) {
    const confirmation = await createConfirmation({
      actor: opts.actor,
      sessionId: opts.sessionId,
      toolName: opts.toolName,
      args: opts.args,
      entityVersions: opts.versions ?? {},
      preview: opts.preview,
    });
    return {
      name: opts.toolName,
      ok: true,
      summary: { status: "NEEDS_CONFIRMATION", confirmationId: confirmation.id },
      blocks: [{ type: "confirmation", confirmationId: confirmation.id, preview: opts.preview }],
      phase: "Waiting for confirmation",
    };
  }
  return opts.execute();
}

async function runInventoryAdjust(
  actor: ManagerActor,
  opts: { productId: string; locationId: string; delta: number; reason: string; note: string | null }
): Promise<ToolRun> {
  const { adjustStock } = await import("@/lib/inventory/service");
  const result = await adjustStock({
    clientId: actor.clientId,
    productId: opts.productId,
    locationId: opts.locationId,
    delta: opts.delta,
    reason: opts.reason,
    note: opts.note,
    actorId: actor.userId,
  });
  return {
    name: "adjust_inventory",
    ok: !result.error,
    summary: result as unknown as Record<string, unknown>,
    blocks: [
      {
        type: "status",
        kind: result.error ? "error" : "done",
        message: result.error ?? `On hand is now ${result.onHand}. Available ${result.available}.`,
      },
    ],
    phase: "Adjusting inventory",
  };
}

async function runApproveLearning(actor: ManagerActor, candidateId: string): Promise<ToolRun> {
  const { getCandidate, approveCandidate } = await import("@/lib/agent/learning/store");
  const candidate = await getCandidate(actor.clientId, candidateId);
  if (!candidate) {
    return {
      name: "approve_learning_candidate",
      ok: false,
      summary: {},
      blocks: [{ type: "status", kind: "error", message: "Learning candidate not found in this company." }],
      phase: "Approving learning",
    };
  }
  if (candidate.riskLevel === "HIGH" || candidate.riskLevel === "VERY_HIGH") {
    return {
      name: "approve_learning_candidate",
      ok: false,
      summary: { href: `/client/agent/learning?candidate=${candidateId}` },
      blocks: [
        {
          type: "status",
          kind: "denied",
          message: "High-risk commercial learning must be reviewed in Learning Center. Command Center cannot silently change policy.",
        },
      ],
      phase: "Approving learning",
    };
  }
  const knowledge = await approveCandidate({
    clientId: actor.clientId,
    candidateId,
    actorId: actor.userId,
    destination: "LEARNED_KNOWLEDGE",
  });
  return {
    name: "approve_learning_candidate",
    ok: Boolean(knowledge),
    summary: { knowledgeId: knowledge?.id ?? null },
    blocks: [
      {
        type: "status",
        kind: knowledge ? "done" : "error",
        message: knowledge
          ? `Approved as Learned Knowledge: ${knowledge.title}. Company Brain was not rewritten.`
          : "Could not approve this candidate.",
      },
    ],
    phase: "Approving learning",
  };
}

async function runRejectLearning(actor: ManagerActor, candidateId: string, reason: string): Promise<ToolRun> {
  const { rejectCandidate } = await import("@/lib/agent/learning/store");
  await rejectCandidate({
    clientId: actor.clientId,
    candidateId,
    actorId: actor.userId,
    reason,
    feedback: null,
  });
  return {
    name: "reject_learning_candidate",
    ok: true,
    summary: { candidateId },
    blocks: [{ type: "status", kind: "done", message: "Candidate rejected. Similar suggestions will be suppressed." }],
    phase: "Rejecting learning",
  };
}

export async function executeManagerTool(opts: {
  actor: ManagerActor;
  sessionId: string;
  name: string;
  input: Record<string, unknown>;
  timezone: string;
}): Promise<ToolRun> {
  const { actor, name } = opts;
  const input = opts.input;

  if (name === "get_attention" || name === "get_brief") {
    const snapshot = await getManagerAttention(actor);
    const reply = name === "get_brief" ? briefFromSnapshot(snapshot) : attentionReply(snapshot);
    return {
      name,
      ok: true,
      summary: { groups: snapshot.groups, brief: snapshot.brief },
      blocks: [
        { type: "text", text: reply },
        { type: "attention", snapshot },
        { type: "sources", asOf: snapshot.asOf, counts: snapshot.sources },
        {
          type: "suggestions",
          actions: [
            { label: "Approval queue", prompt: "Show quotations waiting for approval" },
            { label: "Customers waiting", prompt: "Which customers are waiting for us?" },
            { label: "Deals at risk", prompt: "Show Deals with no next action" },
          ],
        },
      ],
      phase: name === "get_brief" ? "Preparing today's brief" : "Checking what needs attention",
    };
  }

  if (name === "search_leads") {
    const args = searchLeadsArgs.parse(input);
    const owner = await ownerIdFromName(actor, args.ownerName);
    if (owner.block) return { name, ok: true, summary: {}, blocks: [owner.block], phase: "Resolving owner" };
    const block = await searchLeads(actor, {
      ...args,
      ownerId: owner.id,
      createdRange: args.createdPreset && isDatePreset(args.createdPreset) ? resolveDatePreset(args.createdPreset) : undefined,
    });
    return { name, ok: true, summary: { count: block.totalMatched }, blocks: [block, { type: "text", text: tableReply(block) }], phase: "Searching Leads" };
  }

  if (name === "search_deals") {
    const args = searchDealsArgs.parse(input);
    const owner = await ownerIdFromName(actor, args.ownerName);
    if (owner.block) return { name, ok: true, summary: {}, blocks: [owner.block], phase: "Resolving owner" };
    const block = await searchDeals(actor, { ...args, ownerId: owner.id });
    return { name, ok: true, summary: { count: block.totalMatched }, blocks: [block, { type: "text", text: tableReply(block) }], phase: "Searching Deals" };
  }

  if (name === "search_quotations") {
    const args = searchQuotesArgs.parse(input);
    const block = await searchQuotations(actor, {
      ...args,
      sentRange: args.sentPreset && isDatePreset(args.sentPreset) ? resolveDatePreset(args.sentPreset) : undefined,
    });
    return { name, ok: true, summary: { count: block.totalMatched }, blocks: [block, { type: "text", text: tableReply(block) }], phase: "Reviewing quotations" };
  }

  if (name === "search_products") {
    const q = String(input.query ?? "");
    const block = await searchProducts(actor, q);
    return { name, ok: true, summary: { matched: block.totalMatched }, blocks: [{ type: "text", text: tableReply(block) }, block], phase: "Searching products" };
  }
  if (name === "search_packages") {
    const q = String(input.query ?? "");
    const block = await searchPackages(actor, q);
    return { name, ok: true, summary: { matched: block.totalMatched }, blocks: [{ type: "text", text: tableReply(block) }, block], phase: "Searching packages" };
  }
  if (name === "get_inventory_availability") {
    const productId = String(input.productId ?? "");
    const avail = await getInventoryAvailability(actor, productId);
    return {
      name,
      ok: true,
      summary: { available: avail.available, onHand: avail.onHand, reserved: avail.reserved, status: avail.status },
      blocks: [
        {
          type: "text",
          text: avail.trackInventory
            ? `${avail.available} available (${avail.onHand} on hand, ${avail.reserved} reserved).`
            : "This product is not stock-tracked.",
        },
      ],
      phase: "Inventory",
    };
  }
  if (name === "adjust_inventory") {
    const productId = String(input.productId ?? "");
    const locationId = String(input.locationId ?? "");
    const delta = Number(input.delta);
    const reason = String(input.reason ?? "");
    const note = typeof input.note === "string" ? input.note : null;
    return maybeConfirm({
      actor,
      sessionId: opts.sessionId,
      toolName: name,
      args: { productId, locationId, delta, reason, note },
      preview: {
        title: "Adjust inventory",
        summary: `Change on-hand by ${delta} for this product. Quotations are not reserved or deducted.`,
        records: [{ id: productId, label: productId }],
        risk: "HIGH",
      },
      execute: () => runInventoryAdjust(actor, { productId, locationId, delta, reason, note }),
    });
  }

  if (name === "search_follow_ups") {
    const overdue = Boolean(input.overdue);
    const owner = await ownerIdFromName(actor, typeof input.ownerName === "string" ? input.ownerName : undefined);
    if (owner.block) return { name, ok: true, summary: {}, blocks: [owner.block], phase: "Resolving owner" };
    const block = await searchFollowUps(actor, { overdue, ownerId: owner.id });
    return { name, ok: true, summary: { count: block.totalMatched }, blocks: [block], phase: "Checking follow-ups" };
  }

  if (name === "search_appointments") {
    const preset = typeof input.preset === "string" && isDatePreset(input.preset) ? resolveDatePreset(input.preset) : resolveDatePreset("today");
    const block = await searchAppointments(actor, preset);
    return { name, ok: true, summary: { count: block.totalMatched }, blocks: [block], phase: "Checking the calendar" };
  }

  if (name === "search_conversations") {
    const block = await searchConversations(actor, {
      waiting: Boolean(input.waiting),
      humanNeeded: Boolean(input.humanNeeded),
      support: Boolean(input.support),
      viewingApproval: Boolean(input.viewingApproval),
    });
    return { name, ok: true, summary: { count: block.totalMatched }, blocks: [block], phase: "Checking conversations" };
  }

  if (name === "search_agent_executions") {
    const preset =
      input.preset === "today" || input.preset === "last_7" || input.preset === "overnight"
        ? input.preset
        : "overnight";
    const block = await searchAgentExecutions(actor, { preset });
    return {
      name,
      ok: true,
      summary: { count: block.totalMatched, preset },
      blocks: [block, { type: "text", text: tableReply(block) }],
      phase: "Reviewing SegmiQ Agent activity",
    };
  }

  if (name === "get_overnight_agent_summary") {
    const { loadOvernightAgentSummary } = await import("@/lib/agent/real-estate/overnight-summary");
    const summary = await loadOvernightAgentSummary({ clientId: actor.clientId });
    const text = [
      summary.summaryLine,
      "",
      ...summary.highlights.map((line) => `• ${line}`),
      summary.topTools.length
        ? `\nTop tools: ${summary.topTools.map((t) => `${t.tool} (${t.count})`).join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    return {
      name,
      ok: true,
      summary: summary as unknown as Record<string, unknown>,
      blocks: [
        { type: "text", text },
        {
          type: "suggestions",
          actions: [
            { label: "Viewing approvals", prompt: "Show viewing approvals waiting" },
            { label: "Agent activity", prompt: "What did SegmiQ Agent handle overnight?" },
          ],
        },
      ],
      phase: "Summarising overnight Agent activity",
    };
  }

  if (name === "search_support") {
    const block = await searchSupport(actor);
    return { name, ok: true, summary: { count: block.totalMatched }, blocks: [block], phase: "Checking support" };
  }

  if (name === "search_proactive") {
    const preset = typeof input.preset === "string" && isDatePreset(input.preset) ? resolveDatePreset(input.preset) : undefined;
    const block = await searchProactive(actor, {
      failed: Boolean(input.failed),
      skipped: Boolean(input.skipped),
      range: preset,
    });
    return { name, ok: true, summary: { count: block.totalMatched }, blocks: [block], phase: "Checking scheduled Agent work" };
  }

  if (name === "get_pipeline_summary") {
    const summary = await getPipelineSummary(actor);
    const lines = summary.stages.map((s) => `${s.label}: ${s.count} Deals · ${s.quotedValueLabel} quoted value`);
    return {
      name,
      ok: true,
      summary: summary as unknown as Record<string, unknown>,
      blocks: [
        { type: "text", text: [`${summary.activeDeals} active Deals.`, ...lines].join("\n") },
      ],
      phase: "Summarising the pipeline",
    };
  }

  if (name === "compare_periods") {
    const current = resolveDatePreset(
      typeof input.currentPreset === "string" && isDatePreset(input.currentPreset) ? input.currentPreset : "this_week"
    );
    const comparison = await comparePeriods(actor, current, previousComparableRange(current));
    const text = comparison.metrics
      .map((m) => `${m.label}\n${comparison.currentLabel}: ${m.current}\n${comparison.previousLabel}: ${m.previous}\n${m.change}`)
      .join("\n\n");
    return { name, ok: true, summary: comparison as unknown as Record<string, unknown>, blocks: [{ type: "text", text }], phase: "Comparing periods" };
  }

  if (name === "get_customer_360") {
    let leadId = typeof input.leadId === "string" ? input.leadId : "";
    if (!leadId && typeof input.customerName === "string") {
      const matches = await resolveLeadsByName(actor, input.customerName);
      if (matches.length === 0) {
        return { name, ok: false, summary: {}, blocks: [{ type: "status", kind: "error", message: "No matching customer." }], phase: "Resolving customer" };
      }
      if (matches.length > 1) {
        return { name, ok: true, summary: {}, blocks: [{ type: "disambiguation", prompt: "Which customer?", options: matches }], phase: "Resolving customer" };
      }
      leadId = matches[0]!.id;
    }
    const data = await getCustomer360(actor, leadId);
    if (!data) return { name, ok: false, summary: {}, blocks: [{ type: "status", kind: "error", message: "Customer not found in this company." }], phase: "Loading customer" };
    return { name, ok: true, summary: data as unknown as Record<string, unknown>, blocks: [{ type: "customer360", data }], phase: "Loading customer" };
  }

  if (name === "explain_deal") {
    const dealId = String(input.dealId ?? "");
    const data = await explainDeal(actor, dealId);
    if (!data) return { name, ok: false, summary: {}, blocks: [{ type: "status", kind: "error", message: "Deal not found." }], phase: "Explaining Deal" };
    const text = [data.evidence.join(" "), data.inference ? `\n${data.inference}` : ""].join("");
    return { name, ok: true, summary: data as unknown as Record<string, unknown>, blocks: [{ type: "text", text }], phase: "Explaining Deal" };
  }

  if (name === "resolve_person") {
    const kind = input.kind === "user" ? "user" : "customer";
    const label = sanitizeConfigText(String(input.name ?? ""), 80);
    if (kind === "user") {
      const matches = await resolveUserByName(actor, label);
      if (matches.length !== 1) {
        const options: ResultRow[] = matches.map((m) => ({
          id: m.id,
          entityType: "USER",
          title: m.name,
          subtitle: "Team member",
          status: null,
          valueLabel: null,
          ownerName: null,
          ownerId: m.id,
          href: `/client/team/${m.id}`,
          meta: {},
        }));
        return { name, ok: true, summary: { matches: matches.length }, blocks: [{ type: "disambiguation", prompt: `Which ${label}?`, options }], phase: "Resolving name" };
      }
      return { name, ok: true, summary: { id: matches[0]!.id, name: matches[0]!.name }, blocks: [], phase: "Resolving name" };
    }
    const matches = await resolveLeadsByName(actor, label);
    if (matches.length !== 1) {
      return { name, ok: true, summary: { matches: matches.length }, blocks: [{ type: "disambiguation", prompt: `Which ${label}?`, options: matches }], phase: "Resolving name" };
    }
    return { name, ok: true, summary: { id: matches[0]!.id, name: matches[0]!.title }, blocks: [], phase: "Resolving name" };
  }

  if (name === "preview_reassign_leads") {
    const from = await ownerIdFromName(actor, String(input.fromName ?? ""));
    const to = await ownerIdFromName(actor, String(input.toName ?? ""));
    if (from.block) return { name, ok: true, summary: {}, blocks: [from.block], phase: "Resolving people" };
    if (to.block) return { name, ok: true, summary: {}, blocks: [to.block], phase: "Resolving people" };
    const preview = await previewReassign({ actor, fromUserId: from.id!, toUserId: to.id! });
    return maybeConfirm({
      actor,
      sessionId: opts.sessionId,
      toolName: "reassign_leads",
      args: { leadIds: preview.leadIds, toUserId: to.id },
      preview: {
        title: "Reassign Leads",
        summary: `${preview.count} Leads will be reassigned.`,
        breakdown: [
          { label: "HOT", value: String(preview.hot) },
          { label: "Will not change", value: "Deal ownership, appointments, or existing follow-up dates" },
        ],
        records: preview.records,
        risk: "HIGH",
      },
      execute: async () => {
        const result = await reassignLeadsAction({ actor, leadIds: preview.leadIds, toUserId: to.id! });
        return { name, ok: result.ok, summary: result as unknown as Record<string, unknown>, blocks: [{ type: "status", kind: result.failed ? "partial" : "done", message: result.message }], phase: "Reassigning" };
      },
    });
  }

  if (name === "create_follow_ups") {
    const leadIds = z.array(z.string()).min(1).max(100).parse(input.leadIds);
    const dueDate = dueDateFromPhrase(typeof input.duePhrase === "string" ? input.duePhrase : "tomorrow", opts.timezone);
    return maybeConfirm({
      actor,
      sessionId: opts.sessionId,
      toolName: "create_follow_ups",
      args: { leadIds, dueDate },
      preview: {
        title: "Create follow-ups",
        summary: `This will create ${leadIds.length} follow-up${leadIds.length === 1 ? "" : "s"} due ${dueDate}.`,
        records: leadIds.map((id) => ({ id, label: id })),
        risk: leadIds.length > 1 ? "HIGH" : "LOW",
      },
      execute: async () => {
        const result = await createFollowUpsAction({ actor, leadIds, dueDate });
        return { name, ok: result.ok, summary: result as unknown as Record<string, unknown>, blocks: [{ type: "status", kind: result.failed ? "partial" : "done", message: result.message }], phase: "Creating follow-ups" };
      },
    });
  }

  if (name === "approve_quotation" || name === "reject_quotation" || name === "request_quote_changes") {
    const quotationId = String(input.quotationId ?? "");
    const q = await quotationPreview(actor, quotationId);
    if (!q) {
      return { name, ok: false, summary: {}, blocks: [{ type: "status", kind: "error", message: "Quotation not found." }], phase: "Loading quotation" };
    }
    const decision = name === "approve_quotation" ? "approve" : name === "reject_quotation" ? "reject" : "request_changes";
    const total = typeof q.total === "number" ? formatDealValue(q.total) : "—";
    return maybeConfirm({
      actor,
      sessionId: opts.sessionId,
      toolName: name,
      args: { quotationId, decision, note: input.note ?? null },
      versions: { [`quotations:${quotationId}`]: String(q.updated_at ?? "") },
      preview: {
        title: decision === "approve" ? "Approve quotation" : decision === "reject" ? "Reject quotation" : "Request changes",
        summary: `${q.quote_number || "Quotation"} · ${q.customer_name || "Customer"} · ${total}`,
        breakdown: [
          { label: "Discount", value: q.discount_percent != null ? `${q.discount_percent}%` : "—" },
          { label: "Revision", value: String(q.revision_number ?? 1) },
        ],
        records: [{ id: quotationId, label: String(q.quote_number || quotationId) }],
        risk: "HIGH",
      },
      execute: async () => {
        const result = await decideQuotationAction({
          actor,
          quotationId,
          decision,
          note: typeof input.note === "string" ? input.note : null,
        });
        return { name, ok: result.ok, summary: result as unknown as Record<string, unknown>, blocks: [{ type: "status", kind: result.ok ? "done" : "error", message: result.message }], phase: "Updating quotation" };
      },
    });
  }

  if (name === "update_deal_stage") {
    const dealId = String(input.dealId ?? "");
    const stage = String(input.stage ?? "") as "QUALIFIED" | "SCOPING" | "PROPOSAL_SENT" | "NEGOTIATING";
    return maybeConfirm({
      actor,
      sessionId: opts.sessionId,
      toolName: name,
      args: { dealId, stage },
      preview: {
        title: "Move Deal",
        summary: `Move this Deal to ${stage.replace(/_/g, " ").toLowerCase()}?`,
        records: [{ id: dealId, label: dealId }],
        risk: "HIGH",
      },
      execute: async () => {
        const result = await updateDealStageAction({ actor, dealId, stage });
        return { name, ok: result.ok, summary: result as unknown as Record<string, unknown>, blocks: [{ type: "status", kind: result.ok ? "done" : "denied", message: result.message }], phase: "Updating Deal" };
      },
    });
  }

  if (name === "close_deal_won" || name === "close_deal_lost") {
    const dealId = String(input.dealId ?? "");
    if (name === "close_deal_lost") {
      const reason = String(input.lostReason ?? "");
      if (!(LOST_REASONS as readonly string[]).includes(reason)) {
        return {
          name,
          ok: false,
          summary: { lostReasons: LOST_REASONS },
          blocks: [{ type: "status", kind: "error", message: `A lost reason is required. Choose one of: ${LOST_REASONS.join(", ")}.` }],
          phase: "Closing Deal",
        };
      }
    }
    return maybeConfirm({
      actor,
      sessionId: opts.sessionId,
      toolName: name,
      args: input,
      preview: {
        title: name === "close_deal_won" ? "Mark Deal Won" : "Mark Deal Lost",
        summary: name === "close_deal_won" ? "This will mark the Deal as Won." : `Lost reason: ${String(input.lostReason)}`,
        records: [{ id: dealId, label: dealId }],
        risk: "HIGH",
      },
      execute: async () => {
        const result = await closeDealAction({
          actor,
          dealId,
          outcome: name === "close_deal_won" ? "WON" : "LOST",
          wonValue: typeof input.wonValue === "number" ? input.wonValue : undefined,
          lostReason: typeof input.lostReason === "string" ? input.lostReason : undefined,
        });
        return { name, ok: result.ok, summary: result as unknown as Record<string, unknown>, blocks: [{ type: "status", kind: result.ok ? "done" : "error", message: result.message }], phase: "Closing Deal" };
      },
    });
  }

  if (name === "pause_agent" || name === "resume_agent") {
    const leadId = String(input.leadId ?? "");
    const result = await pauseOrResumeAgent({
      actor,
      leadId,
      action: name === "pause_agent" ? "pause" : "resume",
    });
    return { name, ok: result.ok, summary: result as unknown as Record<string, unknown>, blocks: [{ type: "status", kind: result.ok ? "done" : "error", message: result.message }], phase: "Updating Agent" };
  }

  if (name === "cancel_proactive_job") {
    const jobId = String(input.jobId ?? "");
    return maybeConfirm({
      actor,
      sessionId: opts.sessionId,
      toolName: name,
      args: { jobId },
      preview: {
        title: "Cancel scheduled follow-up",
        summary: "Cancel this scheduled Agent evaluation? The customer will not be contacted for this job.",
        records: [{ id: jobId, label: jobId }],
        risk: "MEDIUM",
      },
      execute: async () => {
        const result = await cancelProactiveAction({ actor, jobId });
        return { name, ok: result.ok, summary: result as unknown as Record<string, unknown>, blocks: [{ type: "status", kind: result.ok ? "done" : "error", message: result.message }], phase: "Cancelling scheduled action" };
      },
    });
  }

  if (name === "search_learning") {
    const block = await searchLearning(actor, {
      conflicts: Boolean(input.conflicts),
      corrections: Boolean(input.corrections),
      faqs: Boolean(input.faqs),
      sinceDays: typeof input.sinceDays === "number" ? input.sinceDays : 7,
    });
    return {
      name,
      ok: true,
      summary: { count: block.totalMatched },
      blocks: [block, { type: "text", text: tableReply(block) }, { type: "suggestions", actions: [{ label: "Open Learning Center", prompt: "Show learning conflicts" }] }],
      phase: "Reviewing Agent Learning",
    };
  }

  if (name === "get_learning_summary") {
    const summary = await getLearningSummary(actor, typeof input.sinceDays === "number" ? input.sinceDays : 7);
    return {
      name,
      ok: true,
      summary: summary as unknown as Record<string, unknown>,
      blocks: [
        { type: "text", text: summary.text },
        {
          type: "suggestions",
          actions: [
            { label: "Review candidates", prompt: "Show new qualification patterns" },
            { label: "Conflicts", prompt: "Where does the sales team contradict Company Brain?" },
          ],
        },
      ],
      phase: "Summarising Agent Learning",
    };
  }

  if (name === "approve_learning_candidate") {
    const candidateId = String(input.candidateId ?? "");
    return maybeConfirm({
      actor,
      sessionId: opts.sessionId,
      toolName: name,
      args: { candidateId },
      preview: {
        title: "Approve learning",
        summary: "Approve this LOW/MEDIUM learning as Learned Knowledge. Company Brain is not rewritten. High-risk commercial learning is blocked.",
        records: [{ id: candidateId, label: candidateId }],
        risk: "HIGH",
      },
      execute: () => runApproveLearning(actor, candidateId),
    });
  }

  if (name === "reject_learning_candidate") {
    const candidateId = String(input.candidateId ?? "");
    const reason = typeof input.reason === "string" ? input.reason : "Rejected from Command Center";
    return maybeConfirm({
      actor,
      sessionId: opts.sessionId,
      toolName: name,
      args: { candidateId, reason },
      preview: {
        title: "Reject learning",
        summary: "Reject this candidate. Similar suggestions will be suppressed until stronger evidence appears.",
        records: [{ id: candidateId, label: candidateId }],
        risk: "HIGH",
      },
      execute: () => runRejectLearning(actor, candidateId, reason),
    });
  }

  return {
    name,
    ok: false,
    summary: { error: "Unknown tool" },
    blocks: [{ type: "status", kind: "unsupported", message: "That action is not available in Command Center." }],
    phase: "Unsupported",
  };
}

export async function executeConfirmedTool(opts: {
  actor: ManagerActor;
  toolName: string;
  args: Record<string, unknown>;
}): Promise<ToolRun> {
  const { actor, toolName, args } = opts;
  if (toolName === "reassign_leads") {
    const leadIds = z.array(z.string()).parse(args.leadIds);
    const toUserId = String(args.toUserId);
    const result = await reassignLeadsAction({ actor, leadIds, toUserId });
    return { name: toolName, ok: result.ok, summary: result as unknown as Record<string, unknown>, blocks: [{ type: "status", kind: result.failed ? "partial" : "done", message: result.message }], phase: "Reassigning" };
  }
  if (toolName === "create_follow_ups") {
    const result = await createFollowUpsAction({
      actor,
      leadIds: z.array(z.string()).parse(args.leadIds),
      dueDate: String(args.dueDate),
    });
    return { name: toolName, ok: result.ok, summary: result as unknown as Record<string, unknown>, blocks: [{ type: "status", kind: result.failed ? "partial" : "done", message: result.message }], phase: "Creating follow-ups" };
  }
  if (toolName === "approve_quotation" || toolName === "reject_quotation" || toolName === "request_quote_changes") {
    const result = await decideQuotationAction({
      actor,
      quotationId: String(args.quotationId),
      decision: (args.decision as "approve" | "reject" | "request_changes") ?? "approve",
      note: typeof args.note === "string" ? args.note : null,
    });
    return { name: toolName, ok: result.ok, summary: result as unknown as Record<string, unknown>, blocks: [{ type: "status", kind: result.ok ? "done" : "error", message: result.message }], phase: "Updating quotation" };
  }
  if (toolName === "update_deal_stage") {
    const result = await updateDealStageAction({
      actor,
      dealId: String(args.dealId),
      stage: args.stage as "QUALIFIED" | "SCOPING" | "PROPOSAL_SENT" | "NEGOTIATING",
    });
    return { name: toolName, ok: result.ok, summary: result as unknown as Record<string, unknown>, blocks: [{ type: "status", kind: result.ok ? "done" : "denied", message: result.message }], phase: "Updating Deal" };
  }
  if (toolName === "close_deal_won" || toolName === "close_deal_lost") {
    const result = await closeDealAction({
      actor,
      dealId: String(args.dealId),
      outcome: toolName === "close_deal_won" ? "WON" : "LOST",
      wonValue: typeof args.wonValue === "number" ? args.wonValue : undefined,
      lostReason: typeof args.lostReason === "string" ? args.lostReason : undefined,
    });
    return { name: toolName, ok: result.ok, summary: result as unknown as Record<string, unknown>, blocks: [{ type: "status", kind: result.ok ? "done" : "error", message: result.message }], phase: "Closing Deal" };
  }
  if (toolName === "cancel_proactive_job") {
    const result = await cancelProactiveAction({ actor, jobId: String(args.jobId) });
    return { name: toolName, ok: result.ok, summary: result as unknown as Record<string, unknown>, blocks: [{ type: "status", kind: result.ok ? "done" : "error", message: result.message }], phase: "Cancelling scheduled action" };
  }
  if (toolName === "adjust_inventory") {
    return runInventoryAdjust(actor, {
      productId: String(args.productId),
      locationId: String(args.locationId),
      delta: Number(args.delta),
      reason: String(args.reason ?? ""),
      note: typeof args.note === "string" ? args.note : null,
    });
  }
  if (toolName === "approve_learning_candidate") {
    return runApproveLearning(actor, String(args.candidateId));
  }
  if (toolName === "reject_learning_candidate") {
    return runRejectLearning(
      actor,
      String(args.candidateId),
      typeof args.reason === "string" ? args.reason : "Rejected from Command Center"
    );
  }
  return {
    name: toolName,
    ok: false,
    summary: {},
    blocks: [{ type: "status", kind: "unsupported", message: "This confirmation is no longer valid." }],
    phase: "Unsupported",
  };
}

function briefFromSnapshot(snapshot: import("./types").AttentionSnapshot): string {
  const b = snapshot.brief;
  const lines = [
    "TODAY'S SALES BRIEF",
    "",
    `Customers: ${b.customersWaiting} waiting for a response`,
    `Quotations: ${b.quoteApprovals} pending approval`,
    `Deals: ${b.dealsNoNextAction} with no next action`,
    `Team: ${b.overdueFollowUps} overdue follow-ups`,
    `Appointments: ${b.appointmentsToday} today`,
    `SegmiQ Agent: ${b.humanNeeded} Human Needed · ${b.failedProactive} failed proactive actions`,
    `Support: ${b.supportOpen} unresolved`,
  ];
  if (typeof b.viewingApprovalsPending === "number" && b.viewingApprovalsPending > 0) {
    lines.push(`Viewings: ${b.viewingApprovalsPending} approval${b.viewingApprovalsPending === 1 ? "" : "s"} waiting`);
  }
  if (typeof b.agentExecutionsOvernight === "number") {
    lines.push(
      `Agent overnight: ${b.agentExecutionsOvernight} handled · ${b.agentRepliesSent ?? 0} repl${(b.agentRepliesSent ?? 0) === 1 ? "y" : "ies"} sent`
    );
  }
  return lines.join("\n");
}

export { reassignLeadsAction, createFollowUpsAction, decideQuotationAction };
