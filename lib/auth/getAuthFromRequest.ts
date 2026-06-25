import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveApiAuth, type ApiAuth } from "@/lib/auth/resolveApiAuth";

/** Cookie session first (web), then Bearer JWT (mobile apps). */
export async function getAuthFromRequest(req?: Request): Promise<ApiAuth | null> {
  if (req) {
    const fromReq = await resolveApiAuth(req);
    if (fromReq) return fromReq;
  }
  const session = await getServerSession(authOptions);
  if (!session?.userId) return null;
  return {
    userId: session.userId,
    role: session.role,
    clientId: session.clientId ?? null,
  };
}
