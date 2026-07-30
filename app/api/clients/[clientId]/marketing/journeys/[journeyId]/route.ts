import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string; journeyId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const supabase = createAdminClient();

  const [{ data: journey }, { data: enrollments }] = await Promise.all([
    supabase
      .from("marketing_journeys")
      .select("*")
      .eq("id", params.journeyId)
      .eq("client_id", params.clientId)
      .maybeSingle(),
    supabase
      .from("marketing_journey_enrollments")
      .select("id, status, phone, enrolled_at, completed_at, current_step_index, last_error")
      .eq("journey_id", params.journeyId)
      .order("enrolled_at", { ascending: false })
      .limit(50),
  ]);

  if (!journey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ journey, enrollments: enrollments ?? [] });
}

const updateSchema = z.object({
  is_active: z.boolean().optional(),
  template_name: z.string().min(1).nullable().optional(),
  template_language: z.string().min(2).max(10).optional(),
  template_variables: z.record(z.string()).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; journeyId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  if (g.session.role !== "CLIENT_MANAGER" && g.session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("marketing_journeys")
    .select("template_name")
    .eq("id", params.journeyId)
    .eq("client_id", params.clientId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (parsed.data.template_name !== undefined) {
    patch.template_name = parsed.data.template_name;
  }
  if (parsed.data.template_language) {
    patch.template_language = parsed.data.template_language;
  }
  if (parsed.data.template_variables) {
    patch.template_variables = parsed.data.template_variables;
  }

  if (parsed.data.is_active !== undefined) {
    const templateName =
      parsed.data.template_name !== undefined
        ? parsed.data.template_name
        : (existing.template_name as string | null);
    if (parsed.data.is_active && !templateName) {
      return NextResponse.json(
        { error: "Assign an approved WhatsApp template before activating this journey" },
        { status: 400 }
      );
    }
    patch.is_active = parsed.data.is_active;
  }

  const { data: journey, error } = await supabase
    .from("marketing_journeys")
    .update(patch)
    .eq("id", params.journeyId)
    .eq("client_id", params.clientId)
    .select("*")
    .single();

  if (error || !journey) {
    return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ journey });
}
