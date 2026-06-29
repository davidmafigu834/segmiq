import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import type { UserRole } from "@/types";

export type ProposalActor = { id: string; name: string; role: UserRole };

/**
 * Agency sales proposals are Segmiq's own documents — only agency admins may
 * create, edit, or send them. (The public accept/reject path is token-gated
 * and handled separately, with no session.)
 */
export async function requireProposalAdmin(
  req?: Request
): Promise<
  | { allowed: true; actor: ProposalActor }
  | { allowed: false; reason: string; status: 401 | 403 }
> {
  const auth = req ? await getAuthFromRequest(req) : null;
  const session = auth ?? (await getServerSession(authOptions));
  if (!session?.userId) return { allowed: false, reason: "Unauthorized", status: 401 };
  if (session.role !== "AGENCY_ADMIN") return { allowed: false, reason: "Forbidden", status: 403 };

  return {
    allowed: true,
    actor: {
      id: session.userId,
      name: (session as { user?: { name?: string | null } }).user?.name ?? "Segmiq",
      role: "AGENCY_ADMIN",
    },
  };
}
