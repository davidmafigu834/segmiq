import { NextResponse } from "next/server";
import { P } from "@/lib/auth/rbac/permissions";
import { requireSocialInbox } from "@/lib/social-inbox/api-auth";
import { getSocialInboxWorkspace } from "@/lib/social-inbox/workspace";
import { SOCIAL_INBOX_VIEWS, type SocialInboxViewId } from "@/lib/social-inbox/types";

export const dynamic = "force-dynamic";

function parseView(raw: string | null): SocialInboxViewId {
  if (raw && (SOCIAL_INBOX_VIEWS as readonly string[]).includes(raw)) return raw as SocialInboxViewId;
  return "for_you";
}

export async function GET(req: Request) {
  const gate = await requireSocialInbox(req, P.SOCIAL_INBOX_VIEW);
  if (!gate.ok) return gate.response;
  const url = new URL(req.url);
  const workspace = await getSocialInboxWorkspace({
    actor: gate.actor,
    view: parseView(url.searchParams.get("view")),
    filters: {
      q: url.searchParams.get("q"),
      channel: url.searchParams.get("channel") as never,
      assignedToId: url.searchParams.get("assignedToId"),
      intentBand: url.searchParams.get("intentBand") as never,
    },
  });
  return NextResponse.json(workspace);
}
