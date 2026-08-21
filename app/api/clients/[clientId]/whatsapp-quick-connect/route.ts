import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRoles } from "@/lib/api-guards";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  whatsapp_temporary_web_enabled: z.boolean(),
});

/**
 * Enrol or remove a company from WhatsApp Sales Hub QR (temporary web) connection.
 * Super Admin only — company managers scan QR from their own settings once enrolled.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const guard = await requireRoles(["SUPER_ADMIN"]);
  if ("error" in guard) return guard.error;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: existing, error: exErr } = await supabase
    .from("clients")
    .select("id, whatsapp_temporary_web_enabled")
    .eq("id", params.clientId)
    .maybeSingle();

  if (exErr || !existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const next = parsed.data.whatsapp_temporary_web_enabled;
  if (existing.whatsapp_temporary_web_enabled === next) {
    return NextResponse.json({
      id: params.clientId,
      whatsapp_temporary_web_enabled: next,
      unchanged: true,
    });
  }

  const { data: updated, error } = await supabase
    .from("clients")
    .update({ whatsapp_temporary_web_enabled: next })
    .eq("id", params.clientId)
    .select("id, whatsapp_temporary_web_enabled")
    .single();

  if (error) {
    console.error("[whatsapp-quick-connect]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}
