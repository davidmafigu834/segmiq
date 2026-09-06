import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import {
  assertRealEstateClient,
  listRealEstateTransactions,
  startOrGetTransactionFromOffer,
  type TransactionListTab,
} from "@/lib/real-estate/transaction-service";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  offer_id: z.string().uuid(),
  compliance_case_id: z.string().uuid().nullable().optional(),
});

const TABS: TransactionListTab[] = [
  "active",
  "pending_compliance",
  "in_progress",
  "completed",
  "fallen_through",
  "cancelled",
  "all",
];

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
  const tabParam = (url.searchParams.get("tab") ?? "active") as TransactionListTab;
  const tab = TABS.includes(tabParam) ? tabParam : "active";

  const result = await listRealEstateTransactions({
    clientId: params.clientId,
    actor: actorFromSession(session),
    tab,
    q: url.searchParams.get("q"),
    agentId: url.searchParams.get("agent_id"),
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

  const result = await startOrGetTransactionFromOffer({
    clientId: params.clientId,
    offerId: parsed.data.offer_id,
    actor: actorFromSession(session),
    complianceCaseId: parsed.data.compliance_case_id,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ transaction: result.transaction, created: result.created });
}
