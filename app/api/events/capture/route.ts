import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionFromRequest } from "@/lib/api-guards";
import { canAccessClient } from "@/lib/auth/permissions";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp-opener";
import { createLead } from "@/lib/leads/createLead";
import { logLeadEvent, logWalkInIntake } from "@/lib/lead-events";
import { sendProspectLeadConfirmation } from "@/lib/messaging/send-prospect-confirmation";

export const dynamic = "force-dynamic";

const captureBodySchema = z.object({
  eventName: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(200),
  phone: z.string().min(3).max(40),
  company: z.string().trim().max(200).optional(),
  interest: z.string().trim().max(2000).optional(),
  clientId: z.string().uuid().optional(),
});

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function loadTodayStats(clientId: string, eventName: string) {
  const supabase = createAdminClient();
  const since = startOfTodayIso();

  const { count } = await supabase
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("event_name", eventName)
    .gte("created_at", since);

  const { data: recent } = await supabase
    .from("contacts")
    .select("id, name, created_at")
    .eq("client_id", clientId)
    .eq("event_name", eventName)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5);

  return {
    capturedToday: count ?? 0,
    recent: (recent ?? []).map((r) => ({
      id: r.id as string,
      name: (r.name as string | null) ?? "Unknown",
      createdAt: r.created_at as string,
    })),
  };
}

