import { NextResponse } from "next/server";
import { requireAgencyAdmin } from "@/lib/require-agency-admin";
import { resolveIncident } from "@/lib/status-admin";

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAgencyAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    await resolveIncident(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("resolveIncident failed", e);
    return NextResponse.json({ error: "Resolve failed" }, { status: 500 });
  }
}
