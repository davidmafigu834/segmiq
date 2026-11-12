import { NextResponse } from "next/server";
import { offerLetterFields, previewJourneyLink, sellerOfferDecision, signBuyerOffer, submitViewingLink } from "@/lib/real-estate/workflow/journey-links";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const result = await previewJourneyLink(params.token);
  return NextResponse.json(result.ok ? result : { error: result.error }, {
    status: result.ok ? 200 : result.status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const body = await req.json().catch(() => ({})) as {
    action?: string;
    slot?: string;
    name?: string;
    phone?: string;
    signature?: string;
    party?: string;
    amount?: number;
    conditions?: string;
    letter?: Record<string, unknown> | null;
    decision?: "accept" | "decline";
    witness?: string;
  };
  if (body.action === "viewing") {
    const result = await submitViewingLink({
      token: params.token,
      slot: body.slot ?? "",
      name: body.name ?? "",
      phone: body.phone ?? "",
      signature: body.signature ?? "",
    });
    return NextResponse.json(result.ok ? result : { error: result.error }, { status: result.ok ? 200 : result.status });
  }
  if (body.action === "sign_offer") {
    const result = await signBuyerOffer({
      token: params.token,
      name: body.name ?? "",
      signature: body.signature ?? "",
      amount: Number(body.amount),
      conditions: body.conditions ?? "",
      letter: offerLetterFields(body.letter),
    });
    return NextResponse.json(result.ok ? result : { error: result.error }, { status: result.ok ? 200 : result.status });
  }
  if (body.action === "seller_decision") {
    const result = await sellerOfferDecision({
      token: params.token,
      name: body.name ?? "",
      signature: body.signature ?? "",
      decision: body.decision === "decline" ? "decline" : "accept",
      witness: body.witness,
    });
    return NextResponse.json(result.ok ? result : { error: result.error }, { status: result.ok ? 200 : result.status });
  }
  return NextResponse.json({ error: "Choose an action." }, { status: 400 });
}
