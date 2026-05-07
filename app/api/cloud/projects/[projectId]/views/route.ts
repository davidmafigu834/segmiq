import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, client_id, is_public")
    .eq("id", params.projectId)
    .maybeSingle();

  if (!project || !(project as { is_public?: boolean }).is_public) {
    return NextResponse.json({ ok: false });
  }

  const typedProject = project as { id: string; client_id: string; is_public: boolean };

  let body: { visitor_id?: string; referrer?: string } = {};
  try {
    body = (await req.json()) as { visitor_id?: string; referrer?: string };
  } catch {
    // optional body
  }

  await supabase.from("project_views").insert({
    project_id: typedProject.id,
    client_id: typedProject.client_id,
    visitor_id: body.visitor_id ?? null,
    referrer: body.referrer ?? null,
    viewed_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}

export async function GET(
  _req: Request,
  { params }: { params: { projectId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !session?.clientId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, client_id")
    .eq("id", params.projectId)
    .eq("client_id", session.clientId)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: views } = await supabase
    .from("project_views")
    .select("viewed_at")
    .eq("project_id", params.projectId)
    .gte("viewed_at", thirtyDaysAgo)
    .order("viewed_at", { ascending: true });

  const { count: totalViews } = await supabase
    .from("project_views")
    .select("id", { count: "exact", head: true })
    .eq("project_id", params.projectId);

  const dailyMap: Record<string, number> = {};
  for (const v of views ?? []) {
    const day = (v as { viewed_at: string }).viewed_at.slice(0, 10);
    dailyMap[day] = (dailyMap[day] ?? 0) + 1;
  }

  const days: { date: string; views: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, views: dailyMap[key] ?? 0 });
  }

  return NextResponse.json({
    total: totalViews ?? 0,
    last_30_days: (views ?? []).length,
    daily: days,
  });
}
