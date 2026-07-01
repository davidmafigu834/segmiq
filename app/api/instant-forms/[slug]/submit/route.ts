import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createLead } from "@/lib/leads/createLead";
import { processLeadIntelligence } from "@/lib/lead-intelligence";
import { z } from "zod";

const bodySchema = z.object({
  clientId: z.string().uuid(),
  formData: z.record(z.string()),
});

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: form } = await supabase
      .from("instant_forms")
      .select("id, name, client_id, status, submission_count")
      .eq("slug", params.slug)
      .eq("status", "published")
      .maybeSingle();

    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    if (form.client_id !== parsed.data.clientId) {
      return NextResponse.json({ error: "Invalid client" }, { status: 400 });
    }

    const formData: Record<string, unknown> = {
      ...parsed.data.formData,
      _instantFormId: form.id,
      _instantFormName: form.name,
    };

    const result = await createLead({
      clientId: parsed.data.clientId,
      source: "LANDING_PAGE",
      formData,
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

    await supabase
      .from("instant_forms")
      .update({
        submission_count: ((form.submission_count as number) ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", form.id);

    processLeadIntelligence(result.leadId).catch((err) =>
      console.error("Lead intelligence processing failed:", err)
    );

    return NextResponse.json({
      success: true,
      leadId: result.leadId,
      duplicate: result.duplicate,
    });
  } catch (e) {
    console.error("[instant-forms/submit]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
