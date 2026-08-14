import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoles } from "@/lib/api-guards";
import { getCompanyCustomerDetail } from "@/lib/sales/get-company-customers-page-data";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { customerId: string } }
) {
  const guard = await requireRoles(["CLIENT_MANAGER", "SUPER_ADMIN"]);
  if (guard.error) return guard.error;
  const { session } = guard;
  const clientId = new URL(req.url).searchParams.get("clientId") || session!.clientId;
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
  if (session!.role === "CLIENT_MANAGER" && session!.clientId !== clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const detail = await getCompanyCustomerDetail({ clientId, customerId: params.customerId });
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ detail });
  } catch (error) {
    console.error("[client/customers/customer]", error);
    return NextResponse.json({ error: "Failed to load Customer" }, { status: 500 });
  }
}

const patchSchema = z.object({
  customerType: z.enum(["company", "individual"]).optional(),
  relationshipOwnerId: z.string().uuid().nullable().optional(),
  primaryContactName: z.string().max(200).nullable().optional(),
  industry: z.string().max(200).nullable().optional(),
  location: z.string().max(300).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { customerId: string } }
) {
  const guard = await requireRoles(["CLIENT_MANAGER", "SUPER_ADMIN"]);
  if (guard.error) return guard.error;
  const { session } = guard;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Customer update" }, { status: 400 });
  }
  const clientId = new URL(req.url).searchParams.get("clientId") || session!.clientId;
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
  if (session!.role === "CLIENT_MANAGER" && session!.clientId !== clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = createAdminClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", params.customerId)
    .eq("client_id", clientId)
    .eq("lifecycle", "customer")
    .maybeSingle();
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.relationshipOwnerId) {
    const { data: owner } = await supabase
      .from("users")
      .select("id, role, also_sells, is_active")
      .eq("id", parsed.data.relationshipOwnerId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (
      !owner ||
      owner.is_active === false ||
      (owner.role !== "SALESPERSON" && !owner.also_sells)
    ) {
      return NextResponse.json({ error: "Invalid relationship owner" }, { status: 400 });
    }
  }

  const clean = (value: string | null | undefined) =>
    value === undefined ? undefined : value?.trim() || null;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.customerType !== undefined) {
    update.customer_type = parsed.data.customerType;
  }
  if (parsed.data.relationshipOwnerId !== undefined) {
    update.relationship_owner_id = parsed.data.relationshipOwnerId;
  }
  if (parsed.data.primaryContactName !== undefined) {
    update.primary_contact_name = clean(parsed.data.primaryContactName);
  }
  if (parsed.data.industry !== undefined) {
    update.industry = clean(parsed.data.industry);
  }
  if (parsed.data.location !== undefined) {
    update.location = clean(parsed.data.location);
  }
  const { error } = await supabase
    .from("contacts")
    .update(update)
    .eq("id", params.customerId)
    .eq("client_id", clientId);
  if (error) {
    console.error("[client/customers/customer:update]", error);
    return NextResponse.json({ error: "Could not update Customer" }, { status: 500 });
  }
  const detail = await getCompanyCustomerDetail({ clientId, customerId: params.customerId });
  return NextResponse.json({ detail });
}
