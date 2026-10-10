import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSalesActorFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  contactLaterDays: z.number().int().min(1).max(90),
  checkinOffsetDays: z.number().int().min(1).max(30),
});

export async function GET(req: Request) {
  const guard = await requireSalesActorFromRequest(req);
  if (guard.error) return guard.error;
  if (!guard.session?.clientId) return NextResponse.json({ error: "No client context" }, { status: 400 });
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("clients")
    .select("copilot_contact_later_days, copilot_checkin_offset_days")
    .eq("id", guard.session.clientId)
    .maybeSingle();
  if (error) {
    if (/copilot_contact_later_days|does not exist/i.test(error.message)) {
      return NextResponse.json({ contactLaterDays: 7, checkinOffsetDays: 1, schemaMissing: true });
    }
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
  return NextResponse.json({
    contactLaterDays: Number(data?.copilot_contact_later_days) || 7,
    checkinOffsetDays: Number(data?.copilot_checkin_offset_days) || 1,
  });
}

export async function PATCH(req: Request) {
  const guard = await requireSalesActorFromRequest(req);
  if (guard.error) return guard.error;
  if (!guard.session?.clientId) return NextResponse.json({ error: "No client context" }, { status: 400 });
  if (guard.session.role === "SALESPERSON") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("clients")
    .update({
      copilot_contact_later_days: parsed.data.contactLaterDays,
      copilot_checkin_offset_days: parsed.data.checkinOffsetDays,
    })
    .eq("id", guard.session.clientId);
  if (error) return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  return NextResponse.json(parsed.data);
}
