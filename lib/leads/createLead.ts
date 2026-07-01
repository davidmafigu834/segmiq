import { createAdminClient } from "@/lib/supabase/admin";
import { newMagicToken, parseLeadFields } from "@/lib/lead-helpers";
import { notifyNewLead, notifyAdminsNoSalesperson } from "@/lib/notifications";
import { getManagerPrefs, parseSalesPrefs } from "@/lib/notification-prefs";
import { background } from "@/lib/background";
import { sendWhatsApp } from "@/lib/messaging/provider";
import { logLeadCreated } from "@/lib/lead-events";
import { firstName } from "@/lib/messaging/whatsapp-vars";
import { getPublicBaseUrl } from "@/lib/constants";
import { getPublicLandingPageUrl } from "@/lib/public-url";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp-opener";
import type { LeadRow, LeadSource, LeadStatus } from "@/types";

export type RequestedPackageRef = {
  id: string;
  slug: string;
  name: string;
};

export type CreateLeadInput = {
  clientId: string;
  source: LeadSource;
  formData: Record<string, unknown>;
  facebookLeadId?: string;
  requestedPackage?: RequestedPackageRef;
  /** When set, assigns this salesperson and does not advance the client's round-robin index. */
  overrideAssigneeId?: string | null;
  /** When true, skips WhatsApp/email/in-app notifications for the new lead. */
  skipNotifications?: boolean;
  contactId?: string;
  forceUnassigned?: boolean;
  manualPriority?: "hot" | "warm" | "cold";
  /** Hub/manual intake where the rep already spoke to the person (walk-in, phone call). */
  initialStatus?: LeadStatus;
  followUpDate?: string | null;
  dealValue?: number | null;
  hubIntake?: string;
  hubSource?: string;
};

export type CreateLeadResult =
  | { ok: true; leadId: string; duplicate: boolean }
  | {
      ok: false;
      error: string;
      code: "NO_CLIENT" | "INACTIVE" | "ARCHIVED" | "DB_ERROR" | "UNKNOWN";
    };

