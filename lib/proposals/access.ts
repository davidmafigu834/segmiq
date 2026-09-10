import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import type { UserRole } from "@/types";

export type ProposalActor = { id: string; name: string; role: UserRole };

/**
 * Agency sales proposals are Segmiq's own documents — only super admins may
 * create, edit, or send them. (The public accept/reject path is token-gated
 * and handled separately, with no session.)
 */
export async function requireProposalAdmin(
  req?: Request
): Promise<
  | { allowed: true; actor: ProposalActor }
  | { allowed: false; reason: string; status: 401 | 403 }
> {
  // Never fall through to getServerSession after MFA/auth denial.
  const session = await getAuthFromRequest(req);
  if (!session?.userId) return { allowed: false, reason: "Unauthorized", status: 401 };
  if (session.role !== "SUPER_ADMIN") return { allowed: false, reason: "Forbidden", status: 403 };

  return {
    allowed: true,
    actor: {
      id: session.userId,
      name: "Segmiq",
      role: "SUPER_ADMIN",
    },
  };
}
