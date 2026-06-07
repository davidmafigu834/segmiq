import { NextResponse } from "next/server";
import { requireAgencyAdmin } from "@/lib/require-agency-admin";
import { issueInvoiceForSubscription } from "@/lib/billing/invoicing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Internal endpoint for issuing an invoice for a subscription's current period.
 * Restricted to agency admins. Cron wiring arrives in a later prompt — this is a
 * manual trigger for testing the invoicing engine.
 *
 * POST body: { "subscriptionId": "<uuid>" }
 */
export async function POST(req: Request) {
  const guard = await requireAgencyAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: { subscriptionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const subscriptionId = body.subscriptionId;
  if (typeof subscriptionId !== "string" || subscriptionId.length === 0) {
    return NextResponse.json({ error: "subscriptionId is required" }, { status: 400 });
  }

  try {
    const result = await issueInvoiceForSubscription(subscriptionId);
    return NextResponse.json(result, { status: result.alreadyExisted ? 200 : 201 });
  } catch (error) {
    console.error("Issue invoice failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to issue invoice" },
      { status: 500 }
    );
  }
}
