import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRoles } from "@/lib/api-guards";
import { isClientSlugAvailable } from "@/lib/clients/slug";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await requireRoles(["AGENCY_ADMIN"]);
  if ("error" in g) return g.error;

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug")?.trim().toLowerCase();

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ available: false, error: "Invalid slug" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const available = await isClientSlugAvailable(supabase, slug);

  return NextResponse.json({ available, slug });
}
