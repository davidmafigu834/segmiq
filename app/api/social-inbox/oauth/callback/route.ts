import { completeSocialInboxOAuth } from "@/lib/social-inbox/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return completeSocialInboxOAuth(req);
}
