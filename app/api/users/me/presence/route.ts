import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AvailabilityOverride } from "@/lib/presence/constants";
import { derivePresenceState } from "@/lib/presence/derive-presence";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req);
  if (!auth?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("last_seen_at, availability_override")
    .eq("id", auth.userId)
    .maybeSingle();

  if (error || !data) {
    console.error("[presence get]", error);
    return NextResponse.json({ error: "Could not load presence" }, { status: 500 });
  }

  const availabilityOverride = (data.availability_override as AvailabilityOverride | null) ?? null;

  return NextResponse.json({
    lastSeenAt: data.last_seen_at,
    availabilityOverride,
    presence: derivePresenceState({
      lastSeenAt: data.last_seen_at,
      availabilityOverride,
    }),
  });
}

const bodySchema = z.object({
  availabilityOverride: z.enum(["AVAILABLE", "AWAY", "BUSY"]).nullable().optional(),
});

export async function POST(req: Request) {
  const auth = await getAuthFromRequest(req);
  if (!auth?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema> = {};
  try {
    const raw = await req.json();
    const parsed = bodySchema.safeParse(raw);
    if (parsed.success) body = parsed.data;
  } catch {
    // heartbeat-only body is fine
  }

  const supabase = createAdminClient();
  const patch: {
    last_seen_at: string;
    availability_override?: AvailabilityOverride | null;
  } = {
    last_seen_at: new Date().toISOString(),
  };

  if (body.availabilityOverride !== undefined) {
    patch.availability_override = body.availabilityOverride;
  }

  const { error } = await supabase.from("users").update(patch).eq("id", auth.userId);

  if (error) {
    console.error("[presence heartbeat]", error);
    return NextResponse.json({ error: "Could not update presence" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
