import { createAdminClient } from "@/lib/supabase/admin";
import { asRow } from "@/lib/agent/rows";
import { now } from "@/lib/clock";
import {
  SESSION_TTL_MS,
  type PendingInput,
  type SalesActor,
  type SalesBlock,
  type SalesPageContext,
  type SalesSessionState,
} from "./types";

function parsePending(raw: unknown): PendingInput | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as PendingInput;
}

function parsePage(raw: unknown): SalesPageContext {
  if (!raw || typeof raw !== "object") return {};
  return raw as SalesPageContext;
}

export async function createOrGetSalesSession(opts: {
  actor: SalesActor;
  sessionId?: string | null;
  pageContext?: SalesPageContext;
}): Promise<SalesSessionState> {
  const supabase = createAdminClient();
  const expiresAt = new Date(now().getTime() + SESSION_TTL_MS).toISOString();

  if (opts.sessionId) {
    const { data } = await supabase
      .from("agent_sales_sessions")
      .select("*")
      .eq("id", opts.sessionId)
      .eq("client_id", opts.actor.clientId)
      .eq("user_id", opts.actor.userId)
      .maybeSingle();
    const row = asRow<Record<string, unknown>>(data);
    if (row) {
      const expired = typeof row.expires_at === "string" && new Date(row.expires_at).getTime() < now().getTime();
      const page = opts.pageContext ?? parsePage(row.page_context);
      if (expired) {
        await supabase
          .from("agent_sales_sessions")
          .update({
            pending_input: null,
            expires_at: expiresAt,
            page_context: page,
            updated_at: now().toISOString(),
          })
          .eq("id", row.id as string);
        return {
          id: row.id as string,
          activeCustomerId: (row.active_customer_id as string | null) ?? null,
          activeLeadId: (row.active_lead_id as string | null) ?? null,
          activeDealId: (row.active_deal_id as string | null) ?? null,
          activeQuotationId: null,
          activeConversationId: (row.active_conversation_id as string | null) ?? page.conversationId ?? page.leadId ?? null,
          pendingInput: null,
          pageContext: page,
          expiresAt,
        };
      }
      if (opts.pageContext) {
        await supabase
          .from("agent_sales_sessions")
          .update({ page_context: opts.pageContext, expires_at: expiresAt, updated_at: now().toISOString() })
          .eq("id", row.id as string);
      }
      return {
        id: row.id as string,
        activeCustomerId: (row.active_customer_id as string | null) ?? null,
        activeLeadId: (row.active_lead_id as string | null) ?? null,
        activeDealId: (row.active_deal_id as string | null) ?? null,
        activeQuotationId: (row.active_quotation_id as string | null) ?? null,
        activeConversationId: (row.active_conversation_id as string | null) ?? null,
        pendingInput: parsePending(row.pending_input),
        pageContext: page,
        expiresAt: (row.expires_at as string | null) ?? expiresAt,
      };
    }
  }

  const page = opts.pageContext ?? {};
  const { data, error } = await supabase
    .from("agent_sales_sessions")
    .insert({
      client_id: opts.actor.clientId,
      user_id: opts.actor.userId,
      page_context: page,
      active_lead_id: page.leadId ?? page.conversationId ?? null,
      active_customer_id: page.customerId ?? null,
      active_deal_id: page.dealId ?? null,
      active_quotation_id: page.quotationId ?? null,
      active_conversation_id: page.conversationId ?? page.leadId ?? null,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not open Sales Command session");
  return {
    id: (data as { id: string }).id,
    activeCustomerId: page.customerId ?? null,
    activeLeadId: page.leadId ?? page.conversationId ?? null,
    activeDealId: page.dealId ?? null,
    activeQuotationId: page.quotationId ?? null,
    activeConversationId: page.conversationId ?? page.leadId ?? null,
    pendingInput: null,
    pageContext: page,
    expiresAt,
  };
}

export async function saveSalesSession(opts: {
  sessionId: string;
  pendingInput?: PendingInput | null;
  activeCustomerId?: string | null;
  activeLeadId?: string | null;
  activeDealId?: string | null;
  activeQuotationId?: string | null;
  activeConversationId?: string | null;
  title?: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const patch: Record<string, unknown> = {
    updated_at: now().toISOString(),
    expires_at: new Date(now().getTime() + SESSION_TTL_MS).toISOString(),
  };
  if (opts.pendingInput !== undefined) patch.pending_input = opts.pendingInput;
  if (opts.activeCustomerId !== undefined) patch.active_customer_id = opts.activeCustomerId;
  if (opts.activeLeadId !== undefined) patch.active_lead_id = opts.activeLeadId;
  if (opts.activeDealId !== undefined) patch.active_deal_id = opts.activeDealId;
  if (opts.activeQuotationId !== undefined) patch.active_quotation_id = opts.activeQuotationId;
  if (opts.activeConversationId !== undefined) patch.active_conversation_id = opts.activeConversationId;
  if (opts.title) patch.title = opts.title;
  await supabase.from("agent_sales_sessions").update(patch).eq("id", opts.sessionId);
}

export async function appendSalesMessage(opts: {
  sessionId: string;
  clientId: string;
  role: "user" | "assistant";
  content: string;
  blocks?: SalesBlock[];
  executionId?: string | null;
}): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("agent_sales_messages").insert({
    session_id: opts.sessionId,
    client_id: opts.clientId,
    role: opts.role,
    content: opts.content,
    blocks: opts.blocks ?? [],
    execution_id: opts.executionId ?? null,
  });
}
