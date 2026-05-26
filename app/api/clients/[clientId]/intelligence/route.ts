import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessClient(session.role, session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { searchParams } = new URL(req.url);
  const weeks = parseInt(searchParams.get("weeks") ?? "4");

  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);

  // Recent intelligence records for this client
  const { data: records } = await supabase
    .from("lead_intelligence")
    .select(
      `
      id,
      lead_id,
      intent_category,
      intent_subcategory,
      urgency_level,
      budget_confidence,
      budget_estimate_usd,
      project_specificity,
      is_likely_decision_maker,
      property_type,
      location_extracted,
      tags,
      intent_score,
      created_at,
      leads (name, status, source, created_at)
    `
    )
    .eq("client_id", params.clientId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(200);

  // Recent weekly snapshots
  const { data: snapshots } = await supabase
    .from("client_intelligence_snapshots")
    .select("*")
    .eq("client_id", params.clientId)
    .order("week_start", { ascending: false })
    .limit(weeks);

  // Aggregated stats across the period
  const recs = records ?? [];

  const intentDist: Record<string, number> = {};
  recs.forEach((r) => {
    if (r.intent_category && r.intent_category !== "unknown") {
      intentDist[r.intent_category as string] =
        (intentDist[r.intent_category as string] ?? 0) + 1;
    }
  });

  const urgencyDist: Record<string, number> = {};
  recs.forEach((r) => {
    if (r.urgency_level && r.urgency_level !== "unknown") {
      urgencyDist[r.urgency_level as string] =
        (urgencyDist[r.urgency_level as string] ?? 0) + 1;
    }
  });

  const avgIntentScore =
    recs.length > 0
      ? Math.round(
          recs.reduce((s, r) => s + ((r.intent_score as number) ?? 0), 0) /
            recs.length
        )
      : 0;

  const tagCounts: Record<string, number> = {};
  recs.forEach((r) => {
    ((r.tags as string[]) ?? []).forEach((tag: string) => {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    });
  });

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));

  const locationCounts: Record<string, number> = {};
  recs.forEach((r) => {
    if (r.location_extracted) {
      locationCounts[r.location_extracted as string] =
        (locationCounts[r.location_extracted as string] ?? 0) + 1;
    }
  });

  const topLocations = Object.entries(locationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([location, count]) => ({ location, count }));

  return NextResponse.json({
    records: recs,
    snapshots: snapshots ?? [],
    summary: {
      totalProcessed: recs.length,
      avgIntentScore,
      intentDistribution: intentDist,
      urgencyDistribution: urgencyDist,
      topTags,
      topLocations,
    },
  });
}
