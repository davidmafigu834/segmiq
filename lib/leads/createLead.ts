import { createAdminClient } from "@/lib/supabase/admin";
import { newMagicToken, parseLeadFields } from "@/lib/lead-helpers";
import { prospectEnquiryLabel } from "@/lib/format-form-data";
import { notifyNewLead, notifyAdminsNoSalesperson } from "@/lib/notifications";
import { parseSalesPrefs } from "@/lib/notification-prefs";
import { background } from "@/lib/background";
import { sendWhatsApp } from "@/lib/messaging/provider";
import { logLeadCreated, logLeadReEnquiry } from "@/lib/lead-events";
import { firstName } from "@/lib/messaging/whatsapp-vars";
import { getPublicBaseUrl } from "@/lib/constants";
import { getPublicLandingPageUrl } from "@/lib/public-url";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp-opener";
import { findOpenLeadByPhone, type OpenLeadMatch } from "@/lib/leads/findOpenLeadByPhone";
import { findReturningAssignee } from "@/lib/whatsapp/assignment";
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
  /** Per-request override of the client's assignment_mode (e.g. hub "auto" pick). */
  assignmentModeOverride?: "direct" | "pool" | "round_robin";
};

const AUTO_INBOUND_SOURCES: LeadSource[] = ["FACEBOOK", "LANDING_PAGE"];
const DEDUP_INBOUND_SOURCES: LeadSource[] = ["FACEBOOK", "LANDING_PAGE"];

type SalespersonRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  notification_prefs: unknown;
  round_robin_order: number;
};

type ManagerRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  notification_prefs: unknown;
};

