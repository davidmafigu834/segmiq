import { createAdminClient } from "@/lib/supabase/admin";
import { now } from "@/lib/clock";
import { getAgentModelProvider, type AgentChatMessage } from "@/lib/agent/provider";
import { sanitizeConfigText } from "@/lib/agent/prompt";
import { asRow } from "@/lib/agent/rows";
import { assembleCompanyBrainContext, serializeCompanyBrainContext } from "@/lib/company-brain";
import { retrieveApprovedLearning, serializeLearnedKnowledge } from "@/lib/agent/learning/retrieval";
import { wrapUntrustedContent } from "@/lib/company-brain/authority";
import { SALES_PROMPT_VERSION, type SalesActor, type SalesBlock, type SalesIntent, type SalesPageContext, type SalesTurnResult } from "./types";
import { getSalesAgentFlags, salesAgentModelAvailable } from "./settings";
import { looksLikeCancel, looksLikeConfirm, matchFutureSalesCommand, matchUnsupportedSalesCommand } from "./policy";
import { EMIT_INTENT_TOOL, heuristicParseSalesIntent, validateSalesIntent } from "./intents";
import { buildSalesSystemPrompt } from "./prompt";
import { appendSalesMessage, createOrGetSalesSession, saveSalesSession } from "./sessions";
import { companyHasPackages, loadSalesContextCard, samplePackageName } from "./context";
import { catalogChoice, resolveCatalogQuery, searchCustomers, searchDealsMine } from "./resolve";
import {
  discardDraft,
  runCopyLast,
  runCreateQuotation,
  runUpdateDraft,
  type CommandOutcome,
} from "./quotation-command";
import {
  runDraftFollowup,
  runGetTodaysFocus,
  runPrepareCallBrief,
  runWhatNext,
} from "./attention-commands";

function log(event: string, data: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: now().toISOString(), scope: "sales-agent", event, ...data }));
}

async function persistExecution(opts: {
  actor: SalesActor;
  sessionId: string;
  state: string;
  summary: string;
  intents: string[];
  idempotencyKey?: string | null;
  leadId?: string | null;
  model?: string | null;
  quotationId?: string | null;
}): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("agent_executions")
    .insert({
      client_id: opts.actor.clientId,
      lead_id: opts.leadId ?? null,
      trigger_kind: "SALESPERSON",
      state: opts.state,
      autonomy_mode: "ASSIST",
      prompt_version: SALES_PROMPT_VERSION,
      decision_summary: opts.summary.slice(0, 500),
      intents: opts.intents,
      sales_session_id: opts.sessionId,
      requested_by_id: opts.actor.userId,
      idempotency_key: opts.idempotencyKey ?? null,
      model: opts.model ?? null,
      started_at: now().toISOString(),
      completed_at: now().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    log("execution.persist_failed", { error: error.message });
    return null;
  }
  const id = asRow<{ id: string }>(data)?.id ?? null;
  if (id && opts.quotationId) {
    await supabase.from("agent_execution_actions").insert({
      execution_id: id,
      client_id: opts.actor.clientId,
      tool_name: "quotation.createDraft",
      risk_level: "MEDIUM",
      status: "EXECUTED",
      input_summary: { intent: opts.intents[0] ?? "CREATE_QUOTATION" },
      result_summary: { quotationId: opts.quotationId },
      created_record_type: "quotation",
      created_record_id: opts.quotationId,
    });
  }
  return id;
}

async function findIdempotent(opts: {
  actor: SalesActor;
  key: string;
}): Promise<{ executionId: string; quotationId: string | null; summary: string } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_executions")
    .select("id, state, decision_summary")
    .eq("client_id", opts.actor.clientId)
    .eq("requested_by_id", opts.actor.userId)
    .eq("idempotency_key", opts.key)
    .eq("trigger_kind", "SALESPERSON")
    .maybeSingle();
  const row = asRow<{ id: string; state: string; decision_summary: string | null }>(data);
  if (!row) return null;
  const { data: action } = await supabase
    .from("agent_execution_actions")
    .select("created_record_id")
    .eq("execution_id", row.id)
    .eq("created_record_type", "quotation")
    .maybeSingle();
  return {
    executionId: row.id,
    quotationId: (action?.created_record_id as string | null) ?? null,
    summary: row.decision_summary || "Quotation already prepared.",
  };
}

