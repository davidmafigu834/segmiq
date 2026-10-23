import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireSuperAdmin } from "@/lib/require-agency-admin";
import { buildPlanChangePreview } from "@/lib/commercial/amendment-service";

export async function POST(request: Request, { params }: { params: { clientId: string } }) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.session.isImpersonating) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { const { preview } = await buildPlanChangePreview(params.clientId, await request.json()); return NextResponse.json(preview); }
  catch (error) { return NextResponse.json({ error: error instanceof ZodError ? "Invalid plan change request" : error instanceof Error ? error.message : "Preview failed" }, { status: 400 }); }
}
