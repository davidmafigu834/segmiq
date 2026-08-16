import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient, canManageClientProfile } from "@/lib/auth/permissions";
import { isClientSlugAvailable } from "@/lib/clients/slug";

const patchSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    industry: z.string().min(1).max(120).optional(),
    slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/).optional(),
    logo_url: z.string().optional().nullable(),
    logo_key: z.string().min(1).optional(),
    response_time_limit_hours: z.number().int().min(1).max(168).optional(),
    dial_code: z
      .string()
      .regex(/^[0-9]{2,4}$/)
      .optional()
      .nullable(),
    primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    website: z.string().max(300).optional().nullable(),
    country: z.string().max(80).optional().nullable(),
    owner_email: z
      .union([z.string().email().max(200), z.literal("")])
      .optional()
      .nullable(),
    assignment_mode: z.enum(["direct", "pool", "round_robin"]).optional(),
    business_type: z.enum(["trades", "real_estate"]).optional(),
    capability_tagline: z.string().max(200).optional().nullable(),
    years_in_operation: z.number().int().min(0).max(200).optional().nullable(),
  })
  .strict();

export async function GET(_req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, name, industry, slug, logo_url, response_time_limit_hours, dial_code, primary_color, website, country, owner_email, assignment_mode, business_type, capability_tagline, years_in_operation, fb_page_id, fb_page_name, fb_form_name"
    )
    .eq("id", params.clientId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ client: data });
}

export async function PATCH(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageClientProfile(session.role)) {
    return NextResponse.json({ error: "Only managers can edit company profile" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: existing, error: exErr } = await supabase
    .from("clients")
    .select("*")
    .eq("id", params.clientId)
    .maybeSingle();
  if (exErr || !existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = parsed.data;
  if (body.slug && body.slug !== existing.slug) {
    const available = await isClientSlugAvailable(supabase, body.slug, params.clientId);
    if (!available) {
      return NextResponse.json({ error: "Slug already in use" }, { status: 400 });
    }
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) update.name = body.name.trim();
  if (body.industry !== undefined) update.industry = body.industry.trim();
  if (body.slug !== undefined) update.slug = body.slug.trim();
  if (body.logo_url !== undefined) update.logo_url = body.logo_url || null;
  if (body.logo_key !== undefined) update.logo_key = body.logo_key;
  if (body.response_time_limit_hours !== undefined) update.response_time_limit_hours = body.response_time_limit_hours;
  if (body.dial_code !== undefined) update.dial_code = body.dial_code ? body.dial_code.trim() : null;
  if (body.primary_color !== undefined) update.primary_color = body.primary_color;
  if (body.website !== undefined) update.website = body.website?.trim() || null;
  if (body.country !== undefined) update.country = body.country?.trim() || null;
  if (body.owner_email !== undefined) update.owner_email = body.owner_email?.trim().toLowerCase() || null;
  if (body.assignment_mode !== undefined) update.assignment_mode = body.assignment_mode;
  if (body.business_type !== undefined) update.business_type = body.business_type;
  if (body.capability_tagline !== undefined) update.capability_tagline = body.capability_tagline?.trim() || null;
  if (body.years_in_operation !== undefined) update.years_in_operation = body.years_in_operation;

  const { data: client, error } = await supabase
    .from("clients")
    .update(update)
    .eq("id", params.clientId)
    .select(
      "id, name, industry, slug, logo_url, response_time_limit_hours, dial_code, primary_color, website, country, owner_email, assignment_mode, business_type, capability_tagline, years_in_operation, fb_page_id, fb_page_name, fb_form_name"
    )
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  if (body.primary_color !== undefined) {
    await supabase
      .from("landing_pages")
      .update({ primary_color: body.primary_color, updated_at: new Date().toISOString() })
      .eq("client_id", params.clientId);
  }

  return NextResponse.json({ client });
}
