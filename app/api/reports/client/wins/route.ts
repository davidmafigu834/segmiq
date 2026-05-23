import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.role === "SALESPERSON") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  if (!canAccessClient(session.role, session.clientId, clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: wins } = await supabase
    .from("win_analysis")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!wins || wins.length === 0) {
    return NextResponse.json({ wins: [], insights: null });
  }

  const avgDaysToClose = Math.round(
    wins.reduce((sum, w) => sum + ((w.days_to_close as number | null) ?? 0), 0) / wins.length
  );

  const avgCalls =
    Math.round(
      (wins.reduce((sum, w) => sum + ((w.total_calls as number | null) ?? 0), 0) / wins.length) * 10
    ) / 10;

  const portfolioWinRate = Math.round(
    (wins.filter((w) => w.portfolio_sent).length / wins.length) * 100
  );
  const pricingWinRate = Math.round(
    (wins.filter((w) => w.pricing_sent).length / wins.length) * 100
  );

  const winsWithValue = wins.filter((w) => w.deal_value);
  const avgDealValue =
    winsWithValue.length > 0
      ? Math.round(
          winsWithValue.reduce((sum, w) => sum + ((w.deal_value as number | null) ?? 0), 0) /
            winsWithValue.length
        )
      : null;

  const sourceCounts: Record<string, number> = {};
  wins.forEach((w) => {
    const src = w.source as string | null;
    if (src) sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
  });

  const spCounts: Record<string, { name: string; count: number }> = {};
  wins.forEach((w) => {
    const spId = w.salesperson_id as string | null;
    const spName = w.salesperson_name as string | null;
    if (spId && spName) {
      if (!spCounts[spId]) spCounts[spId] = { name: spName, count: 0 };
      spCounts[spId]!.count++;
    }
  });
  const topSalesperson =
    Object.values(spCounts).sort((a, b) => b.count - a.count)[0] ?? null;

  return NextResponse.json({
    wins,
    insights: {
      totalWins: wins.length,
      avgDaysToClose,
      avgCalls,
      avgDealValue,
      portfolioWinRate,
      pricingWinRate,
      sourceCounts,
      topSalesperson,
    },
  });
}
