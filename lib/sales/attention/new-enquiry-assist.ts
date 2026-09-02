/**
 * New enquiry assist — summarize overnight/uncontacted chats and draft first replies.
 * Explicit salesperson Send click → WhatsApp send. Not silent auto-outbound.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getAgentModelProvider } from "@/lib/agent/provider";
import { isAgentGloballyEnabled } from "@/lib/agent/settings";
import { emitAttentionEvent } from "./observability";
import type { SalesAttentionItem } from "./types";

export type NewEnquiryAssist = {
  leadId: string;
  customerName: string;
  sourceLabel: string | null;
  customerSaid: string | null;
  summary: string;
  suggestedDraft: string;
  canAutoSendOnClick: true;
  warnings: string[];
};

function sourceLabel(source: string | null | undefined): string | null {
  if (!source) return null;
  const map: Record<string, string> = {
    FACEBOOK: "Facebook",
    FACEBOOK_AD: "Facebook",
    WHATSAPP_INBOUND: "WhatsApp",
    LANDING_PAGE: "Website",
    WEBSITE: "Website",
  };
  return map[source] ?? source.replace(/_/g, " ");
}

function looksLikeMoreInfoRequest(text: string): boolean {
  return /\b(more info|more information|tell me more|details|interested|price|how much|available|can i get)\b/i.test(
    text
  );
}

function deterministicDraft(opts: {
  customerName: string;
  customerSaid: string | null;
  projectType: string | null;
  companyName?: string | null;
}): { draft: string; warnings: string[] } {
  const first = opts.customerName.split(/\s+/)[0] || "there";
  const warnings: string[] = [];
  const said = opts.customerSaid?.trim() || "";

  if (looksLikeMoreInfoRequest(said)) {
    return {
      draft: `Hi ${first}, thanks for your message. Happy to share more details — what are you looking to solve (e.g. backup power, solar, or a full system), and roughly what size property or load do you have in mind?`,
      warnings,
    };
  }
  if (opts.projectType) {
    return {
      draft: `Hi ${first}, thanks for reaching out about ${opts.projectType}. I can help with the next steps — is now a good time for a quick chat, or would you prefer a short WhatsApp overview first?`,
      warnings,
    };
  }
  return {
    draft: `Hi ${first}, thanks for your message. I'm happy to help — could you share a bit more about what you need so I can guide you properly?`,
    warnings,
  };
}

async function phraseDraftWithLlm(opts: {
  customerName: string;
  customerSaid: string | null;
  source: string | null;
  projectType: string | null;
}): Promise<string | null> {
  if (!isAgentGloballyEnabled()) return null;
  try {
    const provider = getAgentModelProvider();
    const res = await provider.generate({
      system: `You draft a first WhatsApp reply for a salesperson to a new enquiry.
Rules:
- Short, professional, helpful.
- Do NOT invent prices, delivery, stock, warranty, discounts, or technical guarantees.
- If they asked for more info, ask 1–2 clarifying questions.
- Return ONLY the message body, no quotes or preamble.`,
      messages: [
        {
          role: "user",
          text: JSON.stringify({
            customerName: opts.customerName,
            source: opts.source,
            projectType: opts.projectType,
            customerSaid: opts.customerSaid,
          }),
        },
      ],
      maxTokens: 220,
      temperature: 0.3,
    });
    const text = res.text?.trim();
    if (!text || text.length < 12) return null;
    return text.replace(/^["']|["']$/g, "").trim();
  } catch {
    return null;
  }
}

export async function buildNewEnquiryAssist(opts: {
  clientId: string;
  salespersonId: string;
  item: SalesAttentionItem;
}): Promise<NewEnquiryAssist | null> {
  const leadId = opts.item.leadId;
  if (!leadId) return null;

  const supabase = createAdminClient();
  const [{ data: lead }, { data: messages }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, source, project_type, form_data")
      .eq("id", leadId)
      .eq("client_id", opts.clientId)
      .maybeSingle(),
    supabase
      .from("whatsapp_messages")
      .select("direction, body, created_at")
      .eq("lead_id", leadId)
      .eq("client_id", opts.clientId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const inbound = ((messages ?? []) as Array<{ direction: string; body: string | null }>)
    .filter((m) => m.direction === "inbound" && m.body?.trim())
    .map((m) => m.body!.trim());

  const formData = (lead?.form_data ?? null) as Record<string, unknown> | null;
  const formSnippet =
    (typeof formData?.first_message === "string" && formData.first_message.trim()) ||
    (typeof formData?.message === "string" && formData.message.trim()) ||
    null;

  const customerSaid = inbound[0] || formSnippet || null;
  const customerName =
    opts.item.customerName ||
    (lead?.name as string | null)?.trim() ||
    "Customer";
  const projectType =
    opts.item.projectType ||
    (lead?.project_type as string | null) ||
    null;
  const source = (lead?.source as string | null) ?? null;

  const base = deterministicDraft({
    customerName,
    customerSaid,
    projectType,
  });

  let draft = base.draft;
  const llm = await phraseDraftWithLlm({
    customerName,
    customerSaid,
    source,
    projectType,
  });
  if (llm) draft = llm;

  const summary = customerSaid
    ? `New ${sourceLabel(source) || "enquiry"}: customer said “${customerSaid.slice(0, 160)}${
        customerSaid.length > 160 ? "…" : ""
      }”. No salesperson reply yet — WhatsApp already shows this as unread.`
    : `New uncontacted enquiry from ${sourceLabel(source) || "an inbound channel"}. No meaningful sales conversation yet.`;

  await emitAttentionEvent({
    clientId: opts.clientId,
    salespersonId: opts.salespersonId,
    eventType: "sales_agent.followup_drafted",
    payload: { kind: "new_enquiry", leadId },
  });

  return {
    leadId,
    customerName,
    sourceLabel: sourceLabel(source),
    customerSaid,
    summary,
    suggestedDraft: draft,
    canAutoSendOnClick: true,
    warnings: base.warnings,
  };
}
