import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PLAN_LIMITS: Record<string, number> = {
  starter:      20  * 1024 * 1024 * 1024,  // 20 GB
  professional: 100 * 1024 * 1024 * 1024,  // 100 GB
  business:     500 * 1024 * 1024 * 1024,  // 500 GB
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

  const rawPlan = (clientRes.data as { plan?: string } | null)?.plan ?? "starter";
  const displayPlan = rawPlan === "free" ? "starter" : rawPlan;
  const limitBytes = PLAN_LIMITS[displayPlan] ?? PLAN_LIMITS.starter;
  const totalPhotos = mediaRes.data?.length ?? 0;
  const totalBytes = mediaRes.data?.reduce((sum, m) => sum + (m.file_size_bytes ?? 0), 0) ?? 0;

  return NextResponse.json({
    plan: displayPlan,
    limit_bytes: limitBytes,
    total_bytes: totalBytes,
    total_photos: totalPhotos,
    total_projects: projectRes.count ?? 0,
    pct: Math.min(100, (totalBytes / limitBytes) * 100),
  });
}
