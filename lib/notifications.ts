import { createAdminClient } from "@/lib/supabase/admin";
import {
  renderManagerDealWonEmail,
  renderManagerNewLeadEmail,
  renderManagerUncontactedLeadEmail,
} from "@/lib/emailTemplates";
import { getPublicBaseUrl, magicLinkUrl } from "@/lib/constants";
import { formatCurrencyUsd } from "@/lib/format";
import type { LeadRow } from "@/types";
import {
  getManagerPrefs,
  parseSalesPrefs,
  type ManagerNotificationPrefs,
  type SalesNotificationPrefs,
} from "@/lib/notification-prefs";
import { sendWhatsApp, isWhatsAppDeliveryConfigured } from "@/lib/messaging/provider";
import { sendEmailWithLog } from "@/lib/messaging/email";
import { logMessage } from "@/lib/messaging/log";
import { background } from "@/lib/background";
import {
  extractLeadLocation,
  firstName,
  formatWaitingDuration,
} from "@/lib/messaging/whatsapp-vars";

type UserLite = { id: string; name: string; phone: string | null; email: string | null };

export type NotifyLeadOptions = {
  salesPrefs?: SalesNotificationPrefs | null;
};

function formatSource(source: string | null | undefined): string {
  if (!source) return "—";
  return String(source).replace(/_/g, " ");
}

type BulkReassignmentPayload = {
  clientId: string;
  leadIds: string[];
  actorId: string;
};

export async function notifyBulkReassignment({ clientId, leadIds, actorId }: BulkReassignmentPayload): Promise<void> {
  if (leadIds.length === 0) return;

  const supabase = createAdminClient();

  const { data: leads } = await supabase
    .from("leads")
    .select("id, assigned_to_id, name")
    .in("id", leadIds);

  if (!leads?.length) return;

  const leadsByAssignee = new Map<string, { leadIds: string[]; names: string[] }>();

  for (const lead of leads) {
    const assignedId = (lead.assigned_to_id as string | null) ?? null;
    if (!assignedId) continue;
    if (!leadsByAssignee.has(assignedId)) {
      leadsByAssignee.set(assignedId, { leadIds: [], names: [] });
    }
    const bucket = leadsByAssignee.get(assignedId)!;
    bucket.leadIds.push(lead.id as string);
    const name = (lead.name as string | null) ?? "Lead";
    bucket.names.push(name);
  }

  if (leadsByAssignee.size === 0) return;

  const assigneeIds = Array.from(leadsByAssignee.keys());

  const { data: users } = await supabase
    .from("users")
    .select("id, name, email, phone, notification_prefs")
    .in("id", assigneeIds)
    .eq("role", "SALESPERSON")
    .eq("is_active", true);

  if (!users?.length) return;

  const prefsById = new Map<string, SalesNotificationPrefs>();
  const phoneById = new Map<string, string | null>();
  const emailById = new Map<string, string | null>();
  const nameById = new Map<string, string>();

  for (const user of users) {
    const id = user.id as string;
    prefsById.set(id, parseSalesPrefs((user as { notification_prefs?: unknown }).notification_prefs));
    phoneById.set(id, (user.phone as string | null) ?? null);
    emailById.set(id, (user.email as string | null) ?? null);
    nameById.set(id, (user.name as string | null) ?? "Representative");
  }

  const { data: actorUser } = await supabase.from("users").select("name").eq("id", actorId).maybeSingle();
  const actorName = (actorUser as { name: string } | null)?.name ?? "Manager";

  const baseUrl = getPublicBaseUrl();
  const leadsUrl = `${baseUrl}/sales/leads`;

  const allowWhatsApp = isWhatsAppDeliveryConfigured();

  for (const [assigneeId, info] of Array.from(leadsByAssignee.entries())) {
    const count = info.leadIds.length;
    if (count === 0) continue;
    const prefs = prefsById.get(assigneeId) ?? parseSalesPrefs(null);
    const salespersonName = nameById.get(assigneeId) ?? "Representative";
    const firstLeadName = info.names[0] ?? "Lead";

    const summaryLine = count === 1 ? firstLeadName : `${firstLeadName} and ${count - 1} others`;
    const emailBody = `
      <p>Hi ${escapeHtml(salespersonName)},</p>
      <p>${escapeHtml(actorName)} reassigned ${count} lead${count === 1 ? "" : "s"} to you.</p>
      <p>${escapeHtml(summaryLine)}</p>
      <p><a href="${leadsUrl}">View your leads →</a></p>
    `;

    if (prefs.email) {
      const to = emailById.get(assigneeId);
      if (to && process.env.RESEND_FROM_EMAIL) {
        await sendEmailWithLog({
          mail: {
            to,
            from: process.env.RESEND_FROM_EMAIL,
            subject: `Assigned ${count} new lead${count === 1 ? "" : "s"}`,
            html: emailBody,
          },
          context: {
            userId: assigneeId,
            leadId: info.leadIds[0] ?? null,
            clientId,
            notificationType: "BULK_LEADS_ASSIGNED",
          },
          payloadPreview: `Assigned ${count} leads via bulk reassignment`,
        });
      } else {
        await logMessage(
          { ok: false, error: "Email skipped", errorCode: "SKIPPED_NO_RESEND" },
          {
            userId: assigneeId,
            leadId: info.leadIds[0] ?? null,
            clientId,
            channel: "email",
            notificationType: "BULK_LEADS_ASSIGNED",
            recipient: to ?? "(missing)",
            templateKey: null,
            payloadPreview: null,
          }
        );
      }
    }

    if (prefs.whatsapp && allowWhatsApp) {
      const phone = phoneById.get(assigneeId);
      if (phone) {
        const fallbackBody = `${actorName} assigned ${count} lead${count === 1 ? "" : "s"} to you. Check your Segmiq pipeline.`;
        await sendWhatsApp({
          to: phone,
          template: "BULK_LEADS_ASSIGNED",
          variables: {
            "1": salespersonName,
            "2": String(count),
            "3": actorName,
          },
          fallbackBody,
          context: {
            userId: assigneeId,
            leadId: info.leadIds[0] ?? null,
            clientId,
            notificationType: "BULK_LEADS_ASSIGNED",
          },
        });
      } else {
        await logMessage(
          { ok: false, error: "WhatsApp skipped", errorCode: "SKIPPED_NO_PHONE" },
          {
            userId: assigneeId,
            leadId: info.leadIds[0] ?? null,
            clientId,
            channel: "whatsapp",
            notificationType: "BULK_LEADS_ASSIGNED",
            recipient: "(no phone)",
            templateKey: "BULK_LEADS_ASSIGNED",
            payloadPreview: null,
          }
        );
      }
    }
  }
}

