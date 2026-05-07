import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("users")
    .select("onboarding_completed, onboarding_step")
    .eq("id", session.userId)
    .maybeSingle();

  const typedData = data as { onboarding_completed?: boolean; onboarding_step?: number } | null;
  return NextResponse.json({
    completed: typedData?.onboarding_completed ?? false,
    step: typedData?.onboarding_step ?? 0,
  });
}

const patchSchema = z.union([
  z.object({ step: z.number().int().min(0).max(3) }),
  z.object({ completed: z.literal(true) }),
]);

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const update =
    "completed" in parsed.data && parsed.data.completed
      ? { onboarding_completed: true, onboarding_step: 3 }
      : { onboarding_step: (parsed.data as { step: number }).step };

  await supabase.from("users").update(update).eq("id", session.userId);
  return NextResponse.json({ success: true });
}
