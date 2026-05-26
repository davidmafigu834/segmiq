import { NextResponse } from "next/server";
import { createLead } from "@/lib/leads/createLead";
import { sourceFromString } from "@/lib/lead-helpers";
import { processLeadIntelligence } from "@/lib/lead-intelligence";
import { z } from "zod";

const bodySchema = z.object({
  clientId: z.string().uuid(),
  source: z.string(),
  formData: z.record(z.unknown()),
  facebookLeadId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { clientId, source, formData, facebookLeadId } = parsed.data;

    const src = sourceFromString(source);
    if (src === "FACEBOOK" && !facebookLeadId) {
      console.warn("[submit] FACEBOOK source without facebookLeadId — unexpected", { clientId });
    }

    const result = await createLead({
      clientId,
      source: src,
      formData: formData as Record<string, unknown>,
      facebookLeadId,
    });

    if (!result.ok) {
      if (result.code === "NO_CLIENT" || result.code === "ARCHIVED") {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }
      if (result.code === "INACTIVE") {
        return NextResponse.json({ error: result.error }, { status: 403 });
      }
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Fire and forget — do not await, do not block response
    processLeadIntelligence(result.leadId).catch((err) =>
      console.error("Lead intelligence processing failed:", err)
    );

    return NextResponse.json({
      success: true,
      leadId: result.leadId,
      duplicate: result.duplicate,
    });
  } catch (e) {
    console.error("[submit]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
