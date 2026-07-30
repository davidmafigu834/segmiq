import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOnboardingToken, onboardingLink } from "@/lib/onboarding/tokens";
import { ONBOARDING_TOKEN_TTL_DAYS } from "@/lib/onboarding/constants";
import { sendEmail } from "@/lib/email/resend";
import { onboardingLinkEmail } from "@/lib/email/templates/onboarding-link";
import { proposalResponseEmail } from "@/lib/email/templates/proposal-response";
import {
  mapClientPlanToCrmPlan,
  getPlanAmount,
  periodEndFromStart,
  type BillingCycle,
} from "@/lib/billing/plans";
import { getPublicBaseUrl } from "@/lib/constants";
import { formatMoney } from "@/lib/proposals/totals";

function placeholderSlug(): string {
  return `pending-${randomBytes(6).toString("hex")}`;
}

type ProposalRecord = {
  id: string;
  proposal_number: string | null;
  title: string | null;
  company_name: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  submission_id: string | null;
  client_id: string | null;
  proposed_mode: string | null;
  proposed_plan: string | null;
  billing_cycle: string | null;
  currency: string | null;
  total: number | null;
};

export type ProvisionResult = {
  provisioned: boolean;
  clientId?: string;
  reason?: string;
};

/**
 * Provision a tenant from an accepted proposal:
 *  1. Create a pending client shell + onboarding token, email the owner.
 *  2. Create a draft CRM subscription (placeholder, does not gate access).
 *  3. Mark the linked marketing submission as converted.
 *  4. Link the client back onto the proposal for traceability.
 *
 * Safe to skip (returns provisioned: false) when the recipient email is missing
 * or already belongs to a user, or when the proposal already provisioned a client.
 */
export async function provisionClientFromProposal(
  supabase: SupabaseClient,
  proposal: ProposalRecord
): Promise<ProvisionResult> {
  if (proposal.client_id) {
    return { provisioned: false, clientId: proposal.client_id, reason: "Already provisioned" };
  }

  const ownerEmail = proposal.recipient_email?.toLowerCase().trim();
  if (!ownerEmail) {
    return { provisioned: false, reason: "No recipient email on proposal" };
  }

  const { data: emailDupe } = await supabase
    .from("users")
    .select("id")
    .eq("email", ownerEmail)
    .maybeSingle();
  if (emailDupe) {
    return { provisioned: false, reason: "Owner email is already registered" };
  }

  const mode = proposal.proposed_mode === "solo" ? "solo" : "team";
  const clientPlan = proposal.proposed_plan ?? "starter";

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .insert({
      name: proposal.company_name?.trim() || "Pending setup",
      industry: "Pending",
      slug: placeholderSlug(),
      mode,
      plan: clientPlan,
      owner_email: ownerEmail,
      setup_status: "pending",
      is_active: false,
    })
    .select("id")
    .single();

  if (clientErr || !client) {
    console.error("[provisionClientFromProposal] client insert", clientErr);
    return { provisioned: false, reason: "Failed to create client" };
  }

  const clientId = client.id as string;

  // Onboarding token + email (best-effort; do not roll back the client).
  try {
    const { token } = await createOnboardingToken(clientId);
    const link = onboardingLink(token);
    const { subject, html } = onboardingLinkEmail({
      link,
      expiresInDays: ONBOARDING_TOKEN_TTL_DAYS,
      clientName: proposal.company_name ?? undefined,
    });
    const res = await sendEmail({ to: ownerEmail, subject, html });
    if (!res.success) console.error("[provisionClientFromProposal] onboarding email", res.error);
  } catch (err) {
    console.error("[provisionClientFromProposal] onboarding token", err);
  }

  // Draft CRM subscription placeholder.
  const crmPlan = mapClientPlanToCrmPlan(clientPlan);
  const cycle: BillingCycle = proposal.billing_cycle === "annual" ? "annual" : "monthly";
  const start = new Date();
  await supabase.from("subscriptions").insert({
    client_id: clientId,
    product: "crm",
    plan: crmPlan,
    billing_cycle: cycle,
    amount: getPlanAmount(crmPlan, cycle),
    currency: proposal.currency ?? "USD",
    status: "draft",
    current_period_start: start.toISOString(),
    current_period_end: periodEndFromStart(start, cycle).toISOString(),
    grace_days: 7,
  });

  // Convert the originating marketing submission.
  if (proposal.submission_id) {
    await supabase
      .from("marketing_submissions")
      .update({ status: "converted" })
      .eq("id", proposal.submission_id);
  }

  // Trace the provisioned tenant back onto the proposal.
  await supabase
    .from("agency_proposals")
    .update({ client_id: clientId, updated_at: new Date().toISOString() })
    .eq("id", proposal.id);

  return { provisioned: true, clientId };
}

/** Email all active agency admins when a prospect accepts or rejects a proposal. */
export async function notifyStaffOfProposalResponse(
  proposal: ProposalRecord,
  action: "accepted" | "rejected",
  provisioned: boolean
): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    console.warn("[notifyStaffOfProposalResponse] Resend not configured — skipping");
    return;
  }
  const supabase = createAdminClient();
  const { data: admins } = await supabase
    .from("users")
    .select("email")
    .eq("role", "SUPER_ADMIN")
    .eq("is_active", true);
  const recipients = (admins ?? [])
    .map((a) => a.email as string | null)
    .filter((e): e is string => Boolean(e));
  if (!recipients.length) return;

  const { subject, html } = proposalResponseEmail({
    action,
    proposalNumber: proposal.proposal_number || "(draft)",
    proposalTitle: proposal.title || "Proposal",
    companyName: proposal.company_name,
    recipientName: proposal.recipient_name,
    total: formatMoney(Number(proposal.total) || 0, proposal.currency || "USD"),
    dashboardUrl: `${getPublicBaseUrl()}/dashboard/proposals`,
    provisioned,
  });
  const res = await sendEmail({ to: recipients, subject, html });
  if (!res.success) console.error("[notifyStaffOfProposalResponse] email fail", res.error);
}
