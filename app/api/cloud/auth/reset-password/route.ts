import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(64),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { token, password } = parsed.data;
  const supabase = createAdminClient();

  const { data: resetToken } = await supabase
    .from("password_reset_tokens")
    .select("user_id, expires_at, used")
    .eq("token", token)
    .maybeSingle();

  if (!resetToken) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }

  const typedToken = resetToken as { user_id: string; expires_at: string; used: boolean };

  if (typedToken.used) {
    return NextResponse.json({ error: "This reset link has already been used" }, { status: 400 });
  }

  if (new Date(typedToken.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "This reset link has expired. Request a new one." },
      { status: 400 }
    );
  }

  const hashed = await hashPassword(password);

  const { data: userRow } = await supabase
    .from("users")
    .select("session_version")
    .eq("id", typedToken.user_id)
    .maybeSingle();

  const currentVersion =
    (userRow as { session_version?: number } | null)?.session_version ?? 0;

  await supabase
    .from("users")
    .update({
      password: hashed,
      session_version: currentVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", typedToken.user_id);

  await supabase
    .from("password_reset_tokens")
    .update({ used: true })
    .eq("token", token);

  return NextResponse.json({ success: true });
}
