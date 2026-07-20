import { createAdminClient } from "@/lib/supabase/admin";
import {
  filterEligibleRecipients,
  resolveSegmentAudience,
} from "./audience-resolver";
import {
  getContactsOverFrequencyCap,
  hasDuplicateCampaignRecently,
  isWithinQuietHours,
  shouldAutoPauseCampaign,
} from "./compliance";
import { getMarketingSettings } from "./settings";
import { sendCampaignTemplate } from "./send-campaign-template";
import type { CampaignStats } from "./types";
import { cacheCampaignAttribution } from "./attribution";
import { EMPTY_CAMPAIGN_STATS as EMPTY_STATS } from "./types";

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mergeStats(rows: { status: string }[]): CampaignStats {
  const stats = { ...EMPTY_STATS };
  stats.total = rows.length;
  for (const row of rows) {
    switch (row.status) {
      case "sent":
        stats.sent++;
        break;
      case "delivered":
        stats.delivered++;
        break;
      case "read":
        stats.read++;
        break;
      case "failed":
        stats.failed++;
        break;
      case "skipped":
        stats.skipped++;
        break;
      default:
        break;
    }
  }
  return stats;
}

export async function prepareCampaignRecipients(campaignId: string): Promise<{
  ok: boolean;
  error?: string;
  recipientCount?: number;
}> {
  const supabase = createAdminClient();

  const { data: campaign, error: campErr } = await supabase
    .from("whatsapp_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();

  if (campErr || !campaign) {
    return { ok: false, error: "Campaign not found" };
  }

  if (!campaign.audience_segment_id) {
    return { ok: false, error: "Campaign has no audience segment" };
  }

  const settings = await getMarketingSettings(campaign.client_id as string);

  const isDuplicate = await hasDuplicateCampaignRecently({
    clientId: campaign.client_id as string,
    segmentId: campaign.audience_segment_id as string,
    templateName: campaign.template_name as string,
    excludeCampaignId: campaignId,
    settings,
  });

  if (isDuplicate) {
    return {
      ok: false,
      error: `A campaign with this audience and template was sent within the last ${settings.duplicate_campaign_days} days`,
    };
  }

  const { recipients } = await resolveSegmentAudience(
    campaign.client_id as string,
    campaign.audience_segment_id as string
  );

  const eligible = filterEligibleRecipients(recipients);
  const freqBlocked = await getContactsOverFrequencyCap(
    campaign.client_id as string,
    eligible.map((r) => r.contactId)
  );

  const now = new Date().toISOString();

  const rows = recipients.map((r) => {
    const isEligible = eligible.some((e) => e.contactId === r.contactId);
    let skipReason: string | null = null;
    if (!isEligible) {
      if (r.consentStatus === "opted_out") skipReason = "opted_out";
      else if (r.consentStatus === "unknown") skipReason = "consent_unknown";
      else skipReason = "not_eligible";
    } else if (freqBlocked.has(r.contactId)) {
      skipReason = "frequency_cap";
    }

    const canSend = isEligible && !freqBlocked.has(r.contactId);

    return {
      campaign_id: campaignId,
      client_id: campaign.client_id,
      contact_id: r.contactId,
      lead_id: r.leadId,
      phone: r.phone,
      status: canSend ? "pending" : "skipped",
      skip_reason: skipReason,
      created_at: now,
      updated_at: now,
    };
  });

  await supabase.from("whatsapp_campaign_recipients").delete().eq("campaign_id", campaignId);

  if (rows.length > 0) {
    const { error: insertErr } = await supabase.from("whatsapp_campaign_recipients").insert(rows);
    if (insertErr) {
      return { ok: false, error: insertErr.message };
    }
  }

  const sendable = rows.filter((r) => r.status === "pending").length;

  const stats: CampaignStats = {
    total: rows.length,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    skipped: rows.filter((r) => r.status === "skipped").length,
    replied: 0,
    opt_out: 0,
  };

  await supabase
    .from("whatsapp_campaigns")
    .update({
      estimated_recipients: sendable,
      stats,
      updated_at: now,
    })
    .eq("id", campaignId);

  return { ok: true, recipientCount: sendable };
}

export async function sendCampaignTest(opts: {
  campaignId: string;
  testPhone: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient();
  const { data: campaign } = await supabase
    .from("whatsapp_campaigns")
    .select("*")
    .eq("id", opts.campaignId)
    .maybeSingle();

  if (!campaign) return { ok: false, error: "Campaign not found" };

  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", campaign.client_id)
    .maybeSingle();

  const variables = (campaign.template_variables as Record<string, string>) ?? {};
  const resolved: Record<string, string> = {};
  for (const [k, v] of Object.entries(variables)) {
    resolved[k] = v
      .replace(/\{\{first_name\}\}/gi, "Test")
      .replace(/\{\{company_name\}\}/gi, (client?.name as string) ?? "Company");
  }

  const result = await sendCampaignTemplate({
    to: opts.testPhone,
    templateName: campaign.template_name as string,
    language: (campaign.template_language as string) ?? "en",
    variables: resolved,
    components: (campaign.template_components as Record<string, unknown>[]) ?? [],
    fallbackBody: "Test send",
    context: {
      clientId: campaign.client_id as string,
      notificationType: "WHATSAPP_CAMPAIGN_TEST",
    },
  });

  if (!result.ok) return { ok: false, error: result.error ?? "Test send failed" };

  await supabase
    .from("whatsapp_campaigns")
    .update({
      test_sent_at: new Date().toISOString(),
      test_sent_to: opts.testPhone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.campaignId);

  return { ok: true };
}

export async function submitCampaignForLaunch(
  campaignId: string,
  userId: string
): Promise<{ ok: boolean; error?: string; requiresApproval?: boolean }> {
  const supabase = createAdminClient();

  const { data: campaign } = await supabase
    .from("whatsapp_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) return { ok: false, error: "Campaign not found" };
  if (campaign.status !== "draft") {
    return { ok: false, error: "Campaign cannot be submitted in its current state" };
  }
  if (!campaign.test_sent_at) {
    return { ok: false, error: "Send a test message before launching this campaign" };
  }
  if (!campaign.audience_segment_id || !campaign.template_name) {
    return { ok: false, error: "Campaign is missing audience or template" };
  }

  const prep = await prepareCampaignRecipients(campaignId);
  if (!prep.ok) return prep;

  const settings = await getMarketingSettings(campaign.client_id as string);
  const recipientCount = prep.recipientCount ?? 0;
  const requiresApproval = recipientCount > settings.approval_threshold;
  const now = new Date().toISOString();

  await supabase
    .from("whatsapp_campaigns")
    .update({
      status: requiresApproval ? "pending_approval" : "sending",
      started_at: requiresApproval ? null : now,
      created_by: userId,
      updated_at: now,
    })
    .eq("id", campaignId);

  return { ok: true, requiresApproval };
}

export async function approveCampaign(
  campaignId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient();

  const { data: campaign } = await supabase
    .from("whatsapp_campaigns")
    .select("status")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) return { ok: false, error: "Campaign not found" };
  if (campaign.status !== "pending_approval") {
    return { ok: false, error: "Campaign is not awaiting approval" };
  }

  const now = new Date().toISOString();
  await supabase
    .from("whatsapp_campaigns")
    .update({
      status: "sending",
      approved_by: userId,
      approved_at: now,
      started_at: now,
      updated_at: now,
    })
    .eq("id", campaignId);

  return { ok: true };
}

/** @deprecated Use submitCampaignForLaunch */
export async function launchCampaign(campaignId: string, userId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const result = await submitCampaignForLaunch(campaignId, userId);
  return result;
}

function substituteVariables(
  variables: Record<string, string>,
  contact: { name: string | null },
  clientName: string
): Record<string, string> {
  const firstName = (contact.name ?? "").split(" ")[0] || "there";
  const resolved: Record<string, string> = {};

  for (const [key, val] of Object.entries(variables)) {
    let text = val;
    text = text.replace(/\{\{first_name\}\}/gi, firstName);
    text = text.replace(/\{\{company_name\}\}/gi, clientName);
    resolved[key] = text;
  }

  return resolved;
}

export async function processCampaignBatch(campaignId: string): Promise<{
  processed: number;
  completed: boolean;
}> {
  const supabase = createAdminClient();

  const { data: campaign } = await supabase
    .from("whatsapp_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("status", "sending")
    .maybeSingle();

  if (!campaign) return { processed: 0, completed: false };

  const settings = await getMarketingSettings(campaign.client_id as string);
  if (isWithinQuietHours(settings)) {
    return { processed: 0, completed: false };
  }

  if (await shouldAutoPauseCampaign(campaignId)) {
    await supabase
      .from("whatsapp_campaigns")
      .update({ status: "paused", updated_at: new Date().toISOString() })
      .eq("id", campaignId);
    return { processed: 0, completed: false };
  }

  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", campaign.client_id)
    .maybeSingle();

  const clientName = (client?.name as string) ?? "Our team";
  const variables = (campaign.template_variables as Record<string, string>) ?? {};
  const components = (campaign.template_components as Record<string, unknown>[]) ?? [];

  const { data: pending } = await supabase
    .from("whatsapp_campaign_recipients")
    .select("id, contact_id, lead_id, phone")
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (!pending?.length) {
    const { data: allRecipients } = await supabase
      .from("whatsapp_campaign_recipients")
      .select("status")
      .eq("campaign_id", campaignId);

    const stats = mergeStats((allRecipients ?? []) as { status: string }[]);
    const now = new Date().toISOString();

    await supabase
      .from("whatsapp_campaigns")
      .update({
        status: "completed",
        completed_at: now,
        stats,
        updated_at: now,
      })
      .eq("id", campaignId);

    try {
      await cacheCampaignAttribution(campaign.client_id as string, campaignId);
    } catch (err) {
      console.error("[campaign-send] attribution cache failed", err);
    }

    return { processed: 0, completed: true };
  }

  let processed = 0;

  for (const recipient of pending) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("name")
      .eq("id", recipient.contact_id)
      .maybeSingle();

    const resolvedVars = substituteVariables(
      variables,
      { name: (contact?.name as string | null) ?? null },
      clientName
    );

    const fallbackBody = Object.values(resolvedVars).join(" · ") || campaign.template_name;

    const result = await sendCampaignTemplate({
      to: recipient.phone as string,
      templateName: campaign.template_name as string,
      language: (campaign.template_language as string) ?? "en",
      variables: resolvedVars,
      components,
      fallbackBody,
      context: {
        clientId: campaign.client_id as string,
        leadId: (recipient.lead_id as string | null) ?? null,
        notificationType: "WHATSAPP_CAMPAIGN",
      },
    });

    const now = new Date().toISOString();

    if (result.ok) {
      await supabase
        .from("whatsapp_campaign_recipients")
        .update({
          status: "sent",
          provider_message_id: result.providerId ?? null,
          sent_at: now,
          updated_at: now,
        })
        .eq("id", recipient.id);

      if (recipient.lead_id) {
        await supabase.from("whatsapp_messages").insert({
          client_id: campaign.client_id,
          lead_id: recipient.lead_id,
          direction: "outbound",
          provider_id: result.providerId ?? null,
          phone: recipient.phone,
          body: fallbackBody,
          message_type: "template",
          status: "sent",
          campaign_id: campaignId,
          created_at: now,
          updated_at: now,
        });
      }
    } else {
      await supabase
        .from("whatsapp_campaign_recipients")
        .update({
          status: "failed",
          error_message: result.error ?? "Send failed",
          updated_at: now,
        })
        .eq("id", recipient.id);
    }

    processed++;
  }

  if (processed > 0) {
    await sleep(BATCH_DELAY_MS);
  }

  if (await shouldAutoPauseCampaign(campaignId)) {
    await supabase
      .from("whatsapp_campaigns")
      .update({ status: "paused", updated_at: new Date().toISOString() })
      .eq("id", campaignId);
    return { processed, completed: false };
  }

  const { count: remaining } = await supabase
    .from("whatsapp_campaign_recipients")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  if ((remaining ?? 0) === 0) {
    const { data: allRecipients } = await supabase
      .from("whatsapp_campaign_recipients")
      .select("status")
      .eq("campaign_id", campaignId);

    const stats = mergeStats((allRecipients ?? []) as { status: string }[]);
    const now = new Date().toISOString();

    await supabase
      .from("whatsapp_campaigns")
      .update({
        status: "completed",
        completed_at: now,
        stats,
        updated_at: now,
      })
      .eq("id", campaignId);

    try {
      await cacheCampaignAttribution(campaign.client_id as string, campaignId);
    } catch (err) {
      console.error("[campaign-send] attribution cache failed", err);
    }

    return { processed, completed: true };
  }

  return { processed, completed: false };
}

export async function processActiveCampaigns(): Promise<{
  campaignsProcessed: number;
  messagesSent: number;
}> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: scheduled } = await supabase
    .from("whatsapp_campaigns")
    .select("id, client_id")
    .eq("status", "scheduled")
    .lte("scheduled_at", now);

  for (const camp of scheduled ?? []) {
    const settings = await getMarketingSettings(camp.client_id as string);
    if (isWithinQuietHours(settings)) continue;

    await supabase
      .from("whatsapp_campaigns")
      .update({ status: "sending", started_at: now, updated_at: now })
      .eq("id", camp.id);
  }

  const { data: sending } = await supabase
    .from("whatsapp_campaigns")
    .select("id")
    .eq("status", "sending");

  let campaignsProcessed = 0;
  let messagesSent = 0;

  for (const camp of sending ?? []) {
    const result = await processCampaignBatch(camp.id as string);
    campaignsProcessed++;
    messagesSent += result.processed;
  }

  return { campaignsProcessed, messagesSent };
}
