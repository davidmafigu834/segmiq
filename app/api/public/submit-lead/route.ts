import { NextResponse } from "next/server";
import { createLead } from "@/lib/leads/createLead";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const { clientId, formData } = (await req.json()) as {
    clientId: string;
    formData: Record<string, unknown>;
  };

  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }
  // Enrich with minimal metadata for Phase B smart mapping (location/urgency)
  // Non-blocking: if this fails, we still create the lead.
  let enriched = formData ?? {};
  try {
    const supabase = createAdminClient();
    const { data: steps } = await supabase
      .from("form_steps")
      .select("id, form_fields(id, label, maps_to)")
      .eq("client_id", clientId)
      .order("step_number", { ascending: true });
    const fields: Array<{ id: string; label?: string | null; maps_to?: string | null }> = [];
    for (const s of (steps as Array<{ form_fields?: Array<{ id: string; label?: string | null; maps_to?: string | null }> }> | null) ?? []) {
      for (const f of s.form_fields ?? []) fields.push({ id: f.id, label: f.label ?? null, maps_to: f.maps_to ?? null });
    }
    const meta = fields.map((f) => {
      const label = (f.label ?? "").trim();
      const low = label.toLowerCase();
      let role: "location" | "urgency" | undefined;
      if (low.includes("city") || low.includes("suburb") || low.includes("town") || low.includes("location")) role = "location";
      if (!role && (f.maps_to === "timeline" || low.includes("when") || low.includes("timeline") || low.includes("start") || low.includes("urgent") || low.includes("asap") || low.includes("soon"))) {
        role = "urgency";
      }
      return { id: f.id, label, role };
    });
    enriched = { ...formData, __fields: meta } as Record<string, unknown>;
  } catch {
    // fall back silently
  }

  const result = await createLead({
    clientId,
    source: "LANDING_PAGE",
    formData: enriched,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, leadId: result.leadId });
}
