import { NextResponse } from "next/server";
import { fetchOrganisationTeamActivity } from "@/lib/agency/organisation-team-activity";
import { requireSuperAdmin } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

/**
 * Per-person staff presence and last work type for one organisation.
 * Lead and deal names are not included.
 */
export async function GET(_req: Request, { params }: { params: { clientId: string } }) {
  const gate = await requireSuperAdmin();
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  try {
    const activity = await fetchOrganisationTeamActivity(params.clientId);
    if (!activity) {
      return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
    }
    return NextResponse.json(activity);
  } catch (error) {
    console.error("[organisation team activity]", error);
    return NextResponse.json({ error: "Could not load team activity" }, { status: 500 });
  }
}
