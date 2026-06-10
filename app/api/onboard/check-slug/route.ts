import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOnboardingToken } from "@/lib/onboarding/tokens";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug")?.trim().toLowerCase();
  const token = searchParams.get("token");

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ available: false, error: "Invalid slug" }, { status: 400 });
  }
  if (!token) {
    return NextResponse.json({ available: false, error: "Token required" }, { status: 400 });
  }

  const tokenResult = await findOnboardingToken(token);
  if (!tokenResult.ok) {
    const status = tokenResult.reason === "expired" ? 410 : 404;
    return NextResponse.json({ available: false, error: tokenResult.reason }, { status });
  }

  const supabase = createAdminClient();
  const { data: clash } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", slug)
    .neq("id", tokenResult.client.id)
    .maybeSingle();

  return NextResponse.json({ available: !clash, slug });
}
