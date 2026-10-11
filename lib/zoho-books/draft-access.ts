import "server-only";
import { NextResponse } from "next/server";
import { lookupDemoQuote } from "@/lib/demo/acl";
import { canManageQuotation } from "@/lib/quotations/quote-access";
import type { DraftKind } from "./drafts";

export async function requireDraftActor(req: Request, quotationId: string) {
  const access = await canManageQuotation(quotationId, req);
  if (!access.allowed) {
    return { response: NextResponse.json({ error: access.reason }, { status: access.status }) };
  }
  const demo = await lookupDemoQuote(access.clientId, quotationId);
  if (demo.mode === "demo") {
    return { response: NextResponse.json({ error: "Demo quotations cannot create Books drafts." }, { status: 403 }) };
  }
  return { clientId: access.clientId, userId: access.actor.id };
}

export function draftKind(value: unknown): DraftKind | null {
  return value === "estimate" || value === "invoice" ? value : null;
}
