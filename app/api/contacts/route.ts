import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionFromRequest } from "@/lib/api-guards";
import { canAccessClient } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp-opener";
import { createLead } from "@/lib/leads/createLead";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  type: z.enum(["lead", "customer"]),
  name: z.string().max(200).optional(),
  phone: z.string().min(3).max(40),
  email: z.string().max(200).optional(),
  source: z.string().min(1).max(80),
  notes: z.string().max(5000).optional(),
  projectType: z.string().max(200).optional(),
  budget: z.string().max(200).optional(),
  priority: z.enum(["hot", "warm", "cold"]).optional(),
  assignMode: z.enum(["specific", "round_robin", "pool"]).optional(),
  assigneeId: z.string().uuid().optional(),
  forceNew: z.boolean().optional(),
  clientId: z.string().uuid().optional(),
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

  const requestedClientId = session.role === "AGENCY_ADMIN" ? b.clientId : session.clientId;
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
    if (b.type === "customer" && existing.lifecycle !== "customer") {
      await supabase
        .from("contacts")
        .update({ lifecycle: "customer", updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    }
    if (b.type === "lead" && !b.forceNew) {
      return NextResponse.json(
        {
          error: "duplicate",
          existing: {
            id: existing.id,
            name: existing.name,
            lifecycle: existing.lifecycle,
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
        lifecycle: b.type === "customer" ? "customer" : "lead",
        notes: b.notes ?? null,
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

  let overrideAssigneeId: string | undefined;
  let forceUnassigned = false;

  if (session.role === "SALESPERSON") {
    const mode = (client?.assignment_mode as string | null) || "direct";
    if (mode === "direct") overrideAssigneeId = session.userId;
    else if (mode === "pool") forceUnassigned = true;
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

  const result = await createLead({
    clientId: requestedClientId,
    source: "MANUAL",
    formData,
    contactId,
    overrideAssigneeId,
    forceUnassigned,
    manualPriority: b.priority,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "Contact saved, but creating the lead failed", detail: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, kind: "lead", contactId, leadId: result.leadId });
}
