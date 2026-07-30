import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRoles } from "@/lib/api-guards";
import { archiveClient } from "@/lib/clients/archive";
import { isClientSlugAvailable } from "@/lib/clients/slug";
import { isPlausibleMetaAccessToken } from "@/lib/whatsapp/credentials";

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
    meta_whatsapp_phone_number_id: z
      .string()
      .regex(/^[0-9]+$/)
      .optional()
      .nullable(),
    meta_whatsapp_display_number: z.string().max(32).optional().nullable(),
    meta_whatsapp_access_token: z.string().max(500).optional().nullable(),
    assignment_mode: z.enum(["direct", "pool", "round_robin"]).optional(),
    business_type: z.enum(["trades", "real_estate"]).optional(),
    whatsapp_qualification_enabled: z.boolean().optional(),
    whatsapp_qualification_questions: z.array(z.record(z.unknown())).optional().nullable(),
    whatsapp_instant_form_id: z.string().uuid().nullable().optional(),
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
  const g = await requireRoles(["SUPER_ADMIN"]);
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
    const available = await isClientSlugAvailable(supabase, body.slug, params.clientId);
    if (!available) {
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
    const result = await archiveClient(supabase, params.clientId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
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
  if (body.meta_whatsapp_phone_number_id !== undefined) {
    update.meta_whatsapp_phone_number_id = body.meta_whatsapp_phone_number_id?.trim() || null;
  }
  if (body.meta_whatsapp_display_number !== undefined) {
    update.meta_whatsapp_display_number = body.meta_whatsapp_display_number?.trim() || null;
  }
  if (body.meta_whatsapp_access_token !== undefined) {
    const token = body.meta_whatsapp_access_token?.trim() || null;
    if (token && !isPlausibleMetaAccessToken(token)) {
      return NextResponse.json(
        {
          error:
            "Invalid WhatsApp access token — paste the full token from Meta API Setup (starts with EAA), or leave blank to use the platform token.",
        },
        { status: 400 }
      );
    }
    update.meta_whatsapp_access_token = token;
  }
  if (body.assignment_mode !== undefined) update.assignment_mode = body.assignment_mode;
  if (body.business_type !== undefined) update.business_type = body.business_type;
  if (body.whatsapp_qualification_enabled !== undefined) {
    update.whatsapp_qualification_enabled = body.whatsapp_qualification_enabled;
  }
  if (body.whatsapp_qualification_questions !== undefined) {
    update.whatsapp_qualification_questions = body.whatsapp_qualification_questions;
  }
  if (body.whatsapp_instant_form_id !== undefined) {
    update.whatsapp_instant_form_id = body.whatsapp_instant_form_id;
  }
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
