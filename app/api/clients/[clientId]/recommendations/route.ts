import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import { runPerformanceAnalysis } from "@/lib/performance-intelligence";

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function GET(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !canAccessClient(session.role, session.clientId ?? null, params.clientId)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data: recommendations } = await supabase
    .from("client_recommendations")
    .select("*")
    .eq("client_id", params.clientId)
    .eq("status", "active")
    .order("generated_at", { ascending: false })
    .limit(20);

  const sorted = (recommendations ?? []).sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority as string] ?? 3) -
      (PRIORITY_ORDER[b.priority as string] ?? 3)
  );

  return NextResponse.json({ recommendations: sorted });
}

// POST — trigger fresh analysis on demand (AGENCY_ADMIN only)
export async function POST(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await runPerformanceAnalysis(params.clientId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
