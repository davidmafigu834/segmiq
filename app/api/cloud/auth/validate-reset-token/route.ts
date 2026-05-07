import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token || token.length < 64) {
    return NextResponse.json({ valid: false, error: "No token provided" });
  }

  const supabase = createAdminClient();

  const { data } = await supabase
    .from("password_reset_tokens")
    .select("expires_at, used")
    .eq("token", token)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ valid: false, error: "Invalid reset link" });
  }

  const typedData = data as { expires_at: string; used: boolean };

  if (typedData.used) {
    return NextResponse.json({ valid: false, error: "This reset link has already been used" });
  }

  if (new Date(typedData.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, error: "This reset link has expired. Request a new one." });
  }

  return NextResponse.json({ valid: true });
}
