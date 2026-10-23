import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/require-agency-admin";
import { loadCommercialOverview } from "@/lib/commercial/account-repository";

export async function GET(_: Request, { params }: { params: { clientId: string } }) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.session.isImpersonating) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await loadCommercialOverview(params.clientId)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Commercial overview unavailable" }, { status: 503 }); }
}
