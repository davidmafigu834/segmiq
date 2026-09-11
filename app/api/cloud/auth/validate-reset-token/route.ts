import { NextResponse } from "next/server";
import { findValidPasswordResetToken } from "@/lib/auth/password-reset-tokens";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token || token.length < 64) {
    return NextResponse.json({ valid: false, error: "No token provided" });
  }

  const data = await findValidPasswordResetToken(token);
  if (!data) {
    return NextResponse.json({ valid: false, error: "Invalid or expired reset link" });
  }

  return NextResponse.json({ valid: true });
}
