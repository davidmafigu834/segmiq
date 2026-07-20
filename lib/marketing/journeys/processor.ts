import { createAdminClient } from "@/lib/supabase/admin";
import { sendCampaignTemplate } from "../send-campaign-template";
import { isWithinQuietHours } from "../compliance";
import { getMarketingSettings } from "../settings";
import type { EnrollmentRow, JourneyRow, JourneyStep, JourneyStats } from "./types";

async function hasInboundSince(leadId: string, since: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("whatsapp_messages")
    .select("*", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .eq("direction", "inbound")
    .gte("created_at", since);
  return (count ?? 0) > 0;
}

async function leadStillEligible(leadId: string, journey: JourneyRow): Promise<boolean> {
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("status, updated_at")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return false;

  switch (journey.trigger_type) {
    case "quotation_no_response":
      return ["PROPOSAL_SENT", "NEGOTIATING", "CONTACTED"].includes(lead.status as string);
    case "dormant_lead":
      return ["NEW", "CONTACTED", "NEGOTIATING", "PROPOSAL_SENT"].includes(lead.status as string);
    case "customer_anniversary":
      return lead.status === "WON";
    case "lost_deal_funds":
      return lead.status === "LOST";
    default:
      return true;
  }
}

async function notifyAssignee(enrollment: EnrollmentRow, journey: JourneyRow): Promise<void> {
  if (!enrollment.lead_id) return;

  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("assigned_to_id, name")
    .eq("id", enrollment.lead_id)
    .maybeSingle();

  const assigneeId = lead?.assigned_to_id as string | null;
  if (!assigneeId) return;

  await supabase.from("notifications").insert({
    user_id: assigneeId,
    client_id: journey.client_id,
    lead_id: enrollment.lead_id,
    type: "LEAD_FLAG",
    title: `Journey follow-up: ${journey.name}`,
    body: `${lead?.name ?? "Lead"} has not responded to the ${journey.name} journey. Follow up now.`,
    read: false,
  });
}

async function sendJourneyWhatsApp(
  enrollment: EnrollmentRow,
  journey: JourneyRow
): Promise<{ ok: boolean; error?: string }> {
  if (!journey.template_name) {
    return { ok: false, error: "Journey has no WhatsApp template configured" };
  }

  const supabase = createAdminClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("name")
    .eq("id", enrollment.contact_id)
    .maybeSingle();

  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", journey.client_id)
    .maybeSingle();

  const firstName = ((contact?.name as string | null) ?? "").split(" ")[0] || "there";
  const companyName = (client?.name as string) ?? "Our team";
  const variables: Record<string, string> = {};

  for (const [k, v] of Object.entries(journey.template_variables ?? {})) {
    variables[k] = String(v)
      .replace(/\{\{first_name\}\}/gi, firstName)
      .replace(/\{\{company_name\}\}/gi, companyName);
  }

  const result = await sendCampaignTemplate({
    to: enrollment.phone,
    templateName: journey.template_name,
    language: journey.template_language ?? "en",
    variables,
    fallbackBody: journey.name,
    context: {
      clientId: journey.client_id,
      leadId: enrollment.lead_id,
      notificationType: "WHATSAPP_JOURNEY",
    },
  });

  if (result.ok && enrollment.lead_id) {
    await supabase.from("whatsapp_messages").insert({
      client_id: journey.client_id,
      lead_id: enrollment.lead_id,
      direction: "outbound",
      provider_id: result.providerId ?? null,
      phone: enrollment.phone,
      body: journey.name,
      message_type: "template",
      status: "sent",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const stats = (journey.stats as JourneyStats) ?? {
      enrolled: 0,
      completed: 0,
      cancelled: 0,
      messages_sent: 0,
    };
    stats.messages_sent = (stats.messages_sent ?? 0) + 1;
    await supabase
      .from("marketing_journeys")
      .update({ stats, updated_at: new Date().toISOString() })
      .eq("id", journey.id);
  }

  return { ok: result.ok, error: result.error };
}

async function advanceEnrollment(
  enrollment: EnrollmentRow,
  journey: JourneyRow,
  nextIndex: number,
  nextRunAt: string | null,
  status: EnrollmentRow["status"] = "active"
): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    current_step_index: nextIndex,
    next_run_at: nextRunAt,
    status,
    updated_at: now,
  };
  if (status === "completed" || status === "cancelled") {
    patch.completed_at = now;
  }

  await supabase.from("marketing_journey_enrollments").update(patch).eq("id", enrollment.id);

  if (status === "completed" || status === "cancelled") {
    const stats = (journey.stats as JourneyStats) ?? {
      enrolled: 0,
      completed: 0,
      cancelled: 0,
      messages_sent: 0,
    };
    if (status === "completed") stats.completed = (stats.completed ?? 0) + 1;
    if (status === "cancelled") stats.cancelled = (stats.cancelled ?? 0) + 1;
    await supabase
      .from("marketing_journeys")
      .update({ stats, updated_at: now })
      .eq("id", journey.id);
  }
}

async function executeStep(
  step: JourneyStep,
  enrollment: EnrollmentRow,
  journey: JourneyRow
): Promise<{ nextIndex: number; nextRunAt: string | null; done: boolean; cancelled: boolean }> {
  const steps = journey.steps as JourneyStep[];
  const currentIndex = enrollment.current_step_index;

  switch (step.type) {
    case "send_whatsapp": {
      const settings = await getMarketingSettings(journey.client_id);
      if (isWithinQuietHours(settings)) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(8, 0, 0, 0);
        return { nextIndex: currentIndex, nextRunAt: tomorrow.toISOString(), done: false, cancelled: false };
      }

      const result = await sendJourneyWhatsApp(enrollment, journey);
      if (!result.ok) {
        const supabase = createAdminClient();
        await supabase
          .from("marketing_journey_enrollments")
          .update({
            status: "failed",
            last_error: result.error ?? "Send failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", enrollment.id);
        return { nextIndex: currentIndex, nextRunAt: null, done: true, cancelled: false };
      }
      return {
        nextIndex: currentIndex + 1,
        nextRunAt: new Date().toISOString(),
        done: currentIndex + 1 >= steps.length,
        cancelled: false,
      };
    }

    case "wait_days": {
      const days = Number(step.config?.days ?? 1);
      const next = new Date();
      next.setDate(next.getDate() + days);
      return {
        nextIndex: currentIndex + 1,
        nextRunAt: next.toISOString(),
        done: currentIndex + 1 >= steps.length,
        cancelled: false,
      };
    }

    case "check_still_eligible": {
      if (!enrollment.lead_id) {
        return { nextIndex: currentIndex + 1, nextRunAt: new Date().toISOString(), done: false, cancelled: false };
      }

      const eligible = await leadStillEligible(enrollment.lead_id, journey);
      const replied = await hasInboundSince(
        enrollment.lead_id,
        enrollment.enrolled_at
      );

      if (!eligible || replied) {
        return { nextIndex: currentIndex, nextRunAt: null, done: true, cancelled: true };
      }

      return {
        nextIndex: currentIndex + 1,
        nextRunAt: new Date().toISOString(),
        done: currentIndex + 1 >= steps.length,
        cancelled: false,
      };
    }

    case "notify_assignee": {
      await notifyAssignee(enrollment, journey);
      return {
        nextIndex: currentIndex + 1,
        nextRunAt: new Date().toISOString(),
        done: currentIndex + 1 >= steps.length,
        cancelled: false,
      };
    }

    case "complete":
    default:
      return { nextIndex: currentIndex + 1, nextRunAt: null, done: true, cancelled: false };
  }
}

export async function processEnrollment(enrollment: EnrollmentRow, journey: JourneyRow): Promise<void> {
  const steps = journey.steps as JourneyStep[];
  if (enrollment.current_step_index >= steps.length) {
    await advanceEnrollment(enrollment, journey, steps.length, null, "completed");
    return;
  }

  const step = steps[enrollment.current_step_index];
  const result = await executeStep(step, enrollment, journey);

  if (result.cancelled) {
    await advanceEnrollment(enrollment, journey, enrollment.current_step_index, null, "cancelled");
    return;
  }

  if (result.done || result.nextIndex >= steps.length) {
    await advanceEnrollment(enrollment, journey, result.nextIndex, null, "completed");
    return;
  }

  await advanceEnrollment(enrollment, journey, result.nextIndex, result.nextRunAt, "active");
}

export async function processDueEnrollments(): Promise<number> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: due } = await supabase
    .from("marketing_journey_enrollments")
    .select("*")
    .eq("status", "active")
    .lte("next_run_at", now)
    .order("next_run_at", { ascending: true })
    .limit(50);

  let processed = 0;

  for (const row of (due ?? []) as EnrollmentRow[]) {
    const { data: journey } = await supabase
      .from("marketing_journeys")
      .select("*")
      .eq("id", row.journey_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!journey) {
      await supabase
        .from("marketing_journey_enrollments")
        .update({ status: "cancelled", updated_at: now })
        .eq("id", row.id);
      continue;
    }

    try {
      await processEnrollment(row, journey as JourneyRow);
      processed++;
    } catch (err) {
      console.error("[journeys] process enrollment failed", row.id, err);
    }
  }

  return processed;
}
