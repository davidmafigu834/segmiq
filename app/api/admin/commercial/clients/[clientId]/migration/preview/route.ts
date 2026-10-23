import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/require-agency-admin";
import { buildMigrationPreview } from "@/lib/commercial/amendment-service";

export async function POST(request: Request, { params }: { params: { clientId: string } }) {
  const auth = await requireSuperAdmin();
  if ("error" in auth || auth.session.isImpersonating) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { const { proposed, legacy } = await buildMigrationPreview(params.clientId, await request.json()); return NextResponse.json({ proposed, legacy, consentRequired: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Migration preview failed" }, { status: 400 }); }
}
