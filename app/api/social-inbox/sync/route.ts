import { NextResponse } from "next/server";
import { P } from "@/lib/auth/rbac/permissions";
import { requireSocialInbox } from "@/lib/social-inbox/api-auth";
import { syncSocialInbox } from "@/lib/social-inbox/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const gate = await requireSocialInbox(req, P.SOCIAL_INBOX_VIEW);
  if (!gate.ok) return gate.response;
  const result = await syncSocialInbox(gate.actor.clientId);
  return NextResponse.json({ ok: true, ...result });
}