type InAppNotificationType =
  | "NEW_LEAD"
  | "FOLLOW_UP_DUE"
  | "DEAL_WON"
  | "LEAD_FLAG"
  | "UNCONTACTED_MANAGER_ALERT";

async function createInAppNotification(params: {
  userId: string;
  type: InAppNotificationType;
  message: string;
  leadId?: string | null;
}) {
  try {
    await createAdminClient().from("notifications").insert({
      user_id: params.userId,
      type: params.type,
      message: params.message,
      read: false,
      lead_id: params.leadId || null,
    });
  } catch (err) {
    console.error("[notifications] inApp insert failed", err);
  }
}

export async function notifyNewLead(
  lead: LeadRow,
  salesperson: UserLite,
  managers: UserLite[],
  clientTwilioOverride?: string | null,
  clientName = "Client",
  opts?: NotifyLeadOptions
): Promise<void> {
  const salesPrefs = opts?.salesPrefs ?? parseSalesPrefs(null);

  const budget = lead.budget ?? "—";
  const magicToken = lead.magic_token ?? "";
  const service = lead.project_type ?? formatSource(lead.source);
  const location = extractLeadLocation(lead);
  const leadLink = magicToken ? magicLinkUrl(magicToken) : getPublicBaseUrl();
  const fallbackSales = `New lead for ${clientName}. Name: ${lead.name ?? "—"} | Service: ${service} | Budget: ${budget} | Location: ${location}`;

  function newLeadTemplateVars(recipientName: string): Record<string, string> {
    return {
      "1": firstName(recipientName),
      "2": clientName,
      "3": lead.name || "Unknown",
      "4": lead.phone?.trim() || "—",
      "5": service,
      "6": leadLink,
    };
  }

  function managerNewLeadTemplateVars(managerName: string): Record<string, string> {
    return {
      "1": firstName(managerName),
      "2": salesperson.name,
      "3": clientName,
      "4": lead.name || "Unknown",
      "5": lead.phone?.trim() || "—",
      "6": service,
    };
  }

  if (salesPrefs.whatsapp) {
    if (!salesperson.phone?.trim()) {
      await logMessage(
        { ok: false, error: "No phone on file", errorCode: "SKIPPED_NO_PHONE" },
        {
          userId: salesperson.id,
          leadId: lead.id,
          clientId: lead.client_id,
          channel: "whatsapp",
          notificationType: "NEW_LEAD",
          recipient: "(none)",
          templateKey: "NEW_LEAD",
          payloadPreview: fallbackSales,
        }
      );
      console.log("[notifyNewLead] WhatsApp to salesperson: skipped (no phone)");
    } else {
      const r = await sendWhatsApp({
        to: salesperson.phone,
        toOverride: clientTwilioOverride,
        template: "NEW_LEAD",
        variables: newLeadTemplateVars(salesperson.name),
        fallbackBody: fallbackSales,
        context: {
          userId: salesperson.id,
          leadId: lead.id,
          clientId: lead.client_id,
          notificationType: "NEW_LEAD",
        },
      });
      if (r.ok) {
        console.log("[notifyNewLead] WhatsApp to salesperson: success");
      } else {
        console.error("[notifyNewLead] WhatsApp to salesperson:", r.error, r.errorCode);
      }
    }
  } else {
    await logMessage(
      { ok: false, error: "WhatsApp disabled in user preferences", errorCode: "SKIPPED_PREF" },
      {
        userId: salesperson.id,
        leadId: lead.id,
        clientId: lead.client_id,
        channel: "whatsapp",
        notificationType: "NEW_LEAD",
        recipient: salesperson.phone?.trim() || "(none)",
        templateKey: "NEW_LEAD",
        payloadPreview: fallbackSales,
      }
    );
    console.log("[notifyNewLead] WhatsApp to salesperson: skipped (user preference)");
  }

  if (salesPrefs.email) {
    const to = salesperson.email?.trim();
    if (!to) {
      await logMessage(
        { ok: false, error: "No email on file", errorCode: "SKIPPED_NO_EMAIL" },
        {
          userId: salesperson.id,
          leadId: lead.id,
          clientId: lead.client_id,
          channel: "email",
          notificationType: "NEW_LEAD",
          recipient: "(none)",
          payloadPreview: fallbackSales,
        }
      );
      console.log("[notifyNewLead] Email to salesperson: skipped (no email)");
    } else if (!process.env.RESEND_API_KEY) {
      await logMessage(
        { ok: false, error: "Resend API key not configured", errorCode: "NO_RESEND" },
        {
          userId: salesperson.id,
          leadId: lead.id,
          clientId: lead.client_id,
          channel: "email",
          notificationType: "NEW_LEAD",
          recipient: to,
          payloadPreview: fallbackSales,
        }
      );
      console.info("[notifyNewLead] Email to salesperson: skipped (Resend API key not configured)");
    } else if (!process.env.RESEND_FROM_EMAIL?.trim()) {
      await logMessage(
        { ok: false, error: "RESEND_FROM_EMAIL not set", errorCode: "NO_FROM_EMAIL" },
        {
          userId: salesperson.id,
          leadId: lead.id,
          clientId: lead.client_id,
          channel: "email",
          notificationType: "NEW_LEAD",
          recipient: to,
          payloadPreview: fallbackSales,
        }
      );
      console.error("[notifyNewLead] RESEND_FROM_EMAIL not set — salesperson email not sent");
    } else {
      const r = await sendEmailWithLog({
        mail: {
          to,
          from: process.env.RESEND_FROM_EMAIL,
          subject: `New lead: ${lead.name ?? "Lead"} — ${clientName}`,
          html: `
          <p>New lead assigned to you.</p>
          <ul>
            <li>Name: ${escapeHtml(lead.name)}</li>
            <li>Phone: ${escapeHtml(lead.phone)}</li>
            <li>Budget: ${escapeHtml(lead.budget)}</li>
            <li>Source: ${escapeHtml(lead.source)}</li>
          </ul>
          <p><a href="${magicToken ? magicLinkUrl(magicToken) : getPublicBaseUrl()}">View Lead</a></p>
        `,
        },
        context: {
          userId: salesperson.id,
          leadId: lead.id,
          clientId: lead.client_id,
          notificationType: "NEW_LEAD",
        },
        payloadPreview: `New lead email → ${to}`,
      });
      if (r.ok) console.log("[notifyNewLead] Email to salesperson: success");
      else console.error("[notifyNewLead] Email to salesperson:", r.error);
    }
  } else {
    console.log("[notifyNewLead] Email to salesperson: skipped (user preference)");
  }

  if (managers.length > 0) {
    for (const manager of managers) {
      const mp = getManagerPrefs((manager as UserLite & { notification_prefs?: unknown }).notification_prefs);
      const wants = mp.newLead.whatsapp || mp.newLead.email;
      if (!wants) {
        console.log("[notifyNewLead] Manager notifications skipped (all channels off for new lead)");
        continue;
      }

      const hasPhone = Boolean(manager.phone?.trim());
      const hasEmail = Boolean(manager.email?.trim());
      if (mp.newLead.whatsapp && hasPhone) {
        const managerFallback = `New lead for ${clientName} — assigned to ${salesperson.name}. ${lead.name ?? "Lead"} · ${service}`;
        const mr = await sendWhatsApp({
          to: manager.phone,
          toOverride: clientTwilioOverride,
          template: "NEW_LEAD_MANAGER",
          variables: managerNewLeadTemplateVars(manager.name),
          fallbackBody: managerFallback,
          context: {
            userId: manager.id,
            leadId: lead.id,
            clientId: lead.client_id,
            notificationType: "NEW_LEAD_MANAGER",
          },
        });
        if (mr.ok) console.log("[notifyNewLead] WhatsApp to manager: success");
        else console.error("[notifyNewLead] WhatsApp to manager:", mr.error, mr.errorCode);
      } else if (mp.newLead.whatsapp && !hasPhone) {
        await logMessage(
          { ok: false, error: "No phone on file", errorCode: "SKIPPED_NO_PHONE" },
          {
            userId: manager.id,
            leadId: lead.id,
            clientId: lead.client_id,
            channel: "whatsapp",
            notificationType: "NEW_LEAD_MANAGER",
            recipient: "(none)",
            templateKey: "NEW_LEAD_MANAGER",
          }
        );
        console.info("[notifyNewLead] manager WhatsApp skipped (no phone)");
      }
      if (mp.newLead.email && hasEmail) {
        if (!process.env.RESEND_API_KEY) {
          await logMessage(
            { ok: false, error: "Resend API key not configured", errorCode: "NO_RESEND" },
            {
              userId: manager.id,
              leadId: lead.id,
              clientId: lead.client_id,
              channel: "email",
              notificationType: "NEW_LEAD",
              recipient: manager.email!,
            }
          );
          console.info("[notifyNewLead] manager email skipped (Resend API key not configured)");
        } else if (!process.env.RESEND_FROM_EMAIL) {
          await logMessage(
            { ok: false, error: "RESEND_FROM_EMAIL not set", errorCode: "NO_FROM_EMAIL" },
            {
              userId: manager.id,
              leadId: lead.id,
              clientId: lead.client_id,
              channel: "email",
              notificationType: "NEW_LEAD",
              recipient: manager.email!,
            }
          );
          console.error("[notifyNewLead] RESEND_FROM_EMAIL not set — manager email not sent");
        } else {
          const r = await sendEmailWithLog({
            mail: {
              to: manager.email!,
              from: process.env.RESEND_FROM_EMAIL,
              subject: `New lead for ${clientName} — assigned to ${salesperson.name}`,
              html: renderManagerNewLeadEmail({
                lead,
                salesperson: { name: salesperson.name },
                client: { name: clientName },
              }),
            },
            context: {
              userId: manager.id,
              leadId: lead.id,
              clientId: lead.client_id,
              notificationType: "NEW_LEAD",
            },
          });
          if (r.ok) console.log("[notifyNewLead] Email to manager: success");
          else console.error("[notifyNewLead] Manager email failed:", r.error);
        }
      } else if (mp.newLead.email && !hasEmail) {
        console.info("[notifyNewLead] manager email skipped (no email)");
      }

      if (mp.newLead.whatsapp || mp.newLead.email) {
        await createInAppNotification({
          userId: manager.id,
          type: "NEW_LEAD",
          message: `New lead for ${clientName} — assigned to ${salesperson.name}`,
          leadId: lead.id,
        });
      }
    }
  }

  await createInAppNotification({
    userId: salesperson.id,
    type: "NEW_LEAD",
    message: `New lead: ${lead.name ?? "Lead"} — ${budget}`,
    leadId: lead.id,
  });
}

