import { createAdminClient } from "@/lib/supabase/admin";
import { logLeadEvent } from "@/lib/lead-events";
import { isOptOutMessage, recordWhatsAppOptOut } from "./consent";
import type { ResponseClassification } from "./types";

const INTERESTED_PATTERNS = [
  "yes",
  "interested",
  "contact me",
  "call me",
  "quote",
  "quotation",
  "tell me more",
  "more info",
];

const LATER_PATTERNS = ["later", "not now", "maybe", "next week", "next month"];

const NOT_INTERESTED_PATTERNS = [
  "not interested",
  "no thanks",
  "no thank you",
  "don't contact",
  "do not contact",
];

export function classifyCampaignResponse(body: string): ResponseClassification | null {
  const normalized = body.trim().toLowerCase();
  if (isOptOutMessage(normalized)) return "opt_out";
  if (NOT_INTERESTED_PATTERNS.some((p) => normalized.includes(p))) return "not_interested";
  if (LATER_PATTERNS.some((p) => normalized.includes(p))) return "later";
  if (INTERESTED_PATTERNS.some((p) => normalized.includes(p))) return "interested";
  if (normalized.length > 0) return "interested";
  return null;
}

export type CampaignReplyContext = {
  campaignId: string;
  campaignName: string;
  recipientId: string;
  sentAt: string | null;
  responseClassification: ResponseClassification | null;
};

export async function findRecentCampaignRecipient(opts: {
  clientId: string;
  phoneDigits: string;
}): Promise<{
  recipientId: string;
  campaignId: string;
  leadId: string | null;
  contactId: string | null;
} | null> {
  const supabase = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data: recipients } = await supabase
    .from("whatsapp_campaign_recipients")
    .select("id, campaign_id, lead_id, contact_id, phone, sent_at, status")
    .eq("client_id", opts.clientId)
    .in("status", ["sent", "delivered", "read"])
    .gte("sent_at", since.toISOString())
    .is("replied_at", null)
    .order("sent_at", { ascending: false })
    .limit(50);

  const match = (recipients ?? []).find((r) => {
    const rp = String(r.phone ?? "").replace(/\D/g, "");
    return (
      rp === opts.phoneDigits ||
      rp.endsWith(opts.phoneDigits) ||
      opts.phoneDigits.endsWith(rp)
    );
  });

  if (!match) return null;

  return {
    recipientId: match.id as string,
    campaignId: match.campaign_id as string,
    leadId: (match.lead_id as string | null) ?? null,
    contactId: (match.contact_id as string | null) ?? null,
  };
}

export async function handleCampaignReply(opts: {
  clientId: string;
  phoneDigits: string;
  body: string;
  leadId: string;
  contactId: string | null;
}): Promise<CampaignReplyContext | null> {
  const match = await findRecentCampaignRecipient({
    clientId: opts.clientId,
    phoneDigits: opts.phoneDigits,
  });

  if (!match) return null;

  const supabase = createAdminClient();
  const classification = classifyCampaignResponse(opts.body);
  const now = new Date().toISOString();

  await supabase
    .from("whatsapp_campaign_recipients")
    .update({
      replied_at: now,
      response_classification: classification,
      updated_at: now,
    })
    .eq("id", match.recipientId);

  const { data: campaign } = await supabase
    .from("whatsapp_campaigns")
    .select("name, stats")
    .eq("id", match.campaignId)
    .maybeSingle();

  if (campaign?.stats) {
    const stats = campaign.stats as Record<string, number>;
    stats.replied = (stats.replied ?? 0) + 1;
    if (classification === "opt_out") {
      stats.opt_out = (stats.opt_out ?? 0) + 1;
    }
    await supabase
      .from("whatsapp_campaigns")
      .update({ stats, updated_at: now })
      .eq("id", match.campaignId);
  }

  if (classification === "opt_out" && opts.contactId) {
    await recordWhatsAppOptOut({
      contactId: opts.contactId,
      clientId: opts.clientId,
      reason: opts.body.trim(),
    });
  }

  if (classification === "interested") {
    await logLeadEvent({
      leadId: opts.leadId,
      clientId: opts.clientId,
      actor: { id: null, name: "Customer", role: "CUSTOMER" },
      eventType: "CAMPAIGN_RESPONSE",
      eventData: {
        campaign_id: match.campaignId,
        campaign_name: campaign?.name ?? null,
        classification,
        body: opts.body.slice(0, 200),
      },
      channel: "whatsapp",
    });
  }

  const { data: recipient } = await supabase
    .from("whatsapp_campaign_recipients")
    .select("sent_at")
    .eq("id", match.recipientId)
    .maybeSingle();

  return {
    campaignId: match.campaignId,
    campaignName: (campaign?.name as string) ?? "Campaign",
    recipientId: match.recipientId,
    sentAt: (recipient?.sent_at as string | null) ?? null,
    responseClassification: classification,
  };
}

export async function getCampaignContextForLead(
  leadId: string
): Promise<CampaignReplyContext | null> {
  const supabase = createAdminClient();

  const { data: recipient } = await supabase
    .from("whatsapp_campaign_recipients")
    .select("id, campaign_id, sent_at, replied_at, response_classification")
    .eq("lead_id", leadId)
    .not("replied_at", "is", null)
    .order("replied_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!recipient) return null;

  const { data: campaign } = await supabase
    .from("whatsapp_campaigns")
    .select("name")
    .eq("id", recipient.campaign_id)
    .maybeSingle();

  return {
    campaignId: recipient.campaign_id as string,
    campaignName: (campaign?.name as string) ?? "Campaign",
    recipientId: recipient.id as string,
    sentAt: (recipient.sent_at as string | null) ?? null,
    responseClassification:
      (recipient.response_classification as ResponseClassification | null) ?? null,
  };
}
