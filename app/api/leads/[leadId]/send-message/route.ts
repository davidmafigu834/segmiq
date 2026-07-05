import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canModifyLead } from "@/lib/auth/permissions";
import { isWhatsAppSessionOpen } from "@/lib/whatsapp/inbound";
import { sendWhatsAppSessionMessage } from "@/lib/whatsapp/session-message";

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
  const { data: lead } = await supabase
    .from("leads")
    .select("id, client_id, phone, source, assigned_to_id")
    .eq("id", params.leadId)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (lead.source !== "WHATSAPP_INBOUND") {
    return NextResponse.json({ error: "Not a WhatsApp conversation" }, { status: 400 });
  }

  if (!lead.phone) {
    return NextResponse.json({ error: "Lead has no phone number" }, { status: 400 });
  }

  const sessionOpen = await isWhatsAppSessionOpen(params.leadId);
  if (!sessionOpen) {
    return NextResponse.json(
      {
        error: "WhatsApp session expired — use a template quick reply or wait for the customer to message again",
        code: "SESSION_EXPIRED",
      },
      { status: 409 }
    );
  }

  const { data: actor } = await supabase
    .from("users")
    .select("name")
    .eq("id", check.userId)
    .maybeSingle();

  const result = await sendWhatsAppSessionMessage({
    to: lead.phone as string,
    body: text,
    clientId: lead.client_id as string,
    leadId: params.leadId,
    actorId: check.userId,
    actorName: (actor?.name as string) ?? "Salesperson",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Send failed", code: result.errorCode }, { status: 502 });
  }

  return NextResponse.json({ ok: true, providerId: result.providerId });
}
