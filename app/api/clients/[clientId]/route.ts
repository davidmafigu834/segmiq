import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRoles } from "@/lib/api-guards";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    industry: z.string().min(1).max(120).optional(),
    slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/).optional(),
    logo_url: z.string().optional().nullable(),
    response_time_limit_hours: z.number().int().min(1).max(168).optional(),
    twilio_whatsapp_override: z.string().optional().nullable(),
    send_prospect_confirmation: z.boolean().optional(),
    dial_code: z
      .string()
      .regex(/^[0-9]{2,4}$/)
      .optional()
      .nullable(),
    primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    /** @deprecated Manager alerts use `users.notification_prefs` (CLIENT_MANAGER). Column kept for compatibility. */
    manager_notification_prefs: z
      .object({
        newLead: z.boolean(),
        dealWon: z.boolean(),
        overdueLead: z.boolean(),
      })
      .optional(),
    is_active: z.boolean().optional(),
    is_archived: z.boolean().optional(),
    custom_domain: z.string().optional().nullable(),
    font_choice: z.string().min(1).max(64).optional().nullable(),
    deleteConfirmName: z.string().min(1).optional(),
  })
  .strict();

export async function PATCH(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireRoles(["AGENCY_ADMIN"]);
  if ("error" in g) return g.error;

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: existing, error: exErr } = await supabase.from("clients").select("*").eq("id", params.clientId).maybeSingle();
  if (exErr || !existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = parsed.data;

  if (body.slug && body.slug !== existing.slug) {
    const { data: clash } = await supabase.from("clients").select("id").eq("slug", body.slug).neq("id", params.clientId).maybeSingle();
    if (clash) {
      return NextResponse.json({ error: "Slug already in use" }, { status: 400 });
    }
  }

  if (body.deleteConfirmName !== undefined) {
    const savedName = String(existing.name ?? "").trim();
    if (!savedName) {
      return NextResponse.json({ error: "Client has no saved name — cannot confirm delete" }, { status: 400 });
    }
    if (body.deleteConfirmName.trim() !== savedName) {
      return NextResponse.json({ error: "Name does not match — delete cancelled" }, { status: 400 });
    }
    const { data: archived, error } = await supabase
      .from("clients")
      .update({
        is_archived: true,
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.clientId)
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!archived) {
      return NextResponse.json({ error: "Client could not be archived" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, archived: true });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) update.name = body.name.trim();
  if (body.industry !== undefined) update.industry = body.industry.trim();
  if (body.slug !== undefined) update.slug = body.slug.trim();
  if (body.logo_url !== undefined) update.logo_url = body.logo_url || null;
  if (body.response_time_limit_hours !== undefined) update.response_time_limit_hours = body.response_time_limit_hours;
  if (body.twilio_whatsapp_override !== undefined) update.twilio_whatsapp_override = body.twilio_whatsapp_override?.trim() || null;
  if (body.send_prospect_confirmation !== undefined) update.send_prospect_confirmation = body.send_prospect_confirmation;
  if (body.dial_code !== undefined) update.dial_code = body.dial_code ? body.dial_code.trim() : null;
  if (body.primary_color !== undefined) update.primary_color = body.primary_color;
  if (body.manager_notification_prefs !== undefined) update.manager_notification_prefs = body.manager_notification_prefs;
  if (body.is_active !== undefined) update.is_active = body.is_active;
  if (body.is_archived !== undefined) update.is_archived = body.is_archived;

  const { data: client, error } = await supabase
    .from("clients")
    .update(update)
    .eq("id", params.clientId)
    .select("*")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  if (body.custom_domain !== undefined || body.font_choice !== undefined) {
    const lpUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.custom_domain !== undefined) lpUpdate.custom_domain = body.custom_domain?.trim() || null;
    if (body.font_choice !== undefined) lpUpdate.font_choice = body.font_choice || "inter";
    if (body.primary_color !== undefined) lpUpdate.primary_color = body.primary_color;
    await supabase.from("landing_pages").update(lpUpdate).eq("client_id", params.clientId);
  } else if (body.primary_color !== undefined) {
    await supabase
      .from("landing_pages")
      .update({ primary_color: body.primary_color, updated_at: new Date().toISOString() })
      .eq("client_id", params.clientId);
  }

  return NextResponse.json({ client });
}
