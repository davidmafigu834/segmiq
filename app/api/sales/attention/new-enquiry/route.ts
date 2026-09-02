import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSalesActorFromRequest } from "@/lib/api-guards";
import {
  buildNewEnquiryAssist,
  completeAttentionItem,
  emitAttentionEvent,
  getAttentionItem,
  getTodaysFocus,
} from "@/lib/sales/attention";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppTextToLead } from "@/lib/whatsapp/send-text";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  itemId: z.string().min(1),
  action: z.enum(["summarize", "draft", "send"]),
  /** Required for send — salesperson must confirm the exact text. */
  text: z.string().min(1).max(4000).optional(),
});

/**
 * New enquiry assist: summarize / draft / explicit click-to-send.
 * Never auto-sends without action=send + text.
 */
export async function POST(req: Request) {
  const guard = await requireSalesActorFromRequest(req);
  if (guard.error) return guard.error;
  const { session } = guard;

  if (!session!.clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;
  const clientId = session!.clientId;
  const userId = session!.userId;

  const item = await getAttentionItem({ userId, clientId, itemId: body.itemId });
  if (!item || !item.leadId) {
    return NextResponse.json({ error: "New enquiry not found" }, { status: 404 });
  }
  if (item.metadata?.focusLane !== "new_enquiry" && item.type !== "NEW_LEAD_CONTACT") {
    return NextResponse.json({ error: "Item is not a new enquiry" }, { status: 400 });
  }

  if (body.action === "summarize" || body.action === "draft") {
    const assist = await buildNewEnquiryAssist({ clientId, salespersonId: userId, item });
    if (!assist) {
      return NextResponse.json({ error: "Could not build enquiry assist" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, assist });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Message text is required to send" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: actor } = await supabase
    .from("users")
    .select("name")
    .eq("id", userId)
    .maybeSingle();

  const result = await sendWhatsAppTextToLead({
    leadId: item.leadId,
    text,
    actorId: userId,
    actorName: (actor?.name as string) ?? "Salesperson",
    actorRole: session!.role,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Send failed", code: result.errorCode },
      { status: 502 }
    );
  }

  const focus = await getTodaysFocus({ userId, clientId, reconcile: false });
  try {
    await completeAttentionItem({
      userId,
      clientId,
      item,
      planDate: focus.planDate,
    });
  } catch {
    /* send succeeded — focus clear is best-effort */
  }

  void emitAttentionEvent({
    clientId,
    salespersonId: userId,
    eventType: "sales_agent.focus_action_executed",
    payload: { kind: "new_enquiry_click_send", leadId: item.leadId },
  });

  const next = await getTodaysFocus({ userId, clientId });
  return NextResponse.json({
    ok: true,
    sent: true,
    providerId: result.providerId,
    mode: result.mode,
    focus: next,
  });
}
