import { NextResponse } from "next/server";
import { requireAgencyAdmin } from "@/lib/require-agency-admin";
import { onboardPaidClient } from "@/lib/billing/onboard-paid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const guard = await requireAgencyAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  try {
    const result = await onboardPaidClient(
      {
        clientId,
        plan: String(body.plan ?? "starter"),
        billingCycle: String(body.billingCycle ?? "monthly"),
        amount: Number(body.amount),
        periodStart: String(body.periodStart ?? ""),
        paymentAmount: Number(body.paymentAmount),
        method: String(body.method ?? "bank_transfer"),
        methodDetail: typeof body.methodDetail === "string" ? body.methodDetail : null,
        reference: typeof body.reference === "string" ? body.reference : null,
        paidAt: String(body.paidAt ?? ""),
        notifyClient: body.notifyClient !== false,
      },
      guard.session.userId
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Onboard paid client failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to onboard client" },
      { status: 500 }
    );
  }
}