export async function notifyFollowUpDue(
  lead: LeadRow,
  salesperson: UserLite,
  clientTwilioOverride?: string | null,
  salesPrefs?: SalesNotificationPrefs | null
): Promise<void> {
  const prefs = salesPrefs ?? parseSalesPrefs(null);
  if (!prefs.followUpReminders) {
    console.log("[notifyFollowUpDue] skipped (user preference)");
    return;
  }

  const supabase = createAdminClient();
  const { data: lastCall } = await supabase
    .from("call_logs")
    .select("notes")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const topic = lead.project_type ?? lead.budget ?? "your enquiry";
  const lastNote = (lastCall?.notes as string | null)?.trim() || "No notes logged yet";
  const repFirst = firstName(salesperson.name);
  const magicToken = lead.magic_token ?? "";
  const leadLink = magicToken ? magicLinkUrl(magicToken) : getPublicBaseUrl();
  const fallbackBody = `Follow-up due with ${lead.name ?? "lead"} about ${topic}. Last note: ${lastNote}`;

  const r = await sendWhatsApp({
    to: salesperson.phone,
    toOverride: clientTwilioOverride,
    template: "FOLLOW_UP_REMINDER",
    variables: {
      "1": repFirst,
      "2": lead.name || "lead",
      "3": lastNote,
      "4": leadLink,
    },
    fallbackBody,
    context: {
      userId: salesperson.id,
      leadId: lead.id,
      clientId: lead.client_id,
      notificationType: "FOLLOW_UP_DUE",
    },
  });
  if (r.ok) console.log("[notifyFollowUpDue] WhatsApp: success");
  else console.error("[notifyFollowUpDue] WhatsApp:", r.error, r.errorCode);
}

