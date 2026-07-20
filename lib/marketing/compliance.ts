import { createAdminClient } from "@/lib/supabase/admin";
import { getMarketingSettings, type MarketingSettings } from "./settings";

export function isWithinQuietHours(settings: MarketingSettings, now = new Date()): boolean {
  if (!settings.quiet_hours_start || !settings.quiet_hours_end) return false;

  const tz = settings.timezone || "Africa/Harare";
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const currentMinutes = hour * 60 + minute;

  const [startH, startM] = settings.quiet_hours_start.split(":").map(Number);
  const [endH, endM] = settings.quiet_hours_end.split(":").map(Number);
  const startMinutes = startH * 60 + (startM || 0);
  const endMinutes = endH * 60 + (endM || 0);

  if (startMinutes === endMinutes) return false;

  // Overnight window e.g. 20:00 → 08:00
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

export async function contactExceededFrequencyCap(
  clientId: string,
  contactId: string,
  settings?: MarketingSettings
): Promise<boolean> {
  const cfg = settings ?? (await getMarketingSettings(clientId));
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const supabase = createAdminClient();
  const { count } = await supabase
    .from("whatsapp_campaign_recipients")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("contact_id", contactId)
    .in("status", ["sent", "delivered", "read"])
    .gte("sent_at", since.toISOString());

  return (count ?? 0) >= cfg.max_messages_per_contact_per_week;
}

export async function hasDuplicateCampaignRecently(opts: {
  clientId: string;
  segmentId: string;
  templateName: string;
  excludeCampaignId?: string;
  settings?: MarketingSettings;
}): Promise<boolean> {
  const cfg = opts.settings ?? (await getMarketingSettings(opts.clientId));
  const since = new Date();
  since.setDate(since.getDate() - cfg.duplicate_campaign_days);

  const supabase = createAdminClient();
  let query = supabase
    .from("whatsapp_campaigns")
    .select("id")
    .eq("client_id", opts.clientId)
    .eq("audience_segment_id", opts.segmentId)
    .eq("template_name", opts.templateName)
    .in("status", ["sending", "completed", "scheduled", "pending_approval"])
    .gte("created_at", since.toISOString());

  if (opts.excludeCampaignId) {
    query = query.neq("id", opts.excludeCampaignId);
  }

  const { data } = await query.limit(1);
  return (data?.length ?? 0) > 0;
}

export async function shouldAutoPauseCampaign(campaignId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data: campaign } = await supabase
    .from("whatsapp_campaigns")
    .select("client_id, stats")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) return false;

  const settings = await getMarketingSettings(campaign.client_id as string);
  const stats = campaign.stats as { sent?: number; opt_out?: number };
  const sent = stats.sent ?? 0;
  const optOut = stats.opt_out ?? 0;

  if (sent < 20) return false;
  return optOut / sent >= settings.auto_pause_opt_out_rate;
}

export async function getContactsOverFrequencyCap(
  clientId: string,
  contactIds: string[]
): Promise<Set<string>> {
  if (contactIds.length === 0) return new Set();

  const settings = await getMarketingSettings(clientId);
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("whatsapp_campaign_recipients")
    .select("contact_id")
    .eq("client_id", clientId)
    .in("contact_id", contactIds)
    .in("status", ["sent", "delivered", "read"])
    .gte("sent_at", since.toISOString());

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const cid = row.contact_id as string;
    counts.set(cid, (counts.get(cid) ?? 0) + 1);
  }

  const blocked = new Set<string>();
  for (const cid of contactIds) {
    if ((counts.get(cid) ?? 0) >= settings.max_messages_per_contact_per_week) {
      blocked.add(cid);
    }
  }
  return blocked;
}
