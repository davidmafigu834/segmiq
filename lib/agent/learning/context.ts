import { createAdminClient } from "@/lib/supabase/admin";
import { asRow, asRows } from "@/lib/agent/rows";
import { loadCompanyBrainSnapshot } from "@/lib/company-brain/store";
import { messageOrigin, redactSecrets, isIgnorableMessage } from "./policy";
import type { MessageOrigin } from "./types";

export type LearningMessage = {
  id: string;
  origin: MessageOrigin;
  body: string;
  at: string;
  actorId: string | null;
};

export type LearningAssembledContext = {
  clientId: string;
  conversationId: string;
  conversationType: string;
  salespersonId: string | null;
  customerId: string | null;
  deal: { id: string; stage: string; name: string } | null;
  quotation: { id: string; status: string; number: string } | null;
  messages: LearningMessage[];
  brainSummary: string;
  approvedLearning: Array<{ id: string; title: string; content: string; category: string }>;
  commercial: {
    creditOffered: boolean;
    paymentPlansOffered: boolean;
    paymentTerms: string | null;
    allowQuotationDiscount: boolean | null;
  };
};

function clip(text: string, max = 400): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export async function assembleLearningContext(opts: {
  clientId: string;
  conversationId: string;
  afterMessageId?: string | null;
  limit?: number;
}): Promise<LearningAssembledContext | null> {
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select(
      "id, client_id, contact_id, assigned_to_id, active_deal_id, whatsapp_conversation_type, name"
    )
    .eq("id", opts.conversationId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!lead) return null;

  let query = supabase
    .from("whatsapp_messages")
    .select("id, direction, sender_source, actor_id, body, created_at")
    .eq("client_id", opts.clientId)
    .eq("lead_id", opts.conversationId)
    .order("created_at", { ascending: true })
    .limit(opts.limit ?? 40);

  const { data: messageRows } = await query;
  let rows = asRows<{
    id: string;
    direction: string;
    sender_source: string | null;
    actor_id: string | null;
    body: string | null;
    created_at: string;
  }>(messageRows);

  if (opts.afterMessageId) {
    const idx = rows.findIndex((r) => r.id === opts.afterMessageId);
    if (idx >= 0) rows = rows.slice(idx + 1);
  }

  const messages: LearningMessage[] = [];
  for (const row of rows) {
    const origin = messageOrigin({
      direction: row.direction,
      senderSource: row.sender_source,
      actorId: row.actor_id,
    });
    const raw = (row.body ?? "").trim();
    if (isIgnorableMessage(raw, origin)) continue;
    messages.push({
      id: row.id,
      origin,
      body: clip(redactSecrets(raw).text),
      at: row.created_at,
      actorId: row.actor_id,
    });
  }

  const dealId = (lead.active_deal_id as string | null) ?? null;
  const [{ data: deal }, { data: quotes }, snapshot, { data: knowledge }] = await Promise.all([
    dealId
      ? supabase
          .from("deals")
          .select("id, name, stage")
          .eq("id", dealId)
          .eq("client_id", opts.clientId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("quotations")
      .select("id, quote_number, status")
      .eq("client_id", opts.clientId)
      .eq("lead_id", opts.conversationId)
      .order("created_at", { ascending: false })
      .limit(1),
    loadCompanyBrainSnapshot(opts.clientId).catch(() => null),
    supabase
      .from("agent_learning_knowledge")
      .select("id, title, content, category")
      .eq("client_id", opts.clientId)
      .eq("status", "ACTIVE")
      .order("last_reinforced_at", { ascending: false, nullsFirst: false })
      .limit(20),
  ]);

  const quote = asRows<{ id: string; quote_number: string | null; status: string }>(quotes)[0] ?? null;
  const dealRow = asRow<{ id: string; name: string; stage: string }>(deal);

  const brainBits: string[] = [];
  if (snapshot) {
    brainBits.push(`Credit offered: ${snapshot.settings.creditOffered ? "yes" : "no"}`);
    brainBits.push(`Payment plans offered: ${snapshot.settings.paymentPlansOffered ? "yes" : "no"}`);
    if (snapshot.settings.pricingGuidance) brainBits.push(`Pricing: ${clip(snapshot.settings.pricingGuidance, 220)}`);
    if (snapshot.playbooks[0]) brainBits.push(`Playbook: ${snapshot.playbooks[0].name}`);
    const faqTitles = snapshot.faqs.slice(0, 8).map((f) => f.question);
    if (faqTitles.length) brainBits.push(`FAQs: ${faqTitles.join("; ")}`);
  }

  return {
    clientId: opts.clientId,
    conversationId: opts.conversationId,
    conversationType: (lead.whatsapp_conversation_type as string) || "SALES",
    salespersonId: (lead.assigned_to_id as string | null) ?? null,
    customerId: (lead.contact_id as string | null) ?? null,
    deal: dealRow ? { id: dealRow.id, stage: dealRow.stage, name: dealRow.name } : null,
    quotation: quote
      ? { id: quote.id, status: quote.status, number: quote.quote_number ?? quote.id }
      : null,
    messages,
    brainSummary: brainBits.join("\n") || "No Company Brain facts loaded.",
    approvedLearning: asRows<{ id: string; title: string; content: string; category: string }>(knowledge),
    commercial: {
      creditOffered: snapshot?.settings.creditOffered ?? false,
      paymentPlansOffered: snapshot?.settings.paymentPlansOffered ?? false,
      paymentTerms: snapshot?.canonical.paymentTerms ?? null,
      allowQuotationDiscount: snapshot?.canonical.allowQuotationDiscount ?? null,
    },
  };
}
