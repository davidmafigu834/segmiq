import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSalesActorFromRequest } from "@/lib/api-guards";
import { getAttentionItem } from "@/lib/sales/attention";
import { enrichFocusItem } from "@/lib/sales/attention/enrichment";
import { buildAppointmentPrepBrief } from "@/lib/sales/attention/appointment-brief";
import { buildCallBrief } from "@/lib/sales/attention/call-brief";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  itemId: z.string().min(1),
  kind: z.enum(["summary", "call_brief", "appointment_prep"]).default("summary"),
});

/** Lazy LLM enrichment for a focus item (summary / call brief / appointment prep). */
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
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const item = await getAttentionItem({
    userId: session!.userId,
    clientId: session!.clientId,
    itemId: parsed.data.itemId,
  });
  if (!item) {
    return NextResponse.json({ error: "Focus item not found" }, { status: 404 });
  }

  try {
    if (parsed.data.kind === "call_brief") {
      const brief = buildCallBrief({
        item,
        context: {
          projectType: item.projectType,
          dealStage: item.dealStage,
          quoteLabel: item.quotationLabel,
          whyNow: item.whyNow,
        },
      });
      return NextResponse.json({ kind: "call_brief", brief });
    }

    if (parsed.data.kind === "appointment_prep") {
      const brief = await buildAppointmentPrepBrief({
        clientId: session!.clientId,
        salespersonId: session!.userId,
        leadId: item.leadId,
        dealId: item.dealId,
        customerName: item.customerName || item.title,
        appointmentLabel: item.subtitle,
        appointmentAt: item.dueAt,
        dealStage: item.dealStage,
        projectType: item.projectType,
        quoteLabel: item.quotationLabel,
      });
      return NextResponse.json({ kind: "appointment_prep", brief });
    }

    const summary = await enrichFocusItem({
      clientId: session!.clientId,
      salespersonId: session!.userId,
      leadId: item.leadId,
      dealId: item.dealId,
      context: {
        projectType: item.projectType,
        dealStage: item.dealStage,
        quoteLabel: item.quotationLabel,
        whyNow: item.whyNow,
        nextActionLabel: item.suggestedActionSummary,
      },
    });

    return NextResponse.json({
      kind: "summary",
      summary,
      whyNow: item.whyNow,
      suggestedAction: item.suggestedActionSummary,
    });
  } catch (err) {
    console.error("Attention enrich POST error:", err);
    return NextResponse.json(
      {
        error: "Conversation summary unavailable.",
        whyNow: item.whyNow,
        suggestedAction: item.suggestedActionSummary,
      },
      { status: 500 }
    );
  }
}