export async function notifyDealWon(
  lead: LeadRow,
  salesperson: UserLite,
  manager: UserLite | null,
  clientTwilioOverride?: string | null,
  clientName = "Client",
  managerPrefs?: ManagerNotificationPrefs | null
): Promise<void> {
  if (!manager) {
    return;
  }
  const mp = managerPrefs ?? getManagerPrefs(null);
  if (!mp.dealWon.whatsapp && !mp.dealWon.email) {
    console.log("[notifyDealWon] skipped (all channels off for deal won)");
    return;
  }
  const hasPhone = Boolean(manager.phone?.trim());
  const hasEmail = Boolean(manager.email?.trim());
  if (mp.dealWon.whatsapp && hasPhone) {
    console.info("[notifyDealWon] manager WhatsApp skipped (no approved Meta template — email/in-app only)");
  } else if (mp.dealWon.whatsapp && !hasPhone) {
    console.info("[notifyDealWon] manager WhatsApp skipped (no phone)");
  }

  if (mp.dealWon.whatsapp || mp.dealWon.email) {
    await createInAppNotification({
      userId: manager.id,
      type: "DEAL_WON",
      message: `Deal won by ${salesperson.name} — ${lead.name ?? "Lead"}, ${formatCurrencyUsd(lead.deal_value ?? null)}`,
      leadId: lead.id,
    });
  }

  if (!mp.dealWon.email || !hasEmail) {
    return;
  }
  if (!process.env.RESEND_FROM_EMAIL) {
    await logMessage(
      { ok: false, error: "RESEND_FROM_EMAIL not set", errorCode: "NO_FROM_EMAIL" },
      {
        userId: manager.id,
        leadId: lead.id,
        clientId: lead.client_id,
        channel: "email",
        notificationType: "DEAL_WON",
        recipient: manager.email!,
      }
    );
    console.error("[notifyDealWon] RESEND_FROM_EMAIL not set — manager email not sent");
    return;
  }
  const dealSubject = formatCurrencyUsd(lead.deal_value ?? null);
  const r = await sendEmailWithLog({
    mail: {
      to: manager.email!,
      from: process.env.RESEND_FROM_EMAIL,
      subject: `Deal won — ${lead.name ?? "Lead"} · ${dealSubject}`,
      html: renderManagerDealWonEmail({
        lead,
        salesperson: { name: salesperson.name },
        client: { name: clientName },
      }),
    },
    context: {
      userId: manager.id,
      leadId: lead.id,
      clientId: lead.client_id,
      notificationType: "DEAL_WON",
    },
  });
  if (r.ok) console.log("[notifyDealWon] Email to manager: success");
  else console.error("[notifyDealWon] Manager won email failed:", r.error);
}

