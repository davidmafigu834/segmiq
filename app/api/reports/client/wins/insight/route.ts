import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import { callClaude } from "@/lib/ai/claude";

type WinInsights = {
  totalWins: number;
  avgDaysToClose: number;
  avgCalls: number;
  avgDealValue: number | null;
  portfolioWinRate: number;
  pricingWinRate: number;
  topSalesperson?: { name: string; count: number } | null;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role === "SALESPERSON") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { clientId?: string; insights?: WinInsights };
  const { clientId, insights } = body;

  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  if (!canAccessClient(session.role, session.clientId, clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!insights || insights.totalWins < 3) {
    return NextResponse.json({
      insight:
        "Not enough won deals yet to identify patterns. Close at least 3 deals to see insights.",
    });
  }

  const context = `
Total deals analysed: ${insights.totalWins}
Average days to close: ${insights.avgDaysToClose}
Average calls to close: ${insights.avgCalls}
Portfolio was sent on wins: ${insights.portfolioWinRate}% of the time
Pricing was sent on wins: ${insights.pricingWinRate}% of the time
Average deal value: ${insights.avgDealValue ? `$${insights.avgDealValue}` : "not tracked"}
Top salesperson: ${insights.topSalesperson?.name ?? "not identified"} with ${insights.topSalesperson?.count ?? 0} wins
  `.trim();

  try {
    const insight = await callClaude({
      system: `You are a sales performance analyst for service businesses in Africa.
You interpret win pattern data and write a brief plain-language insight.
Write 2 to 3 sentences only.
Be specific about what the numbers mean for the team.
Mention what is working well and one thing to improve.
No bullet points. No headers. Just sentences.`,
      userMessage: `Write a plain-language insight from this win pattern data:\n\n${context}`,
      maxTokens: 200,
    });

    return NextResponse.json({ insight });
  } catch (err) {
    console.error("[wins/insight] Claude call failed:", err);
    return NextResponse.json(
      { insight: "Win pattern analysis is currently unavailable." },
      { status: 503 }
    );
  }
}
