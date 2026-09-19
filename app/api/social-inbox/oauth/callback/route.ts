import { completeSocialInboxOAuth } from "@/lib/social-inbox/oauth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  return completeSocialInboxOAuth(req);
}
