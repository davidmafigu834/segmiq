import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PLAN_LIMITS: Record<string, number> = {
  free: 5 * 1024 * 1024 * 1024,
  professional: 50 * 1024 * 1024 * 1024,
  business: 200 * 1024 * 1024 * 1024,
  enterprise: 1024 * 1024 * 1024 * 1024,
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !session?.clientId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const [mediaRes, projectRes, clientRes] = await Promise.all([
    supabase
      .from("project_media")
      .select("id, file_size_bytes")
      .eq("client_id", session.clientId)
      .eq("type", "photo"),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("client_id", session.clientId),
    supabase
      .from("clients")
      .select("plan")
      .eq("id", session.clientId)
      .maybeSingle(),
  ]);

  if (mediaRes.error) return NextResponse.json({ error: mediaRes.error.message }, { status: 500 });

  const plan = (clientRes.data as { plan?: string } | null)?.plan ?? "free";
  const limitBytes = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const totalPhotos = mediaRes.data?.length ?? 0;
  const totalBytes = mediaRes.data?.reduce((sum, m) => sum + (m.file_size_bytes ?? 0), 0) ?? 0;

  return NextResponse.json({
    plan,
    limit_bytes: limitBytes,
    total_bytes: totalBytes,
    total_photos: totalPhotos,
    total_projects: projectRes.count ?? 0,
    pct: Math.min(100, (totalBytes / limitBytes) * 100),
  });
}
