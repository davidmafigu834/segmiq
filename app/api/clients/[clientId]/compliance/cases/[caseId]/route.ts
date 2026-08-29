import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import { assertRealEstateClient } from "@/lib/real-estate/offer-service";
import {
  getComplianceCaseDetail,
  loadComplianceActor,
  mutateComplianceCase,
} from "@/lib/real-estate/compliance-service";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  action: z.enum([
    "update_profile",
    "add_party",
    "remove_party",
    "submit_review",
    "start_review",
    "request_info",
    "require_edd",
    "set_risk",
    "approve",
    "restrict",
    "reject",
    "review_document",
    "reopen",
    "note",
  ]),
  entity_type: z.enum(["individual", "corporate"]).optional(),
  cdd_profile: z.record(z.unknown()).optional(),
  full_name: z.string().optional(),
  relationship_type: z.string().optional(),
  notes: z.string().optional(),
  party_id: z.string().uuid().optional(),
  reason: z.string().optional(),
  risk_level: z.enum(["unclassified", "low", "medium", "high"]).optional(),
  factors: z.unknown().optional(),
  document_id: z.string().uuid().optional(),
  decision: z.enum(["accepted", "rejected"]).optional(),
  note: z.string().optional(),
  internal: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: { clientId: string; caseId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await assertRealEstateClient(params.clientId))) {
    return NextResponse.json({ error: "Not a real-estate workspace." }, { status: 404 });
  }

  const actor = await loadComplianceActor(session);
  const result = await getComplianceCaseDetail({
    clientId: params.clientId,
    caseId: params.caseId,
    actor,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; caseId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await assertRealEstateClient(params.clientId))) {
    return NextResponse.json({ error: "Not a real-estate workspace." }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const actor = await loadComplianceActor(session);
  const result = await mutateComplianceCase({
    clientId: params.clientId,
    caseId: params.caseId,
    actor,
    action: parsed.data.action,
    payload: parsed.data as Record<string, unknown>,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ case: result.case });
}
