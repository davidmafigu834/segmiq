import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/require-agency-admin";
import { prospectSchema } from "@/lib/platform-sales/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSameOrigin } from "@/lib/platform-sales/http";
import { platformSalesEnabled } from "@/lib/platform-sales/flags";
export async function PATCH(
  request: Request,
  { params }: { params: { prospectId: string } },
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth || auth.session.isImpersonating)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!platformSalesEnabled("quotes"))
    return NextResponse.json(
      { error: "Platform sales quotes are disabled" },
      { status: 409 },
    );
  try {
    assertSameOrigin(request);
    const input = prospectSchema.partial().parse(await request.json());
    const changes: Record<string, unknown> = {
      updated_by: auth.session.userId,
      updated_at: new Date().toISOString(),
    };
    const map: Record<string, string> = {
      organisationName: "organisation_name",
      legalName: "legal_name",
      tradingName: "trading_name",
      industry: "industry",
      contactName: "contact_name",
      contactPosition: "contact_position",
      email: "email",
      phone: "phone",
      address: "address",
      source: "source",
      notes: "notes",
    };
    for (const [key, column] of Object.entries(map))
      if (key in input)
        changes[column] = input[key as keyof typeof input] ?? null;
    const { data, error } = await createAdminClient()
      .from("platform_sales_prospects")
      .update(changes)
      .eq("id", params.prospectId)
      .is("converted_client_id", null)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data)
      return NextResponse.json(
        { error: "Prospect not found or already converted" },
        { status: 404 },
      );
    return NextResponse.json({ id: data.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 400 },
    );
  }
}
