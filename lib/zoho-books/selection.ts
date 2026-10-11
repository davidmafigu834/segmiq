import type { ZohoOrganisation } from "./protocol";

export type OrganisationSelection =
  | { ok: true; name: string; changed: boolean }
  | {
      ok: false;
      reason: "not_authorised" | "change_confirmation_required" | "claimed_by_other_company";
    };

/**
 * The requested organisation must be in the list just fetched from Zoho.
 * The first organisation is never chosen on the caller's behalf.
 */
export function decideOrganisationSelection(input: {
  requestedId: string;
  authorised: ZohoOrganisation[];
  currentId: string | null;
  confirmChange: boolean;
  claimedByOtherCompany: boolean;
}): OrganisationSelection {
  const requestedId = input.requestedId.trim();
  if (!requestedId) return { ok: false, reason: "not_authorised" };
  const match = input.authorised.find((org) => org.id === requestedId);
  if (!match) return { ok: false, reason: "not_authorised" };
  if (input.claimedByOtherCompany) return { ok: false, reason: "claimed_by_other_company" };
  const changed = Boolean(input.currentId && input.currentId !== requestedId);
  if (changed && !input.confirmChange) return { ok: false, reason: "change_confirmation_required" };
  return { ok: true, name: match.name, changed };
}