type UncontactedLeadRow = Pick<LeadRow, "id" | "name" | "created_at" | "client_id" | "assigned_to_id">;

/**
 * Alerts each active client manager once per lead when SLA is breached (idempotent on notifications row).
 */
export async function notifyUncontactedLeadToManager(
  lead: UncontactedLeadRow,
  client: { id: string; name: string; response_time_limit_hours: number },
  clientTwilioOverride: string | null
): Promise<void> {
  void clientTwilioOverride;
  const supabase = createAdminClient();
  const { data: managers } = await supabase
    .from("users")
    .select("id, name, email, phone, notification_prefs")
    .eq("client_id", client.id)
    .eq("role", "CLIENT_MANAGER")
    .eq("is_active", true);

  if (!managers?.length) return;

  const hoursUncontacted = Math.floor(
    (Date.now() - new Date(lead.created_at as string).getTime()) / (1000 * 60 * 60)
  );

  let salespersonName = "your team";
  let repEmail: string | null = null;
  let repPhone: string | null = null;
  if (lead.assigned_to_id) {
    const { data: sp } = await supabase
      .from("users")
      .select("name, email, phone")
      .eq("id", lead.assigned_to_id)
      .maybeSingle();
    if (sp?.name) salespersonName = sp.name as string;
    repEmail = (sp?.email as string | null) ?? null;
    repPhone = (sp?.phone as string | null) ?? null;
  }

  const slaHours = client.response_time_limit_hours ?? 2;

  for (const manager of managers) {
    const prefs = getManagerPrefs(manager.notification_prefs);
    if (!prefs.uncontactedLead.whatsapp && !prefs.uncontactedLead.email) continue;

    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", manager.id)
      .eq("lead_id", lead.id)
      .eq("type", "UNCONTACTED_MANAGER_ALERT")
      .maybeSingle();
    if (existing) continue;

    await createInAppNotification({
      userId: manager.id as string,
      type: "UNCONTACTED_MANAGER_ALERT",
      message: `${lead.name ?? "Lead"} uncontacted for ${hoursUncontacted}h`,
      leadId: lead.id,
    });

    if (prefs.uncontactedLead.whatsapp && manager.phone?.trim()) {
      console.info(
        "[notifyUncontactedLeadToManager] manager WhatsApp skipped (no approved Meta template — email/in-app only)"
      );
    }

    if (prefs.uncontactedLead.email && manager.email?.trim() && process.env.RESEND_FROM_EMAIL) {
      background("uncontactedLeadManagerEmail", async () => {
        const r = await sendEmailWithLog({
          mail: {
            to: manager.email as string,
            from: process.env.RESEND_FROM_EMAIL!,
            subject: `Uncontacted lead: ${lead.name ?? "Lead"} (${hoursUncontacted}h)`,
            html: renderManagerUncontactedLeadEmail({
              lead: { id: lead.id, name: lead.name },
              client: { name: client.name },
              hoursUncontacted,
              salespersonName,
              slaHours,
              salespersonEmail: repEmail,
              salespersonPhone: repPhone,
            }),
          },
          context: {
            userId: manager.id as string,
            leadId: lead.id,
            clientId: client.id,
            notificationType: "UNCONTACTED_MANAGER_ALERT",
          },
        });
        if (r.ok) console.log("[notifyUncontactedLeadToManager] Email: success");
        else console.error("[notifyUncontactedLeadToManager] Email:", r.error);
      });
    }
  }
}

