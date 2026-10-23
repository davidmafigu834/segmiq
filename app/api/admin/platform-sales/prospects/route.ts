import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/require-agency-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { prospectSchema } from "@/lib/platform-sales/schemas";
import { assertSameOrigin } from "@/lib/platform-sales/http";
import { platformSalesEnabled } from "@/lib/platform-sales/flags";
import { listPlatformProspects } from "@/lib/platform-sales/repository";

async function actor() {
  const auth = await requireSuperAdmin();
  if ("error" in auth || auth.session.isImpersonating) return null;
  return auth.session;
}
export async function GET() {
  if (!(await actor()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!platformSalesEnabled("quotes"))
    return NextResponse.json({ prospects: [], enabled: false });
  try {
    return NextResponse.json({
      prospects: await listPlatformProspects(),
      enabled: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unavailable" },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  const session = await actor();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!platformSalesEnabled("quotes"))
    return NextResponse.json(
      { error: "Platform sales quotes are disabled" },
      { status: 409 },
    );
  try {
    assertSameOrigin(request);
    const input = prospectSchema.parse(await request.json());
    const { data, error } = await createAdminClient()
      .from("platform_sales_prospects")
      .insert({
        organisation_name: input.organisationName,
        legal_name: input.legalName ?? null,
        trading_name: input.tradingName ?? null,
        industry: input.industry ?? null,
        contact_name: input.contactName,
        contact_position: input.contactPosition ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        source: input.source ?? null,
        notes: input.notes ?? null,
        created_by: session.userId,
        updated_by: session.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}
