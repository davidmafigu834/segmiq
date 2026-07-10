import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import { slugifyPackageName, uniquePackageSlug } from "@/lib/pricing/package-slug";

const ALLOWED_FIELDS = new Set([
  "name",
  "description",
  "tagline",
  "price_from",
  "price_to",
  "price_label",
  "price_note",
  "currency",
  "includes",
  "is_featured",
  "is_public",
  "slug",
  "display_order",
  "valid_until",
]);

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; packageId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const raw = (await req.json()) as Record<string, unknown>;
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (ALLOWED_FIELDS.has(key)) body[key] = value;
  }

  const { data: existing, error: fetchError } = await supabase
    .from("pricing_packages")
    .select("name, slug, is_public")
    .eq("id", params.packageId)
    .eq("client_id", params.clientId)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const nextIsPublic =
    "is_public" in body ? Boolean(body.is_public) : Boolean(existing.is_public);

  if (!nextIsPublic) {
    body.slug = null;
  } else {
    const name = typeof body.name === "string" ? body.name : (existing.name as string);
    const slugSource =
      typeof body.slug === "string" && body.slug.trim()
        ? body.slug
        : (existing.slug as string | null) || name;
    const slugBase = slugifyPackageName(String(slugSource));
    if (slugBase) {
      body.slug = await uniquePackageSlug(supabase, params.clientId, slugBase, params.packageId);
    }
  }

  const { data, error } = await supabase
    .from("pricing_packages")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", params.packageId)
    .eq("client_id", params.clientId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ package: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { clientId: string; packageId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  await supabase
    .from("pricing_packages")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", params.packageId)
    .eq("client_id", params.clientId);

  return NextResponse.json({ success: true });
}
