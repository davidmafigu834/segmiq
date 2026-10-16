/**
 * Joint-deal visibility. Organisation membership is required.
 * A salesperson sees a deal when they are the buyer agent, the listing agent
 * on the offer, or the listing's responsible agent. Commission stays separate.
 */

export function isAgencyManager(role: string | null | undefined): boolean {
  return role === "CLIENT_MANAGER" || role === "SUPER_ADMIN";
}

export function sameOrganisation(
  userClientId: string | null | undefined,
  resourceClientId: string | null | undefined
): boolean {
  return Boolean(userClientId && resourceClientId && userClientId === resourceClientId);
}

export function canParticipateInDeal(opts: {
  role: string | null | undefined;
  userId: string;
  userClientId: string | null | undefined;
  resourceClientId: string;
  buyerAgentId?: string | null;
  listingAgentId?: string | null;
  listingOwnerId?: string | null;
  participantIds?: readonly string[] | null;
}): boolean {
  if (opts.role === "SUPER_ADMIN") return true;
  if (!sameOrganisation(opts.userClientId, opts.resourceClientId)) return false;
  if (opts.role === "CLIENT_MANAGER") return true;
  if (opts.role !== "SALESPERSON") return false;
  return (
    opts.buyerAgentId === opts.userId ||
    opts.listingAgentId === opts.userId ||
    opts.listingOwnerId === opts.userId ||
    Boolean(opts.participantIds?.includes(opts.userId))
  );
}

/** Salespeople never see commission figures, including on deals they participate in. */
export function canViewDealCommission(role: string | null | undefined): boolean {
  return isAgencyManager(role);
}
