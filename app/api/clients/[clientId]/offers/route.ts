import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import {
  assertRealEstateClient,
  createRealEstateOffer,
  listRealEstateOffers,
  type OfferListTab,
} from "@/lib/real-estate/offer-service";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  listing_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  lead_id: z.string().uuid().nullable().optional(),
  amount: z.number().positive(),
  currency: z.string().min(3).max(3).optional(),
  conditions: z.string().max(5000).nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  submit: z.boolean().optional(),
});

function actorFromSession(session: {
  userId: string;
  role: string;
  clientId?: string | null;
  user?: { name?: string | null };
}) {
  return {
    id: session.userId,
    name: session.user?.name ?? "User",
    role: session.role,
    clientId: session.clientId ?? null,
  };
}

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await assertRealEstateClient(params.clientId))) {
    return NextResponse.json({ error: "Not a real-estate workspace." }, { status: 404 });
  }

  const url = new URL(req.url);
  const tab = (url.searchParams.get("tab") ?? "active") as OfferListTab;
  const result = await listRealEstateOffers({
    clientId: params.clientId,
    actor: actorFromSession(session),
    tab: [
      "active",
      "submitted",
      "negotiating",
      "accepted",
      "rejected",
      "withdrawn",
      "expired",
      "closed",
      "all",
    ].includes(tab)
      ? tab
      : "active",
    listingId: url.searchParams.get("listing_id"),
    contactId: url.searchParams.get("contact_id"),
    leadId: url.searchParams.get("lead_id"),
    agentId: url.searchParams.get("agent_id"),
    q: url.searchParams.get("q"),
    minAmount: url.searchParams.get("min") ? Number(url.searchParams.get("min")) : null,
    maxAmount: url.searchParams.get("max") ? Number(url.searchParams.get("max")) : null,
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    scopeOwn: session.role === "SALESPERSON",
  });

  return NextResponse.json(result);
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await assertRealEstateClient(params.clientId))) {
    return NextResponse.json({ error: "Not a real-estate workspace." }, { status: 404 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;
  const result = await createRealEstateOffer({
    clientId: params.clientId,
    actor: actorFromSession(session),
    listingId: body.listing_id,
    contactId: body.contact_id,
    leadId: body.lead_id,
    amount: body.amount,
    currency: body.currency,
    conditions: body.conditions,
    expiryDate: body.expiry_date,
    notes: body.notes,
    submit: body.submit === true,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ offer: result.offer });
}
