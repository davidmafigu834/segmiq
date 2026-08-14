import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionFromRequest } from "@/lib/api-guards";
import { canAccessClient } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp-opener";
import { createLead } from "@/lib/leads/createLead";
import { IN_PERSON_HUB_SOURCES } from "@/lib/customer-hub/recent-status";
import { logFollowUpSet, logWalkInIntake } from "@/lib/lead-events";
import { notifyDealWon } from "@/lib/notifications";
import { getManagerPrefs } from "@/lib/notification-prefs";
import { recordWinAnalysis } from "@/lib/win-analysis";
import type { LeadRow } from "@/types";
import {
  isWalkInSource,
  resolveWalkInIntake,
  type WalkInIntakeOutcome,
} from "@/lib/walk-in-intake";
import type { LeadStatus } from "@/types";

export const dynamic = "force-dynamic";

const walkInOutcomeSchema = z.enum([
  "quote_requested",
  "follow_up_later",
  "still_deciding",
  "won_on_spot",
  "just_browsing",
]);

const bodySchema = z.object({
  type: z.enum(["lead", "customer"]),
  name: z.string().max(200).optional(),
  phone: z.string().min(3).max(40),
  email: z.string().max(200).optional(),
  customerType: z.enum(["company", "individual"]).optional(),
  primaryContactName: z.string().max(200).optional(),
  industry: z.string().max(200).optional(),
  location: z.string().max(300).optional(),
  source: z.string().min(1).max(80),
  notes: z.string().max(5000).optional(),
  projectType: z.string().max(200).optional(),
  budget: z.string().max(200).optional(),
  priority: z.enum(["hot", "warm", "cold"]).optional(),
  assignMode: z.enum(["specific", "round_robin", "pool"]).optional(),
  assigneeId: z.string().uuid().optional(),
  forceNew: z.boolean().optional(),
  clientId: z.string().uuid().optional(),
  intakeOutcome: walkInOutcomeSchema.optional(),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dealValue: z.number().nonnegative().optional(),
  initialStatus: z
    .enum([
      "NEW",
      "CONTACTED",
      "NEGOTIATING",
      "PROPOSAL_SENT",
      "WON",
      "LOST",
      "NOT_QUALIFIED",
    ])
    .optional(),
});

