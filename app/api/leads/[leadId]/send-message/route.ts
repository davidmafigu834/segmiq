import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canModifyLead } from "@/lib/auth/permissions";
import { sendWhatsAppTextToLead } from "@/lib/whatsapp/send-text";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  const check = await canModifyLead(params.leadId, req);
  if (!check.allowed) {
    return NextResponse.json({ error: check.reason }, { status: check.status });
  }

  const body = (await req.json()) as { text?: string };
  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Message text is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: actor } = await supabase
    .from("users")
    .select("name")
    .eq("id", check.userId)
    .maybeSingle();

  const result = await sendWhatsAppTextToLead({
    leadId: params.leadId,
    text,
    actorId: check.userId,
    actorName: (actor?.name as string) ?? "Salesperson",
    actorRole: check.role,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Send failed", code: result.errorCode }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    providerId: result.providerId,
    mode: result.mode,
  });
}