/** GET ?eventName=… — today's counter + recent captures for the event. */
export async function GET(req: Request) {
  const g = await requireSessionFromRequest(req);
  if ("error" in g) return g.error;
  const { session } = g;

  if (
    session.role !== "CLIENT_MANAGER" &&
    session.role !== "SALESPERSON" &&
    session.role !== "AGENCY_ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const eventName = (url.searchParams.get("eventName") ?? "").trim();
  if (!eventName) {
    return NextResponse.json({ error: "eventName required" }, { status: 400 });
  }

  const clientId =
    session.role === "AGENCY_ADMIN"
      ? url.searchParams.get("clientId")
      : session.clientId;
  if (!clientId) {
    return NextResponse.json({ error: "Missing client context" }, { status: 400 });
  }
  if (!canAccessClient(session.role, session.clientId, clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stats = await loadTodayStats(clientId, eventName);
  return NextResponse.json({ ok: true, ...stats });
}

export async function POST(req: Request) {
  const g = await requireSessionFromRequest(req);
  if ("error" in g) return g.error;
  const { session } = g;

  if (
    session.role !== "CLIENT_MANAGER" &&
    session.role !== "SALESPERSON" &&
    session.role !== "AGENCY_ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = captureBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const b = parsed.data;

  const clientId = session.role === "AGENCY_ADMIN" ? b.clientId : session.clientId;
  if (!clientId) {
    return NextResponse.json({ error: "Missing client context" }, { status: 400 });
  }
  if (!canAccessClient(session.role, session.clientId, clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data: client } = await supabase
    .from("clients")
    .select("dial_code, name, send_prospect_confirmation, response_time_limit_hours")
    .eq("id", clientId)
    .single();

  const wa = normalizePhoneForWhatsApp(b.phone, client?.dial_code || "263");
  if (!wa) {
    return NextResponse.json({ error: "Invalid phone number", field: "phone" }, { status: 400 });
  }
  const normalizedPhone = "+" + wa;

  const interest = b.interest?.trim() || "";
  const company = b.company?.trim() || "";
  const notesParts = [
    company ? `Company: ${company}` : null,
    interest || null,
  ].filter(Boolean);
  const notes = notesParts.length ? notesParts.join("\n") : null;

  const { data: actorRow } = await supabase
    .from("users")
    .select("name")
    .eq("id", session.userId)
    .maybeSingle();
  const actor = {
    id: session.userId,
    name: (actorRow?.name as string) || "Rep",
    role: session.role,
  };

  // Assign to capturing rep when they can sell; managers without also_sells stay unassigned.
  let overrideAssigneeId: string | undefined;
  let forceUnassigned = false;
  if (canActAsSalesperson(session)) {
    overrideAssigneeId = session.userId;
  } else if (session.role === "CLIENT_MANAGER") {
    forceUnassigned = true;
  }

  const { data: existing } = await supabase
    .from("contacts")
    .select("id, name, lifecycle, notes, event_name")
    .eq("client_id", clientId)
    .eq("phone", normalizedPhone)
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Returning contact — do not duplicate; log an event touch on their latest lead.
    await supabase
      .from("contacts")
      .update({
        event_name: b.eventName,
        updated_at: new Date().toISOString(),
        ...(b.name && !existing.name ? { name: b.name } : {}),
        ...(notes
          ? {
              notes: existing.notes
                ? `${existing.notes}\n---\n[${b.eventName}] ${notes}`
                : `[${b.eventName}] ${notes}`,
            }
          : {}),
      })
      .eq("id", existing.id);

    const { data: latestLead } = await supabase
      .from("leads")
      .select("id")
      .eq("contact_id", existing.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let leadId = (latestLead?.id as string | undefined) ?? null;

    if (!leadId) {
      const formData: Record<string, unknown> = {
        Name: b.name,
        Phone: normalizedPhone,
        hub_source: "Walk-in",
        event_name: b.eventName,
      };
      if (company) formData.Company = company;
      if (interest) formData.Notes = interest;

      const result = await createLead({
        clientId,
        source: "MANUAL",
        formData,
        contactId: existing.id as string,
        overrideAssigneeId,
        forceUnassigned,
        initialStatus: "CONTACTED",
        hubSource: "Walk-in",
        hubIntake: "event_capture",
        skipNotifications: false,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: "Could not create lead for returning contact", detail: result.error },
          { status: 500 }
        );
      }
      leadId = result.leadId;
    } else {
      await logLeadEvent({
        leadId,
        clientId,
        actor,
        eventType: "RE_ENQUIRY",
        eventData: {
          channel: "in_person",
          source: "Walk-in",
          event_name: b.eventName,
          company: company || null,
          notes: interest || null,
          capture: "event_capture",
        },
        channel: "in_person",
      });
    }

    try {
      await sendProspectLeadConfirmation({
        clientId,
        phone: normalizedPhone,
        name: b.name || (existing.name as string | null),
        leadId,
        formData: {
          Event: b.eventName,
          ...(company ? { Company: company } : {}),
          ...(interest ? { Notes: interest } : {}),
        },
        eventName: b.eventName,
      });
    } catch (err) {
      console.error("[events/capture] prospect confirmation failed (returning):", err);
    }

    const stats = await loadTodayStats(clientId, b.eventName);
    return NextResponse.json({
      ok: true,
      returning: true,
      contactId: existing.id,
      leadId,
      contactName: existing.name ?? b.name,
      message: `Returning contact: ${existing.name ?? b.name}. Event touch logged — no duplicate created.`,
      ...stats,
    });
  }

  // New contact
  const { data: created, error: cErr } = await supabase
    .from("contacts")
    .insert({
      client_id: clientId,
      name: b.name,
      phone: normalizedPhone,
      source: "Walk-in",
      lead_origin: "client",
      lifecycle: "cold",
      notes,
      event_name: b.eventName,
    })
    .select("id, name, created_at")
    .single();

  if (cErr || !created) {
    console.error("[events/capture] contact insert failed:", cErr);
    return NextResponse.json({ error: "Could not create contact" }, { status: 500 });
  }

  const formData: Record<string, unknown> = {
    Name: b.name,
    Phone: normalizedPhone,
    hub_source: "Walk-in",
    event_name: b.eventName,
  };
  if (company) formData.Company = company;
  if (interest) formData.Notes = interest;

  const result = await createLead({
    clientId,
    source: "MANUAL",
    formData,
    contactId: created.id as string,
    overrideAssigneeId,
    forceUnassigned,
    initialStatus: "CONTACTED",
    hubSource: "Walk-in",
    hubIntake: "event_capture",
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "Contact saved, but creating the lead failed", detail: result.error },
      { status: 500 }
    );
  }

  await logWalkInIntake({
    leadId: result.leadId,
    clientId,
    actor,
    outcome: "event_capture",
    notes: notes,
  });

  try {
    await sendProspectLeadConfirmation({
      clientId,
      phone: normalizedPhone,
      name: b.name,
      leadId: result.leadId,
      formData,
      eventName: b.eventName,
    });
  } catch (err) {
    console.error("[events/capture] prospect confirmation failed:", err);
  }

  const stats = await loadTodayStats(clientId, b.eventName);
  return NextResponse.json({
    ok: true,
    returning: false,
    contactId: created.id,
    leadId: result.leadId,
    contactName: b.name,
    message: `Captured ${b.name}`,
    ...stats,
  });
}