/** WhatsApp SLA breach alert to the assigned salesperson (segmiq_sla_breach). Idempotent via message_logs. */
export async function notifySlaBreachToSalesperson(
  lead: Pick<LeadRow, "id" | "name" | "created_at" | "client_id" | "assigned_to_id" | "magic_token">,
  clientTwilioOverride: string | null
): Promise<void> {
  if (!lead.assigned_to_id || !isWhatsAppDeliveryConfigured()) {
    return;
  }

  const supabase = createAdminClient();

  const { data: prior } = await supabase
    .from("message_logs")
    .select("id")
    .eq("lead_id", lead.id)
    .eq("notification_type", "SLA_BREACH")
    .eq("status", "sent")
    .limit(1)
    .maybeSingle();
  if (prior) return;

  const { data: sp } = await supabase
    .from("users")
    .select("id, name, phone, notification_prefs")
    .eq("id", lead.assigned_to_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!sp?.phone?.trim()) return;

  const prefs = parseSalesPrefs((sp as { notification_prefs?: unknown }).notification_prefs);
  if (!prefs.whatsapp) return;

  const waiting = formatWaitingDuration(lead.created_at as string);
  const magicToken = lead.magic_token ?? "";
  const leadLink = magicToken ? magicLinkUrl(magicToken) : getPublicBaseUrl();
  const hoursWaiting = String(
    Math.max(1, Math.floor((Date.now() - new Date(lead.created_at as string).getTime()) / (1000 * 60 * 60)))
  );

  background("slaBreachSalespersonWhatsApp", async () => {
    const { data: clientRow } = await supabase
      .from("clients")
      .select("response_time_limit_hours")
      .eq("id", lead.client_id)
      .maybeSingle();
    const slaHours = String(Math.max(1, Math.round((clientRow?.response_time_limit_hours as number) || 2)));

    const r = await sendWhatsApp({
      to: sp.phone as string,
      toOverride: clientTwilioOverride,
      template: "SLA_BREACH",
      variables: {
        "1": firstName(sp.name as string),
        "2": lead.name || "your lead",
        "3": hoursWaiting,
        "4": slaHours,
        "5": leadLink,
      },
      fallbackBody: `Heads up ${firstName(sp.name as string)}, ${lead.name ?? "your lead"} has been waiting ${waiting} without a response.`,
      context: {
        userId: sp.id as string,
        leadId: lead.id,
        clientId: lead.client_id,
        notificationType: "SLA_BREACH",
      },
    });
    if (r.ok) console.log("[notifySlaBreachToSalesperson] WhatsApp: success");
    else console.error("[notifySlaBreachToSalesperson] WhatsApp:", r.error);
  });
}