export async function createLead(input: CreateLeadInput): Promise<CreateLeadResult> {
  const {
    clientId,
    source,
    formData,
    facebookLeadId,
    requestedPackage,
    overrideAssigneeId,
    skipNotifications,
    contactId,
    forceUnassigned,
    manualPriority,
    initialStatus,
    followUpDate,
    dealValue,
    hubIntake,
    hubSource,
  } = input;
  const supabase = createAdminClient();

  if (source === "FACEBOOK" && facebookLeadId) {
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("client_id", clientId)
      .eq("facebook_lead_id", facebookLeadId)
      .maybeSingle();
    if (existing) {
      return { ok: true, leadId: existing.id as string, duplicate: true };
    }
  }

  const { data: client, error: cErr } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (cErr || !client) {
    return { ok: false, error: "Client not found", code: "NO_CLIENT" };
  }
  if ((client as { is_archived?: boolean }).is_archived) {
    return { ok: false, error: "Client not found", code: "ARCHIVED" };
  }
  if (client.is_active === false) {
    return { ok: false, error: "Client not accepting leads", code: "INACTIVE" };
  }

  let assignedId: string | null = null;
  let list: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    notification_prefs: unknown;
    round_robin_order: number;
  }[] = [];
  let managers:
    | {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        notification_prefs: unknown;
      }[]
    | undefined;

  if (forceUnassigned) {
    assignedId = null;
  } else {
    const { data: salespeople } = await supabase
      .from("users")
      .select("id, name, email, phone, notification_prefs, round_robin_order")
      .eq("client_id", clientId)
      .eq("role", "SALESPERSON")
      .eq("is_active", true)
      .order("round_robin_order", { ascending: true });

    const { data: managersData } = await supabase
      .from("users")
      .select("id, name, email, phone, notification_prefs")
      .eq("client_id", clientId)
      .eq("role", "CLIENT_MANAGER")
      .eq("is_active", true)
      .limit(1);

    list = (salespeople ?? []) as typeof list;
    managers = managersData ?? undefined;

    let rr = (client.round_robin_index as number) ?? 0;

    if (overrideAssigneeId != null && overrideAssigneeId !== "") {
      const ok = list.some((s) => s.id === overrideAssigneeId);
      if (!ok) {
        return { ok: false, error: "Assignee is not an active salesperson for this client", code: "UNKNOWN" };
      }
      assignedId = overrideAssigneeId;
    } else if (list.length > 0) {
      const idx = rr % list.length;
      assignedId = list[idx].id as string;
      rr = (rr + 1) % list.length;
      await supabase.from("clients").update({ round_robin_index: rr, updated_at: new Date().toISOString() }).eq("id", clientId);
    }
  }

  const fields = parseLeadFields(formData);

  // Ensure every lead is linked to a contact. Hub callers pass contactId already; for all
  // other paths (form, Facebook, admin), find-or-create by canonical phone within the client.
  let resolvedContactId: string | null = contactId ?? null;
  if (!resolvedContactId) {
    try {
      const wa = fields.phone
        ? normalizePhoneForWhatsApp(fields.phone, client.dial_code || "263")
        : null;
      const canonicalPhone = wa ? "+" + wa : null;
      const leadOrigin = source === "LANDING_PAGE" || source === "FACEBOOK" ? "segmiq" : "client";

      if (canonicalPhone) {
        const { data: existingContact } = await supabase
          .from("contacts")
          .select("id")
          .eq("client_id", clientId)
          .eq("phone", canonicalPhone)
          .limit(1)
          .maybeSingle();
        if (existingContact) resolvedContactId = existingContact.id as string;
      }

      if (!resolvedContactId) {
        const { data: newContact, error: contactErr } = await supabase
          .from("contacts")
          .insert({
            client_id: clientId,
            name: fields.name ?? null,
            phone: canonicalPhone,
            email: fields.email ?? null,
            source,
            lead_origin: leadOrigin,
            lifecycle: "lead",
          })
          .select("id")
          .single();
        if (!contactErr && newContact) {
          resolvedContactId = newContact.id as string;
        }
      }
    } catch {
      // Contact ensure must never block lead creation
    }
  }

  const { token, expires } = newMagicToken();

  const storedFormData: Record<string, unknown> = requestedPackage
    ? { ...formData, _requestedPackageName: requestedPackage.name }
    : { ...formData };
  if (hubIntake) storedFormData.hub_intake = hubIntake;
  if (hubSource) storedFormData.hub_source = hubSource;

  const leadInsert = {
    client_id: clientId,
    assigned_to_id: assignedId,
    source,
    status: initialStatus ?? ("NEW" as const),
    form_data: storedFormData,
    name: fields.name,
    phone: fields.phone,
    email: fields.email,
    budget: fields.budget,
    project_type: fields.project_type,
    timeline: fields.timeline,
    magic_token: token,
    magic_token_expires_at: expires,
    facebook_lead_id: facebookLeadId ?? null,
    contact_id: resolvedContactId,
    manual_priority: manualPriority ?? null,
    follow_up_date: followUpDate ?? null,
    deal_value: dealValue ?? null,
  };

  const { data: lead, error: lErr } = await supabase.from("leads").insert(leadInsert).select("*").single();

  if (lErr) {
    if (lErr.code === "23505" && facebookLeadId) {
      const { data: existingRace } = await supabase
        .from("leads")
        .select("id")
        .eq("client_id", clientId)
        .eq("facebook_lead_id", facebookLeadId)
        .maybeSingle();
      if (existingRace?.id) {
        return { ok: true, leadId: existingRace.id as string, duplicate: true };
      }
    }
    return { ok: false, error: lErr.message || "Insert failed", code: "DB_ERROR" };
  }

  if (!lead) {
    return { ok: false, error: "Insert failed", code: "DB_ERROR" };
  }

  const leadRow = lead as unknown as LeadRow;

  // Log LEAD_CREATED event (fire-and-forget — never blocks lead creation)
  const assignedSalesperson = assignedId ? (list.find((s) => s.id === assignedId) ?? null) : null;
  const formDataSummary =
    (leadRow.project_type as string | null) ||
    (leadRow.budget as string | null) ||
    null;
  background("logLeadCreated", () =>
    logLeadCreated({
      leadId: leadRow.id,
      clientId,
      source,
      assignedToName: assignedSalesperson ? (assignedSalesperson.name as string) : undefined,
      formDataSummary: formDataSummary ?? undefined,
      requestedPackage,
    })
  );

  if (!skipNotifications) {
    if (assignedId) {
      const sp = list.find((s) => s.id === assignedId)!;
      const mgr = managers?.[0] ?? null;
      const managerPrefs = mgr ? getManagerPrefs((mgr as { notification_prefs?: unknown }).notification_prefs) : null;
      try {
        await notifyNewLead(
          leadRow,
          {
            id: sp.id as string,
            name: sp.name as string,
            phone: (sp.phone as string | null) ?? null,
            email: (sp.email as string | null) ?? null,
          },
          mgr
            ? {
                id: mgr.id as string,
                name: mgr.name as string,
                phone: (mgr.phone as string | null) ?? null,
                email: (mgr.email as string | null) ?? null,
              }
            : null,
          client.twilio_whatsapp_override as string | null,
          client.name as string,
          {
            salesPrefs: parseSalesPrefs((sp as { notification_prefs?: unknown }).notification_prefs),
            managerPrefs,
          }
        );
      } catch (err) {
        console.error("[createLead] notifyNewLead failed:", err);
      }
    } else if (!forceUnassigned) {
      try {
        await notifyAdminsNoSalesperson({
          clientName: client.name as string,
          leadId: leadRow.id,
          clientId,
        });
      } catch (err) {
        console.error("[createLead] notifyAdminsNoSalesperson failed:", err);
      }
    }

    // Send prospect confirmation WhatsApp on public form submissions only.
    if (
      source !== "MANUAL" &&
      leadRow.phone &&
      (client as { send_prospect_confirmation?: boolean }).send_prospect_confirmation !== false
    ) {
      try {
        const serviceDescription =
          (leadRow.project_type as string | null) ||
          (leadRow.budget as string | null) ||
          "your enquiry";
        const prospectFirst = firstName(leadRow.name as string | null);
        const companyName = client.name as string;
        const responseHours = String(Math.max(1, Math.round((client.response_time_limit_hours as number) || 2)));

        const { data: profile } = await supabase
          .from("client_profiles")
          .select("slug, is_published")
          .eq("client_id", clientId)
          .maybeSingle();
        const profileSlug = (profile as { slug?: string; is_published?: boolean } | null)?.slug;
        const profilePublished = Boolean((profile as { is_published?: boolean } | null)?.is_published);
        const portfolioUrl =
          profileSlug && profilePublished ? getPublicLandingPageUrl(profileSlug) : getPublicBaseUrl();

        await sendWhatsApp({
          to: leadRow.phone,
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
            leadId: leadRow.id,
            clientId,
            notificationType: "LEAD_CONFIRMATION_PROSPECT",
          },
        });
      } catch (err) {
        console.error("[createLead] prospect confirmation WhatsApp failed:", err);
      }
    }
  }

  return { ok: true, leadId: leadRow.id, duplicate: false };
}
