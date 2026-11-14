import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/require-agency-admin";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { createAdminClient } from "@/lib/supabase/admin";
import { createFunnel, listingsWithoutFunnel } from "@/lib/real-estate/funnels/service";

export const dynamic = "force-dynamic";

/** Listings of one organisation that do not have a funnel yet. */
export async function GET(req: Request) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const clientId = new URL(req.url).searchParams.get("clientId") ?? "";
  if (!z.string().uuid().safeParse(clientId).success) return NextResponse.json({ error: "Choose an organisation" }, { status: 400 });
  return NextResponse.json({ listings: await listingsWithoutFunnel(createAdminClient(), clientId) });
}

const schema = z.object({ clientId: z.string().uuid(), listingId: z.string().uuid() });

export async function POST(req: Request) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) return NextResponse.json({ error: "Forbidden" }, { status: origin.status });
  const auth = await requireSuperAdmin();
  if ("error" in auth || auth.session.isImpersonating) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose an organisation and a property" }, { status: 400 });
  const result = await createFunnel(createAdminClient(), auth.session.userId, parsed.data.clientId, parsed.data.listingId);
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json({ id: result.id }, { status: 201 });
}