export async function checkUncontactedLeads(): Promise<{ flagged: number }> {
  const supabase = createAdminClient();
  const { data: clients } = await supabase.from("clients").select("id, name, response_time_limit_hours, twilio_whatsapp_override");
  if (!clients?.length) return { flagged: 0 };

  const { data: admins } = await supabase
    .from("users")
    .select("id")
    .eq("role", "AGENCY_ADMIN")
    .eq("is_active", true);
  const adminIds = (admins ?? []).map((a) => a.id as string);
  if (!adminIds.length) return { flagged: 0 };

  let flagged = 0;
  const now = Date.now();

  for (const c of clients) {
    const hours = (c.response_time_limit_hours as number) ?? 2;
    const limitMs = hours * 60 * 60 * 1000;
    const twilioOverride = (c.twilio_whatsapp_override as string | null) ?? null;
    const { data: leads } = await supabase
      .from("leads")
      .select("id, name, created_at, client_id, assigned_to_id, magic_token")
      .eq("client_id", c.id)
      .eq("status", "NEW");
    for (const lead of leads ?? []) {
      const created = new Date(lead.created_at as string).getTime();
      if (now - created <= limitMs) continue;
      const { data: existingAdminFlag } = await supabase
        .from("notifications")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("type", "LEAD_FLAG")
        .limit(1)
        .maybeSingle();
      if (!existingAdminFlag) {
        for (const uid of adminIds) {
          const msg = `Lead overdue: client ${c.name} has NEW leads past the ${hours}h response window.`;
          const { error } = await supabase.from("notifications").insert({
            user_id: uid,
            type: "LEAD_FLAG",
            message: msg,
            read: false,
            lead_id: lead.id,
          });
          if (!error) flagged++;
        }
      }

      await notifyUncontactedLeadToManager(
        lead as UncontactedLeadRow,
        {
          id: c.id as string,
          name: (c.name as string) ?? "Client",
          response_time_limit_hours: hours,
        },
        twilioOverride
      );

      await notifySlaBreachToSalesperson(lead as LeadRow, twilioOverride);
    }
  }
  return { flagged };
}