async function handleOpenLeadReEnquiry(opts: {
  supabase: ReturnType<typeof createAdminClient>;
  clientId: string;
  source: LeadSource;
  existingLead: OpenLeadMatch;
  formData: Record<string, unknown>;
  requestedPackage?: RequestedPackageRef;
  skipNotifications?: boolean;
  client: Record<string, unknown>;
  salespeople: SalespersonRow[];
  managers: ManagerRow[] | undefined;
  fields: ReturnType<typeof parseLeadFields>;
}): Promise<CreateLeadResult> {
  const {
    supabase,
    clientId,
    source,
    existingLead,
    formData,
    requestedPackage,
    skipNotifications,
    client,
    salespeople,
    managers,
    fields,
  } = opts;

  const existingFormData = (existingLead.form_data as Record<string, unknown> | null) ?? {};
  const mergedFormData: Record<string, unknown> = requestedPackage
    ? { ...existingFormData, ...formData, _requestedPackageName: requestedPackage.name }
    : { ...existingFormData, ...formData };

  const leadUpdate: Record<string, unknown> = {
    form_data: mergedFormData,
    updated_at: new Date().toISOString(),
  };
  if (fields.name) leadUpdate.name = fields.name;
  if (fields.phone) leadUpdate.phone = fields.phone;
  if (fields.email) leadUpdate.email = fields.email;
  if (fields.budget) leadUpdate.budget = fields.budget;
  if (fields.project_type) leadUpdate.project_type = fields.project_type;
  if (fields.timeline) leadUpdate.timeline = fields.timeline;

  const { data: updatedLead, error: updateErr } = await supabase
    .from("leads")
    .update(leadUpdate)
    .eq("id", existingLead.id)
    .select("*")
    .single();

  if (updateErr || !updatedLead) {
    return { ok: false, error: updateErr?.message || "Update failed", code: "DB_ERROR" };
  }

  const leadRow = updatedLead as unknown as LeadRow;
  const formDataSummary = prospectEnquiryLabel({
    project_type: leadRow.project_type as string | null,
    form_data: leadRow.form_data as Record<string, unknown> | null,
    requestedPackageName: requestedPackage?.name ?? null,
  });

  background("logLeadReEnquiry", () =>
    logLeadReEnquiry({
      leadId: existingLead.id,
      clientId,
      source,
      formDataSummary: formDataSummary ?? undefined,
    })
  );

  const assignedId = existingLead.assigned_to_id;
  if (!skipNotifications && assignedId) {
    const sp = salespeople.find((s) => s.id === assignedId);
    if (sp) {
      const managerList = (managers ?? []).map((mgr) => ({
        id: mgr.id as string,
        name: mgr.name as string,
        phone: (mgr.phone as string | null) ?? null,
        email: (mgr.email as string | null) ?? null,
        notification_prefs: mgr.notification_prefs,
      }));
      try {
        await notifyNewLead(
          leadRow,
          {
            id: sp.id as string,
            name: sp.name as string,
            phone: (sp.phone as string | null) ?? null,
            email: (sp.email as string | null) ?? null,
          },
          managerList,
          client.twilio_whatsapp_override as string | null,
          client.name as string,
          {
            salesPrefs: parseSalesPrefs(sp.notification_prefs),
            isReEnquiry: true,
          }
        );
      } catch (err) {
        console.error("[createLead] re-enquiry notifyNewLead failed:", err);
      }
    }
  }

  return { ok: true, leadId: existingLead.id, duplicate: true };
}

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
    assignmentModeOverride,
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

  const fields = parseLeadFields(formData);

  let phoneDigits: string | null = null;
  try {
    phoneDigits = fields.phone
      ? normalizePhoneForWhatsApp(fields.phone, client.dial_code || "263")
      : null;
  } catch {
    phoneDigits = null;
  }

  let assignedId: string | null = null;
  let list: SalespersonRow[] = [];
  let managers: ManagerRow[] | undefined;

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
    .eq("is_active", true);

  list = (salespeople ?? []) as SalespersonRow[];
  managers = (managersData ?? undefined) as ManagerRow[] | undefined;

  if (
    DEDUP_INBOUND_SOURCES.includes(source) &&
    phoneDigits &&
    !overrideAssigneeId &&
    !forceUnassigned
  ) {
    const existingOpen = await findOpenLeadByPhone({ supabase, clientId, phoneDigits });
    if (existingOpen) {
      return handleOpenLeadReEnquiry({
        supabase,
        clientId,
        source,
        existingLead: existingOpen,
        formData,
        requestedPackage,
        skipNotifications,
        client: client as Record<string, unknown>,
        salespeople: list,
        managers,
        fields,
      });
    }
  }

  if (forceUnassigned) {
    assignedId = null;
  } else {
    const assignmentMode = assignmentModeOverride ?? (client.assignment_mode as string | null) ?? "direct";

    if (overrideAssigneeId != null && overrideAssigneeId !== "") {
      const ok = list.some((s) => s.id === overrideAssigneeId);
      if (!ok) {
        return { ok: false, error: "Assignee is not an active salesperson for this client", code: "UNKNOWN" };
      }
      assignedId = overrideAssigneeId;
    } else if (
      list.length > 0 &&
      assignmentMode !== "pool" &&
      (assignmentMode === "round_robin" ||
        (assignmentMode === "direct" && AUTO_INBOUND_SOURCES.includes(source)))
    ) {
      let pickedFromReturning = false;
      if (DEDUP_INBOUND_SOURCES.includes(source) && phoneDigits) {
        const returningId = await findReturningAssignee({ supabase, clientId, phoneDigits });
        if (returningId && list.some((s) => s.id === returningId)) {
          assignedId = returningId;
          pickedFromReturning = true;
        }
      }

      if (!pickedFromReturning) {
        let rr = (client.round_robin_index as number) ?? 0;
        const idx = rr % list.length;
        assignedId = list[idx].id as string;
        rr = (rr + 1) % list.length;
        await supabase.from("clients").update({ round_robin_index: rr, updated_at: new Date().toISOString() }).eq("id", clientId);
      }
    } else {
      assignedId = null;
    }
  }

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
            lifecycle: "cold",
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
    deal_value_source: dealValue != null && dealValue > 0 ? ("manual" as const) : null,
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
  const formDataSummary = prospectEnquiryLabel({
    project_type: leadRow.project_type as string | null,
    form_data: leadRow.form_data as Record<string, unknown> | null,
    requestedPackageName: requestedPackage?.name ?? null,
  });
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
      const managerList = (managers ?? []).map((mgr) => ({
        id: mgr.id as string,
        name: mgr.name as string,
        phone: (mgr.phone as string | null) ?? null,
        email: (mgr.email as string | null) ?? null,
        notification_prefs: (mgr as { notification_prefs?: unknown }).notification_prefs,
      }));
      try {
        await notifyNewLead(
          leadRow,
          {
            id: sp.id as string,
            name: sp.name as string,
            phone: (sp.phone as string | null) ?? null,
            email: (sp.email as string | null) ?? null,
          },
          managerList,
          client.twilio_whatsapp_override as string | null,
          client.name as string,
          {
            salesPrefs: parseSalesPrefs((sp as { notification_prefs?: unknown }).notification_prefs),
          }
        );
      } catch (err) {
        console.error("[createLead] notifyNewLead failed:", err);
      }
    } else if (!forceUnassigned && assignmentModeOverride !== "pool" && list.length === 0) {
      const effectiveMode = assignmentModeOverride ?? (client.assignment_mode as string | null) ?? "direct";
      const expectsAutoAssign =
        effectiveMode === "round_robin" ||
        (effectiveMode === "direct" && AUTO_INBOUND_SOURCES.includes(source));
      if (expectsAutoAssign) {
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
    }

    // Send prospect confirmation WhatsApp on public form submissions only.
    if (
      source !== "MANUAL" &&
      leadRow.phone &&
      (client as { send_prospect_confirmation?: boolean }).send_prospect_confirmation !== false
    ) {
      try {
        const serviceDescription = prospectEnquiryLabel({
          project_type: leadRow.project_type as string | null,
          form_data: leadRow.form_data as Record<string, unknown> | null,
          requestedPackageName: requestedPackage?.name ?? null,
        });
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