export async function POST(req: Request) {
  const g = await requireSessionFromRequest(req);
  if ("error" in g) return g.error;

  const { session } = g;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const b = parsed.data;

  if (b.type === "customer" && !b.customerType) {
    return NextResponse.json({ error: "Customer type is required", field: "customerType" }, { status: 400 });
  }

  const requestedClientId = session.role === "SUPER_ADMIN" ? b.clientId : session.clientId;
  if (!requestedClientId) {
    return NextResponse.json({ error: "Missing client context" }, { status: 400 });
  }
  if (!canAccessClient(session.role, session.clientId, requestedClientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const emailTrim = b.email?.trim();
  if (emailTrim) {
    const em = z.string().email().safeParse(emailTrim);
    if (!em.success) {
      return NextResponse.json({ error: "Invalid email", field: "email" }, { status: 400 });
    }
  }

  const supabase = createAdminClient();

  const { data: client } = await supabase
    .from("clients")
    .select("dial_code, assignment_mode")
    .eq("id", requestedClientId)
    .single();

  const wa = normalizePhoneForWhatsApp(b.phone, client?.dial_code || "263");
  if (!wa) return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  const normalizedPhone = "+" + wa;

  const { data: existing } = await supabase
    .from("contacts")
    .select("id, name, lifecycle")
    .eq("client_id", requestedClientId)
    .eq("phone", normalizedPhone)
    .limit(1)
    .maybeSingle();

  let contactId: string;
  if (existing) {
    contactId = existing.id as string;
    if (b.type === "customer") {
      await supabase
        .from("contacts")
        .update({
          lifecycle: "customer",
          name: b.name?.trim() || existing.name,
          email: emailTrim ?? undefined,
          location: b.location?.trim() || undefined,
          customer_type: b.customerType,
          primary_contact_name: b.primaryContactName?.trim() || null,
          industry: b.industry?.trim() || null,
          relationship_owner_id: b.assigneeId ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    }
    if (b.type === "lead" && !b.forceNew) {
      const { data: latestLead } = await supabase
        .from("leads")
        .select("id, status, assigned_to_id, assigned_to:users!assigned_to_id ( id, name )")
        .eq("contact_id", existing.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const a = latestLead?.assigned_to as
        | { id?: string; name?: string }
        | { id?: string; name?: string }[]
        | null
        | undefined;
      const assignee = Array.isArray(a) ? a[0] ?? null : a;
      return NextResponse.json(
        {
          error: "duplicate",
          existing: {
            id: existing.id,
            name: existing.name,
            lifecycle: existing.lifecycle,
            leadId: latestLead?.id ?? null,
            leadStatus: latestLead?.status ?? null,
            assignedToId: assignee?.id ?? latestLead?.assigned_to_id ?? null,
            owner: assignee?.name ?? null,
            ownedByYou: Boolean(
              assignee?.id && session.userId && assignee.id === session.userId
            ),
          },
        },
        { status: 409 }
      );
    }
  } else {
    const { data: created, error: cErr } = await supabase
      .from("contacts")
      .insert({
        client_id: requestedClientId,
        name: b.name ?? null,
        phone: normalizedPhone,
        email: emailTrim ?? null,
        source: b.source,
        lead_origin: "client",
        lifecycle: b.type === "customer" ? "customer" : "cold",
        notes: b.notes ?? null,
        location: b.location?.trim() || null,
        customer_type: b.type === "customer" ? b.customerType : null,
        primary_contact_name: b.type === "customer" ? b.primaryContactName?.trim() || null : null,
        industry: b.type === "customer" ? b.industry?.trim() || null : null,
        relationship_owner_id: b.type === "customer" ? b.assigneeId ?? null : null,
      })
      .select("id")
      .single();
    if (cErr || !created) {
      return NextResponse.json({ error: "Could not create contact" }, { status: 500 });
    }
    contactId = created.id as string;
  }

  if (b.type === "customer") {
    return NextResponse.json({ ok: true, kind: "customer", contactId });
  }

  const walkIn = isWalkInSource(b.source);
  if (walkIn && !b.intakeOutcome) {
    return NextResponse.json(
      { error: "intakeOutcome required for walk-in leads", field: "intakeOutcome" },
      { status: 400 }
    );
  }
  if (walkIn && b.intakeOutcome === "follow_up_later" && !b.followUpDate) {
    return NextResponse.json(
      { error: "followUpDate required for follow-up walk-ins", field: "followUpDate" },
      { status: 400 }
    );
  }

  let overrideAssigneeId: string | undefined;
  let forceUnassigned = false;
  let assignmentModeOverride: "direct" | "pool" | "round_robin" | undefined;

  if (session.role === "SALESPERSON") {
    // Manual hub / walk-in / won-deal entry must always stay with the creator.
    // Round-robin and pool only apply to inbound ads/forms/WhatsApp — never to
    // "I just logged this customer myself."
    overrideAssigneeId = session.userId;
  } else {
    const mode = b.assignMode || (client?.assignment_mode as string | null) || "direct";
    if (mode === "specific") {
      if (!b.assigneeId) {
        return NextResponse.json(
          { error: "assigneeId required for specific assignment" },
          { status: 400 }
        );
      }
      overrideAssigneeId = b.assigneeId;
    } else if (mode === "pool") {
      forceUnassigned = true;
    } else if (mode === "round_robin") {
      assignmentModeOverride = "round_robin";
    }
  }

  const formData: Record<string, unknown> = {
    Name: b.name ?? "",
    Phone: normalizedPhone,
  };
  if (emailTrim) formData.Email = emailTrim;
  if (b.budget?.trim()) formData.Budget = b.budget.trim();
  if (b.projectType?.trim()) formData["Project type"] = b.projectType.trim();
  if (b.notes?.trim()) formData.Notes = b.notes.trim();

  let initialStatus: LeadStatus | undefined;
  let manualPriority = b.priority;
  let followUpDate: string | undefined;
  let dealValue: number | undefined = b.dealValue;
  let hubIntake: WalkInIntakeOutcome | undefined;

  if (walkIn && b.intakeOutcome) {
    const resolved = resolveWalkInIntake(b.intakeOutcome, {
      followUpDate: b.followUpDate,
      dealValue: b.dealValue,
    });
    initialStatus = resolved.status;
    manualPriority = resolved.manualPriority;
    followUpDate = resolved.followUpDate;
    dealValue = resolved.dealValue ?? dealValue;
    hubIntake = resolved.hubIntake;
    formData.hub_intake = hubIntake;
    formData.hub_source = b.source;
  } else if (b.initialStatus) {
    initialStatus = b.initialStatus;
  } else if (IN_PERSON_HUB_SOURCES.has(b.source)) {
    initialStatus = "CONTACTED";
  }

  const result = await createLead({
    clientId: requestedClientId,
    source: "MANUAL",
    formData,
    contactId,
    overrideAssigneeId,
    forceUnassigned,
    assignmentModeOverride,
    manualPriority,
    initialStatus,
    followUpDate: followUpDate ?? null,
    dealValue: dealValue ?? null,
    hubIntake,
    hubSource: walkIn ? b.source : undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "Contact saved, but creating the lead failed", detail: result.error },
      { status: 500 }
    );
  }

  const actor = {
    id: session.userId,
    name: "Unknown",
    role: session.role,
  };
  const { data: actorRow } = await supabase
    .from("users")
    .select("name")
    .eq("id", session.userId)
    .maybeSingle();
  if (actorRow?.name) actor.name = actorRow.name as string;

  if (walkIn && b.intakeOutcome) {
    await logWalkInIntake({
      leadId: result.leadId,
      clientId: requestedClientId,
      actor,
      outcome: b.intakeOutcome,
      notes: b.notes?.trim() || null,
      followUpDate: followUpDate ?? null,
      dealValue: dealValue ?? null,
    });

    if (followUpDate) {
      await logFollowUpSet({
        leadId: result.leadId,
        clientId: requestedClientId,
        actor,
        followUpDate,
        notes: b.notes?.trim() || null,
      });
    }

  }

  if (initialStatus === "WON") {
    await supabase
      .from("contacts")
      .update({ lifecycle: "customer", updated_at: new Date().toISOString() })
      .eq("id", contactId);
    await recordWinAnalysis(result.leadId);

    const { data: leadRow } = await supabase
      .from("leads")
      .select("*")
      .eq("id", result.leadId)
      .single();

    if (leadRow) {
      const { data: actorRow } = await supabase
        .from("users")
        .select("id, name, email, phone")
        .eq("id", session.userId)
        .maybeSingle();

      const { data: managers } = await supabase
        .from("users")
        .select("id, name, email, phone, notification_prefs")
        .eq("client_id", requestedClientId)
        .eq("role", "CLIENT_MANAGER")
        .eq("is_active", true);

      const { data: clientRow } = await supabase
        .from("clients")
        .select("name, twilio_whatsapp_override")
        .eq("id", requestedClientId)
        .maybeSingle();

      const spLite = {
        id: session.userId,
        name: (actorRow?.name as string) || actor.name,
        phone: (actorRow?.phone as string | null) ?? null,
        email: (actorRow?.email as string | null) ?? null,
      };

      for (const mgr of managers ?? []) {
        void notifyDealWon(
          leadRow as LeadRow,
          spLite,
          {
            id: mgr.id as string,
            name: mgr.name as string,
            phone: (mgr.phone as string | null) ?? null,
            email: (mgr.email as string | null) ?? null,
          },
          (clientRow?.twilio_whatsapp_override as string | null) ?? null,
          (clientRow?.name as string) ?? "Client",
          getManagerPrefs((mgr as { notification_prefs?: unknown }).notification_prefs)
        );
      }
    }
  }

  return NextResponse.json({ ok: true, kind: "lead", contactId, leadId: result.leadId });
}