export async function notifyAdminsNoSalesperson(params: {
  clientName: string;
  leadId: string;
  clientId?: string | null;
}): Promise<void> {
  const { data: admins } = await createAdminClient()
    .from("users")
    .select("id, email")
    .eq("role", "AGENCY_ADMIN")
    .eq("is_active", true);
  const key = process.env.RESEND_API_KEY;
  if (!key || !admins?.length) {
    console.warn("[notifyAdminsNoSalesperson] skipped — Resend not configured or no admins");
    return;
  }
  const from = process.env.RESEND_FROM_EMAIL || "noreply@example.com";
  const text = `A new lead (${params.leadId}) was created but no active salespeople exist for client ${params.clientName}.`;
  for (const a of admins) {
    const r = await sendEmailWithLog({
      mail: {
        to: a.email as string,
        from: from,
        subject: "Lead with no assignee",
        text,
      },
      context: {
        userId: a.id as string,
        leadId: params.leadId,
        clientId: params.clientId ?? null,
        notificationType: "NO_SALESPERSON",
      },
      payloadPreview: text,
    });
    if (!r.ok) console.error("[notifyAdminsNoSalesperson] email fail", r.error);
  }
}

export async function sendTokenExpiryAlert(clientId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, fb_page_name")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return;

  const { data: admins } = await supabase
    .from("users")
    .select("id, email, name")
    .eq("role", "AGENCY_ADMIN")
    .eq("is_active", true);

  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    console.warn("[sendTokenExpiryAlert] Resend not configured");
    return;
  }

  const reconnectUrl = `${getPublicBaseUrl()}/dashboard/clients/${clientId}/facebook`;
  const pageLine = client.fb_page_name ? `Page: ${escapeHtml(client.fb_page_name as string)}` : "";

  for (const admin of admins ?? []) {
    if (!admin.email) continue;
    const html = `
          <p>Hi ${escapeHtml((admin.name as string) || "there")},</p>
          <p>The Facebook connection for <strong>${escapeHtml(client.name as string)}</strong> has expired or was revoked. Lead Ads for this client are not flowing into Segmiq until you reconnect.</p>
          ${pageLine ? `<p>${pageLine}</p>` : ""}
          <p><a href="${reconnectUrl}">Reconnect now →</a></p>
          <p style="font-size:12px;color:#666">If the button does not work, copy this URL:<br/>${escapeHtml(reconnectUrl)}</p>
        `;
    const r = await sendEmailWithLog({
      mail: {
        to: admin.email as string,
        from: process.env.RESEND_FROM_EMAIL!,
        subject: `Facebook connection expired — ${client.name as string}`,
        html,
      },
      context: {
        userId: admin.id as string,
        leadId: null,
        clientId,
        notificationType: "TOKEN_EXPIRY",
      },
      payloadPreview: `Token expiry alert for client ${client.name}`,
    });
    if (!r.ok) console.error("[sendTokenExpiryAlert] send failed", r.error);
  }
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
