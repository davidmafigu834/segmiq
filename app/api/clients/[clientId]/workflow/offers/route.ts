import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { issueOfferLink } from "@/lib/real-estate/workflow/journey-links";
import { startOrGetTransactionFromOffer } from "@/lib/real-estate/transaction-service";
import { transactionStartRecovery } from "@/lib/real-estate/workflow/journey";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if (guard.error) return guard.error;
  const body = await req.json().catch(() => ({})) as {
    action?: string;
    listingId?: string;
    contactId?: string;
    buyerSearchId?: string | null;
    amount?: number;
    conditions?: string | null;
    templateKey?: string;
    templateValidityDays?: number | null;
    offerId?: string;
  };
  const actor = { userId: guard.session.userId, role: guard.session.role, clientId: guard.session.clientId, name: guard.session.user?.name ?? null };
  if (body.action === "retry_transaction" && body.offerId) {
    try {
      const started = await startOrGetTransactionFromOffer({
        clientId: params.clientId,
        offerId: body.offerId,
        actor: { id: actor.userId, name: actor.name ?? "Agent", role: actor.role, clientId: actor.clientId },
      });
      return NextResponse.json({ transactionStart: transactionStartRecovery(started) });
    } catch (error) {
      return NextResponse.json({
        transactionStart: transactionStartRecovery({ ok: false, error: error instanceof Error ? error.message : "The transaction did not start." }),
      });
    }
  }
  if (!body.listingId || !body.contactId || !body.amount) return NextResponse.json({ error: "Choose the buyer, property, and amount." }, { status: 400 });
  const result = await issueOfferLink({
    clientId: params.clientId,
    actor,
    listingId: body.listingId,
    contactId: body.contactId,
    buyerSearchId: body.buyerSearchId,
    amount: body.amount,
    conditions: body.conditions,
    templateKey: body.templateKey || "synthetic-offer-to-purchase",
    templateValidityDays: body.templateValidityDays,
  });
  return NextResponse.json(result.ok ? result : { error: result.error }, { status: result.ok ? 201 : result.status });
}