async function parseIntentWithModel(opts: {
  actor: SalesActor;
  message: string;
  page: SalesPageContext;
  contextCard: Awaited<ReturnType<typeof loadSalesContextCard>>;
  companyName: string;
  hasPackages: boolean;
}): Promise<SalesIntent | null> {
  if (!salesAgentModelAvailable()) return null;
  try {
    const provider = getAgentModelProvider();
    const brain = await assembleCompanyBrainContext({
      clientId: opts.actor.clientId,
      customerMessage: opts.message,
    });
    const learning = await retrieveApprovedLearning({
      clientId: opts.actor.clientId,
      customerMessage: opts.message,
      intents: ["QUOTATION_REQUEST"],
      limit: 4,
    });
    const system = [
      buildSalesSystemPrompt({
        companyName: opts.companyName,
        actorName: opts.actor.name,
        context: opts.contextCard,
        page: opts.page,
        hasPackages: opts.hasPackages,
      }),
      serializeCompanyBrainContext(brain),
      serializeLearnedKnowledge(learning.items),
      wrapUntrustedContent("SALESPERSON_COMMAND", opts.message),
    ]
      .filter(Boolean)
      .join("\n\n");

    const messages: AgentChatMessage[] = [{ role: "user", text: "Parse this salesperson command into emit_sales_intent." }];
    const res = await provider.generate({
      system,
      messages,
      tools: [EMIT_INTENT_TOOL],
      maxTokens: 800,
      temperature: 0,
    });
    const call = res.toolCalls.find((c) => c.name === "emit_sales_intent") ?? res.toolCalls[0];
    if (!call) {
      const parsed = safeJson(res.text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      const record = parsed as Record<string, unknown>;
      return validateSalesIntent({ ...record, items: record.items ?? [] });
    }
    return validateSalesIntent(call.input);
  } catch (err) {
    log("intent.model_failed", { error: err instanceof Error ? err.message : "unknown" });
    return null;
  }
}

function safeJson(text: string | null): unknown {
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

function outcomeToTurn(
  sessionId: string,
  executionId: string | null,
  context: SalesTurnResult["context"],
  outcome: CommandOutcome,
  phase: string | null
): SalesTurnResult {
  return {
    reply: outcome.reply,
    blocks: outcome.blocks,
    sessionId,
    executionId,
    phase,
    status: outcome.status === "WAITING_FOR_INPUT" ? "WAITING_FOR_INPUT" : outcome.status === "FAILED" ? "FAILED" : "COMPLETED",
    context,
  };
}

async function handleSearch(opts: {
  actor: SalesActor;
  intent: SalesIntent;
}): Promise<CommandOutcome> {
  if (opts.intent.intent === "SEARCH_CUSTOMER") {
    const options = await searchCustomers(opts.actor, opts.intent.searchQuery || opts.intent.customerReference?.query || "");
    if (!options.length) {
      return {
        reply: "No matching customers in your records.",
        status: "COMPLETED",
        blocks: [{ type: "status", kind: "done", message: "No matching customers in your records." }],
      };
    }
    return {
      reply: `I found ${options.length} customer${options.length === 1 ? "" : "s"}.`,
      status: "COMPLETED",
      blocks: [{ type: "choice", kind: "CUSTOMER", prompt: "Matching customers", options }],
    };
  }
  if (opts.intent.intent === "SEARCH_DEAL") {
    const options = await searchDealsMine(opts.actor, opts.intent.searchQuery);
    if (!options.length) {
      return {
        reply: "No matching Deals in your pipeline.",
        status: "COMPLETED",
        blocks: [{ type: "status", kind: "done", message: "No matching Deals in your pipeline." }],
      };
    }
    return {
      reply: `${options.length} Deal${options.length === 1 ? "" : "s"} in your pipeline.`,
      status: "COMPLETED",
      blocks: [{ type: "choice", kind: "DEAL", prompt: "Your Deals", options }],
    };
  }
  const q = opts.intent.searchQuery || opts.intent.items[0]?.query || "";
  const prefer = opts.intent.intent === "SEARCH_PACKAGE" ? "PACKAGE" : "PRODUCT";
  const match = await resolveCatalogQuery({ actor: opts.actor, query: q, prefer });
  if (match.kind === "none") {
    return {
      reply: `I couldn't find “${q}” in the catalogue.`,
      status: "COMPLETED",
      blocks: [{ type: "status", kind: "done", message: `I couldn't find “${q}” in the catalogue.` }],
    };
  }
  const options = match.kind === "one" ? [catalogChoice(match.value)] : match.choices ?? [];
  return {
    reply: match.kind === "one" ? `Found ${options[0]?.title}.` : `I found ${options.length} matches.`,
    status: "COMPLETED",
    blocks: [{ type: "choice", kind: prefer === "PACKAGE" ? "PACKAGE" : "PRODUCT", prompt: "Catalogue matches", options }],
  };
}

export async function runSalesCommand(opts: {
  actor: SalesActor;
  message: string;
  sessionId?: string | null;
  pageContext?: SalesPageContext | null;
  commandId?: string | null;
  selection?: { id: string; kind?: string } | null;
  companyName?: string;
  surface?: "command_center" | "drawer";
}): Promise<SalesTurnResult> {
  const flags = await getSalesAgentFlags(opts.actor.clientId);
  const page = opts.pageContext ?? {};
  const surface = opts.surface === "drawer" ? "drawer" : "command_center";
  const surfaceAllowed = surface === "drawer" ? flags.salesHubCommand : flags.commandCenter;
  if (!flags.enabled || !surfaceAllowed) {
    const context = await loadSalesContextCard(opts.actor, page);
    const message = "Sales Command Center is not enabled for this company.";
    return {
      reply: message,
      blocks: [{ type: "status", kind: "denied", message }],
      sessionId: opts.sessionId ?? "",
      executionId: null,
      phase: null,
      status: "FAILED",
      context,
    };
  }
  const session = await createOrGetSalesSession({
    actor: opts.actor,
    sessionId: opts.sessionId,
    pageContext: page,
  });
  const context = await loadSalesContextCard(opts.actor, {
    ...page,
    leadId: page.leadId ?? session.activeLeadId,
    dealId: page.dealId ?? session.activeDealId,
    quotationId: page.quotationId ?? session.activeQuotationId,
    conversationId: page.conversationId ?? session.activeConversationId,
  });

  const message = sanitizeConfigText(opts.message, 2000);
  await appendSalesMessage({
    sessionId: session.id,
    clientId: opts.actor.clientId,
    role: "user",
    content: message,
  });

  if (opts.commandId) {
    const existing = await findIdempotent({ actor: opts.actor, key: opts.commandId });
    if (existing?.quotationId) {
      const reply = existing.summary;
      const blocks: SalesBlock[] = [
        { type: "status", kind: "done", message: reply },
        { type: "actions", actions: [{ label: "View quotation", href: `/sales/quotes/${existing.quotationId}`, style: "primary" }] },
      ];
      await appendSalesMessage({ sessionId: session.id, clientId: opts.actor.clientId, role: "assistant", content: reply, blocks, executionId: existing.executionId });
      return { reply, blocks, sessionId: session.id, executionId: existing.executionId, phase: null, status: "COMPLETED", context };
    }
  }

  if (looksLikeCancel(message) && session.pendingInput) {
    await saveSalesSession({ sessionId: session.id, pendingInput: null });
    const reply = "Cancelled. No quotation was created.";
    const blocks: SalesBlock[] = [{ type: "status", kind: "done", message: reply }];
    await appendSalesMessage({ sessionId: session.id, clientId: opts.actor.clientId, role: "assistant", content: reply, blocks });
    return { reply, blocks, sessionId: session.id, executionId: null, phase: null, status: "CANCELLED", context };
  }

  const unsupported = matchUnsupportedSalesCommand(message);
  if (unsupported) {
    const blocks: SalesBlock[] = [{ type: "status", kind: "unsupported", message: unsupported }];
    await appendSalesMessage({ sessionId: session.id, clientId: opts.actor.clientId, role: "assistant", content: unsupported, blocks });
    return { reply: unsupported, blocks, sessionId: session.id, executionId: null, phase: null, status: "COMPLETED", context };
  }
  const future = matchFutureSalesCommand(message);
  if (future) {
    const blocks: SalesBlock[] = [{ type: "status", kind: "unsupported", message: future }];
    await appendSalesMessage({ sessionId: session.id, clientId: opts.actor.clientId, role: "assistant", content: future, blocks });
    return { reply: future, blocks, sessionId: session.id, executionId: null, phase: null, status: "COMPLETED", context };
  }

  if (/^discard draft\b/i.test(message) && session.activeQuotationId) {
    const outcome = await discardDraft({ actor: opts.actor, quotationId: session.activeQuotationId });
    await saveSalesSession({ sessionId: session.id, pendingInput: null, activeQuotationId: outcome.activeQuotationId ?? null });
    const executionId = await persistExecution({
      actor: opts.actor,
      sessionId: session.id,
      state: outcome.status === "FAILED" ? "FAILED" : "COMPLETED",
      summary: outcome.reply,
      intents: ["UPDATE_DRAFT_QUOTATION"],
      leadId: session.activeLeadId,
    });
    await appendSalesMessage({ sessionId: session.id, clientId: opts.actor.clientId, role: "assistant", content: outcome.reply, blocks: outcome.blocks, executionId });
    return outcomeToTurn(session.id, executionId, context, outcome, "Discarding draft");
  }

  let intent: SalesIntent | null = null;
  if (session.pendingInput && (opts.selection || looksLikeConfirm(message))) {
    intent = {
      ...session.pendingInput.intent,
    };
    const selectedId = opts.selection?.id ?? session.pendingInput.options[0]?.id;
    if (session.pendingInput.kind === "CUSTOMER" && selectedId) {
      intent.customerReference = { source: "SELECTED", id: selectedId };
    } else if (session.pendingInput.kind === "DEAL" && selectedId) {
      intent.dealReference = { source: "SELECTED", id: selectedId };
    } else if (session.pendingInput.kind === "COPY_CONFIRM") {
      const leadId = String(session.pendingInput.extra?.leadId ?? session.activeLeadId ?? page.leadId ?? "");
      const outcome = await runCopyLast({ actor: opts.actor, leadId, commandText: message, confirmed: true });
      await saveSalesSession({
        sessionId: session.id,
        pendingInput: null,
        activeQuotationId: outcome.activeQuotationId ?? session.activeQuotationId,
      });
      const executionId = await persistExecution({
        actor: opts.actor,
        sessionId: session.id,
        state: "COMPLETED",
        summary: outcome.reply,
        intents: ["COPY_LAST_QUOTATION"],
        idempotencyKey: opts.commandId,
        leadId: leadId || null,
        quotationId: outcome.quotationId,
      });
      await appendSalesMessage({ sessionId: session.id, clientId: opts.actor.clientId, role: "assistant", content: outcome.reply, blocks: outcome.blocks, executionId });
      return outcomeToTurn(session.id, executionId, context, outcome, "Copying quotation");
    } else if (
      (session.pendingInput.kind === "PRODUCT" || session.pendingInput.kind === "PACKAGE" || session.pendingInput.kind === "SERVICE") &&
      selectedId
    ) {
      const pendingQuery = String(session.pendingInput.extra?.pendingItemQuery ?? "").trim().toLowerCase();
      const selectedTitle = session.pendingInput.options.find((o) => o.id === selectedId)?.title?.trim() || "";
      const itemType =
        session.pendingInput.kind === "PACKAGE" ? "PACKAGE" : session.pendingInput.kind === "SERVICE" ? "SERVICE" : "PRODUCT";
      const currentItems = intent?.items ?? [];
      intent = {
        ...(intent ?? session.pendingInput.intent),
        items: currentItems.map((it) => {
          const matchesPending =
            !pendingQuery ||
            it.query.trim().toLowerCase() === pendingQuery ||
            currentItems.length === 1;
          return matchesPending
            ? {
                ...it,
                id: selectedId,
                query: selectedTitle || it.query,
                type: itemType,
              }
            : it;
        }),
      };
      if (!intent.items.length) {
        intent.items = [{
          type: itemType,
          query: selectedTitle || pendingQuery || "item",
          quantity: 1,
          id: selectedId,
        }];
      }
    } else if (session.pendingInput.kind === "REQUIREMENTS" && (looksLikeConfirm(message) || opts.selection)) {
      intent = session.pendingInput.intent;
    }
    await saveSalesSession({ sessionId: session.id, pendingInput: null });
  }

  if (!intent) {
    intent = heuristicParseSalesIntent(message, { ...page, leadId: context.leadId, dealId: context.dealId, quotationId: context.quotationId, conversationId: context.conversationId }, session.activeQuotationId);
  }
  if (!intent) {
    const hasPackages = await companyHasPackages(opts.actor.clientId);
    intent = await parseIntentWithModel({
      actor: opts.actor,
      message,
      page,
      contextCard: context,
      companyName: opts.companyName || "Company",
      hasPackages,
    });
  }

  if (!intent) {
    const reply = "I couldn't understand that command. Try: create a quotation for this customer, or name a Package or Product.";
    const blocks: SalesBlock[] = [{ type: "status", kind: "error", message: reply }];
    await appendSalesMessage({ sessionId: session.id, clientId: opts.actor.clientId, role: "assistant", content: reply, blocks });
    return { reply, blocks, sessionId: session.id, executionId: null, phase: null, status: "FAILED", context };
  }

  if (FUTURE_SET.has(intent.intent)) {
    const reply = "That command isn't available in Sales Command Center yet.";
    const blocks: SalesBlock[] = [{ type: "status", kind: "unsupported", message: reply }];
    await appendSalesMessage({ sessionId: session.id, clientId: opts.actor.clientId, role: "assistant", content: reply, blocks });
    return { reply, blocks, sessionId: session.id, executionId: null, phase: null, status: "COMPLETED", context };
  }

  let outcome: CommandOutcome;
  let phase: string | null = "Working…";

  if (intent.intent === "SEARCH_CUSTOMER" || intent.intent === "SEARCH_DEAL" || intent.intent === "SEARCH_PRODUCT" || intent.intent === "SEARCH_PACKAGE") {
    phase = "Searching…";
    outcome = await handleSearch({ actor: opts.actor, intent });
  } else if (intent.intent === "VIEW_QUOTATION") {
    const qid = intent.quotationReference?.id ?? session.activeQuotationId ?? context.quotationId;
    if (!qid) {
      outcome = { reply: "There isn't a quotation in this context yet.", status: "FAILED", blocks: [{ type: "status", kind: "error", message: "There isn't a quotation in this context yet." }] };
    } else {
      outcome = {
        reply: "Opening the quotation.",
        status: "COMPLETED",
        blocks: [{ type: "actions", actions: [{ label: "View quotation", href: `/sales/quotes/${qid}`, style: "primary" }] }],
        activeQuotationId: qid,
      };
    }
  } else if (intent.intent === "COPY_LAST_QUOTATION") {
    phase = "Looking up the previous quotation…";
    const leadId = context.leadId ?? session.activeLeadId ?? "";
    if (!leadId) {
      outcome = { reply: "I need a customer before I can copy their last quotation.", status: "FAILED", blocks: [{ type: "status", kind: "error", message: "I need a customer before I can copy their last quotation." }] };
    } else {
      outcome = await runCopyLast({ actor: opts.actor, leadId, commandText: message, confirmed: false });
    }
  } else if (intent.intent === "UPDATE_DRAFT_QUOTATION") {
    phase = "Updating draft…";
    const qid = intent.quotationReference?.id ?? session.activeQuotationId ?? context.quotationId;
    if (!qid) {
      outcome = await runCreateQuotation({
        actor: opts.actor,
        intent: { ...intent, intent: "CREATE_QUOTATION" },
        pageLeadId: context.leadId ?? page.leadId,
        pageDealId: context.dealId ?? page.dealId,
        pageConversationId: context.conversationId ?? page.conversationId,
        pageCompanyId: page.companyId,
        pageCustomerId: context.customerId ?? page.customerId,
        commandText: message,
        selectedId: intent.customerReference?.id ?? intent.dealReference?.id ?? opts.selection?.id,
        flags,
      });
    } else {
      outcome = await runUpdateDraft({
        actor: opts.actor,
        intent,
        quotationId: qid,
        flags,
        commandText: message,
      });
    }
  } else if (intent.intent === "CREATE_QUOTATION") {
    phase = "Preparing quotation…";
    outcome = await runCreateQuotation({
      actor: opts.actor,
      intent,
      pageLeadId: context.leadId ?? page.leadId,
      pageDealId: context.dealId ?? page.dealId,
      pageConversationId: context.conversationId ?? page.conversationId,
      pageCompanyId: page.companyId,
      pageCustomerId: context.customerId ?? page.customerId,
      commandText: message,
      selectedId: intent.customerReference?.id ?? intent.dealReference?.id ?? opts.selection?.id,
      flags,
    });
  } else if (intent.intent === "GET_TODAYS_FOCUS") {
    phase = "Loading Today's Focus…";
    outcome = await runGetTodaysFocus({ actor: opts.actor });
  } else if (intent.intent === "NEXT_BEST_ACTION") {
    phase = "Finding next priority…";
    outcome = await runWhatNext({ actor: opts.actor });
  } else if (intent.intent === "DRAFT_FOLLOWUP") {
    phase = "Drafting follow-up…";
    outcome = await runDraftFollowup({ actor: opts.actor });
  } else if (intent.intent === "PREPARE_CALL_BRIEF") {
    phase = "Preparing call brief…";
    outcome = await runPrepareCallBrief({ actor: opts.actor });
  } else {
    outcome = {
      reply: "That action isn't available through Sales Command Center.",
      status: "FAILED",
      blocks: [{ type: "status", kind: "unsupported", message: "That action isn't available through Sales Command Center." }],
    };
  }

  await saveSalesSession({
    sessionId: session.id,
    pendingInput: outcome.pending ?? null,
    activeLeadId: outcome.activeLeadId ?? session.activeLeadId ?? context.leadId,
    activeDealId: outcome.activeDealId ?? session.activeDealId ?? context.dealId,
    activeQuotationId: outcome.activeQuotationId !== undefined ? outcome.activeQuotationId : session.activeQuotationId,
    activeConversationId: context.conversationId,
    title: intent.intent,
  });

  const execState =
    outcome.status === "WAITING_FOR_INPUT"
      ? "WAITING_FOR_INPUT"
      : outcome.status === "FAILED"
        ? "FAILED"
        : "COMPLETED";
  const executionId = await persistExecution({
    actor: opts.actor,
    sessionId: session.id,
    state: execState,
    summary: outcome.reply,
    intents: [intent.intent],
    idempotencyKey: outcome.status === "COMPLETED" ? opts.commandId : null,
    leadId: outcome.activeLeadId ?? context.leadId,
    quotationId: outcome.quotationId,
  });
  await appendSalesMessage({
    sessionId: session.id,
    clientId: opts.actor.clientId,
    role: "assistant",
    content: outcome.reply,
    blocks: outcome.blocks,
    executionId,
  });
  return outcomeToTurn(session.id, executionId, context, outcome, phase);
}

const FUTURE_SET = new Set([
  "CREATE_FOLLOWUP",
  "CREATE_TASK",
  "CREATE_APPOINTMENT",
  "UPDATE_DEAL_STAGE",
  "ADD_INTERNAL_NOTE",
  "TRANSFER_CONVERSATION",
  "SHOW_MY_DEALS",
  "SHOW_MY_FOLLOWUPS",
  "SHOW_MY_APPOINTMENTS",
]);

export async function loadSalesCommandBootstrap(actor: SalesActor, page: SalesPageContext) {
  const flags = await getSalesAgentFlags(actor.clientId);
  const context = await loadSalesContextCard(actor, page);
  const hasPackages = await companyHasPackages(actor.clientId);
  const pkgName = hasPackages ? await samplePackageName(actor.clientId) : null;
  const supabase = createAdminClient();
  let recent: Array<{
    quotationId: string;
    quoteNumber: string;
    customerName: string | null;
    status: string;
    summary: string;
    createdAt: string;
    href: string;
  }> = [];
  const sourced = await supabase
    .from("quotations")
    .select("id, quote_number, status, customer_name, created_at, total, currency, creation_source")
    .eq("client_id", actor.clientId)
    .eq("prepared_by_id", actor.userId)
    .order("created_at", { ascending: false })
    .limit(8);
  const sourceRows = sourced.error
    ? (
        await supabase
          .from("quotations")
          .select("id, quote_number, status, customer_name, created_at, total, currency")
          .eq("client_id", actor.clientId)
          .eq("prepared_by_id", actor.userId)
          .order("created_at", { ascending: false })
          .limit(5)
      ).data
    : sourced.data;
  recent = (sourceRows ?? [])
    .filter((q) => !("creation_source" in q) || !q.creation_source || q.creation_source === "SALES_AGENT")
    .slice(0, 5)
    .map((q) => ({
      quotationId: q.id as string,
      quoteNumber: (q.quote_number as string) || "",
      customerName: (q.customer_name as string | null) ?? null,
      status: String(q.status),
      summary: "Draft prepared",
      createdAt: q.created_at as string,
      href: `/sales/quotes/${q.id}`,
    }));
  return { flags, context, hasPackages, samplePackageName: pkgName, recent };
}

export async function cancelSalesCommand(opts: { actor: SalesActor; sessionId: string }): Promise<void> {
  await saveSalesSession({ sessionId: opts.sessionId, pendingInput: null });
}
