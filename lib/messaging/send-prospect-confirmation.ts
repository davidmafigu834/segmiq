import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp } from "@/lib/messaging/provider";
import { firstName } from "@/lib/messaging/whatsapp-vars";
import { prospectEnquiryLabel } from "@/lib/format-form-data";
import { getPublicBaseUrl } from "@/lib/constants";
import { getPublicLandingPageUrl } from "@/lib/public-url";

/**
 * Sends the existing segmiq_lead_confirmation (LEAD_CONFIRMATION_PROSPECT) template.
 * Used by Event Capture because hub/manual createLead paths skip MANUAL sources.
 */
export async function sendProspectLeadConfirmation(opts: {
  clientId: string;
  phone: string;
  name: string | null;
  leadId?: string | null;
  projectType?: string | null;
  formData?: Record<string, unknown> | null;
  eventName?: string | null;
}): Promise<void> {
  const supabase = createAdminClient();

  const { data: client } = await supabase
    .from("clients")
    .select("name, response_time_limit_hours, send_prospect_confirmation")
    .eq("id", opts.clientId)
    .maybeSingle();

  if (!client) return;
  if ((client as { send_prospect_confirmation?: boolean }).send_prospect_confirmation === false) {
    return;
  }

  const companyName = (client.name as string) || "our team";
  const responseHours = String(
    Math.max(1, Math.round((client.response_time_limit_hours as number) || 2))
  );
  const prospectFirst = firstName(opts.name);

  const formData = {
    ...(opts.formData ?? {}),
    ...(opts.eventName ? { Event: opts.eventName } : {}),
  };

  const serviceDescription = prospectEnquiryLabel({
    project_type: opts.projectType ?? null,
    form_data: formData,
    requestedPackageName: null,
  }) || (opts.eventName ? `meeting us at ${opts.eventName}` : "your enquiry");

  const { data: profile } = await supabase
    .from("client_profiles")
    .select("slug, is_published")
    .eq("client_id", opts.clientId)
    .maybeSingle();
  const profileSlug = (profile as { slug?: string; is_published?: boolean } | null)?.slug;
  const profilePublished = Boolean(
    (profile as { is_published?: boolean } | null)?.is_published
  );
  const portfolioUrl =
    profileSlug && profilePublished ? getPublicLandingPageUrl(profileSlug) : getPublicBaseUrl();

  await sendWhatsApp({
    to: opts.phone,
    template: "LEAD_CONFIRMATION_PROSPECT",
    variables: {
      "1": prospectFirst,
      "2": companyName,
      "3": serviceDescription,
      "4": responseHours,
      "5": portfolioUrl,
    },
    fallbackBody: `Hi ${prospectFirst}, thanks for reaching out to ${companyName}. We've received your enquiry about ${serviceDescription} and someone from our team will be in touch within ${responseHours} hours.`,
    context: {
      leadId: opts.leadId ?? undefined,
      clientId: opts.clientId,
      notificationType: "LEAD_CONFIRMATION_PROSPECT",
    },
  });
}
