import { createAdminClient } from "@/lib/supabase/admin";
import {
  renderManagerDealWonEmail,
  renderManagerNewLeadEmail,
  renderManagerUncontactedLeadEmail,
} from "@/lib/emailTemplates";
import { APP_NAME, getPublicBaseUrl, magicLinkUrl } from "@/lib/constants";
import { formatCurrencyUsd } from "@/lib/format";
import type { LeadRow } from "@/types";
import {
  getManagerPrefs,
  parseSalesPrefs,
  type ManagerNotificationPrefs,
  type SalesNotificationPrefs,
} from "@/lib/notification-prefs";
import { sendWhatsApp } from "@/lib/messaging/provider";
import { sendEmailWithLog } from "@/lib/messaging/email";
import { logMessage } from "@/lib/messaging/log";
import { background } from "@/lib/background";

type UserLite = { id: string; name: string; phone: string | null; email: string | null };

export type NotifyLeadOptions = {
  salesPrefs?: SalesNotificationPrefs | null;
  managerPrefs?: ManagerNotificationPrefs | null;
};

function formatSource(source: string | null | undefined): string {
  if (!source) return "—";
  return String(source).replace(/_/g, " ");
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
  manager: UserLite | null,
  clientTwilioOverride?: string | null,
  clientName = "Client",
  opts?: NotifyLeadOptions
): Promise<void> {
  const salesPrefs = opts?.salesPrefs ?? parseSalesPrefs(null);
  const managerPrefs = opts?.managerPrefs ?? getManagerPrefs(null);

  const magic = lead.magic_token ? magicLinkUrl(lead.magic_token) : getPublicBaseUrl();
  const budget = lead.budget ?? "—";
  const fallbackSales = `New lead assigned to you on ${APP_NAME}. Name: ${lead.name ?? "—"} | Phone: ${lead.phone ?? "—"} | Budget: ${budget} | Source: ${lead.source} | ${magic}`;

  if (salesPrefs.whatsapp) {
    const r = await sendWhatsApp({
      to: salesperson.phone,
      toOverride: clientTwilioOverride,
      template: "NEW_LEAD_SALESPERSON",
      variables: {
        "1": lead.name || "Unknown",
        "2": lead.phone || "—",
        "3": budget,
        "4": formatSource(lead.source),
        "5": magic,
      },
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
  } else {
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
          <p><a href="${magic}">View Lead</a></p>
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

  if (manager) {
    const mp = managerPrefs;
    const wants = mp.newLead.whatsapp || mp.newLead.email;
    if (!wants) {
      console.log("[notifyNewLead] Manager notifications skipped (all channels off for new lead)");
    } else {
      const hasPhone = Boolean(manager.phone?.trim());
      const hasEmail = Boolean(manager.email?.trim());
      if (mp.newLead.whatsapp && hasPhone) {
        const fallbackMgr = `New lead assigned to ${salesperson.name} for ${clientName}. Log in to view your pipeline.`;
        const r = await sendWhatsApp({
          to: manager.phone,
          toOverride: clientTwilioOverride,
          template: "NEW_LEAD_MANAGER",
          variables: {
            "1": salesperson.name,
            "2": clientName,
          },
          fallbackBody: fallbackMgr,
          context: {
            userId: manager.id,
            leadId: lead.id,
            clientId: lead.client_id,
            notificationType: "NEW_LEAD",
          },
        });
        if (r.ok) console.log("[notifyNewLead] WhatsApp to manager: success");
        else console.error("[notifyNewLead] WhatsApp to manager:", r.error);
      } else if (mp.newLead.whatsapp && !hasPhone) {
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
    }
  }

  await createInAppNotification({
    userId: salesperson.id,
    type: "NEW_LEAD",
    message: `New lead: ${lead.name ?? "Lead"} — ${budget}`,
    leadId: lead.id,
  });

  if (manager && (managerPrefs.newLead.whatsapp || managerPrefs.newLead.email)) {
    await createInAppNotification({
      userId: manager.id,
      type: "NEW_LEAD",
      message: `New lead for ${clientName} — assigned to ${salesperson.name}`,
      leadId: lead.id,
    });
  }
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
  const magic = lead.magic_token ? magicLinkUrl(lead.magic_token) : getPublicBaseUrl();
  const proj = lead.project_type ?? "";
  const bud = lead.budget ?? "";
  const fallbackBody = `Follow-up reminder: Call ${lead.name ?? "lead"} today. ${proj} | ${bud} | ${magic}`;

  const r = await sendWhatsApp({
    to: salesperson.phone,
    toOverride: clientTwilioOverride,
    template: "FOLLOW_UP_REMINDER",
    variables: {
      "1": lead.name || "lead",
      "2": proj || "—",
      "3": bud || "—",
      "4": magic,
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
  const budget = lead.budget ?? "";
  const dealStr =
    lead.deal_value == null
      ? "—"
      : `$${lead.deal_value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const fallbackBody = `Deal won by ${salesperson.name} — ${lead.name ?? "Lead"}, ${budget || dealStr}. Great work!`;

  const hasPhone = Boolean(manager.phone?.trim());
  const hasEmail = Boolean(manager.email?.trim());
  if (mp.dealWon.whatsapp && hasPhone) {
    const r = await sendWhatsApp({
      to: manager.phone,
      toOverride: clientTwilioOverride,
      template: "DEAL_WON",
      variables: {
        "1": salesperson.name,
        "2": lead.name || "Lead",
        "3": budget || dealStr,
      },
      fallbackBody,
      context: {
        userId: manager.id,
        leadId: lead.id,
        clientId: lead.client_id,
        notificationType: "DEAL_WON",
      },
    });
    if (r.ok) console.log("[notifyDealWon] WhatsApp: success");
    else console.error("[notifyDealWon] WhatsApp:", r.error);
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
 * Alerts the client manager once per lead when SLA is breached (idempotent on notifications row).
 */
export async function notifyUncontactedLeadToManager(
  lead: UncontactedLeadRow,
  client: { id: string; name: string; response_time_limit_hours: number },
  clientTwilioOverride: string | null
): Promise<void> {
  const supabase = createAdminClient();
  const { data: manager } = await supabase
    .from("users")
    .select("id, name, email, phone, notification_prefs")
    .eq("client_id", client.id)
    .eq("role", "CLIENT_MANAGER")
    .eq("is_active", true)
    .maybeSingle();

  if (!manager) return;

  const prefs = getManagerPrefs(manager.notification_prefs);
  if (!prefs.uncontactedLead.whatsapp && !prefs.uncontactedLead.email) return;

  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", manager.id)
    .eq("lead_id", lead.id)
    .eq("type", "UNCONTACTED_MANAGER_ALERT")
    .maybeSingle();
  if (existing) return;

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

  await createInAppNotification({
    userId: manager.id as string,
    type: "UNCONTACTED_MANAGER_ALERT",
    message: `${lead.name ?? "Lead"} uncontacted for ${hoursUncontacted}h`,
    leadId: lead.id,
  });

  const fallbackWa = `Segmiq: Lead ${lead.name ?? "—"} has been uncontacted for ${hoursUncontacted}h. Assigned to ${salespersonName}`;

  if (prefs.uncontactedLead.whatsapp && manager.phone?.trim()) {
    background("uncontactedLeadManagerWhatsApp", async () => {
      const r = await sendWhatsApp({
        to: manager.phone as string,
        toOverride: clientTwilioOverride,
        template: "UNCONTACTED_LEAD_ALERT",
        variables: {
          "1": lead.name || "Unknown",
          "2": String(hoursUncontacted),
          "3": salespersonName,
        },
        fallbackBody: fallbackWa,
        context: {
          userId: manager.id as string,
          leadId: lead.id,
          clientId: client.id,
          notificationType: "UNCONTACTED_MANAGER_ALERT",
        },
      });
      if (r.ok) console.log("[notifyUncontactedLeadToManager] WhatsApp: success");
      else console.error("[notifyUncontactedLeadToManager] WhatsApp:", r.error);
    });
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
      .select("id, name, created_at, client_id, assigned_to_id")
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
