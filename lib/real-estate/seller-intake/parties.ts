export type AcquisitionParty = {
  role: string;
  partyKind: string;
  contactId: string | null;
  displayName: string;
};

export type ListingPartyCopy = {
  contactId: string;
  partyRole: "owner" | "authorised_representative";
  displayName: string;
};

/**
 * Listing parties require a contact. A company owner has none, so the representative
 * is copied as the authorised representative and is not labelled the owner.
 * Opportunities with no party rows keep the legacy contact-as-owner path.
 */
export function listingPartyPlan(input: {
  contactId: string | null;
  parties: readonly AcquisitionParty[];
}): ListingPartyCopy[] {
  if (input.parties.length === 0) {
    return input.contactId
      ? [{ contactId: input.contactId, partyRole: "owner", displayName: "" }]
      : [];
  }
  const companyOwner = input.parties.find((party) => party.role === "registered_owner" && party.partyKind === "company");
  const individualOwner = input.parties.find(
    (party) => party.role === "registered_owner" && party.partyKind === "individual" && party.contactId
  );
  const representatives = input.parties.filter((party) => party.role === "representative" && party.contactId);
  const copies: ListingPartyCopy[] = [];
  if (individualOwner?.contactId && !companyOwner) {
    copies.push({
      contactId: individualOwner.contactId,
      partyRole: "owner",
      displayName: individualOwner.displayName,
    });
  }
  if (companyOwner) {
    const people = representatives.length
      ? representatives
      : input.contactId
        ? [{ contactId: input.contactId, displayName: "Representative", role: "representative", partyKind: "individual" }]
        : [];
    for (const person of people) {
      if (!person.contactId) continue;
      copies.push({
        contactId: person.contactId,
        partyRole: "authorised_representative",
        displayName: person.displayName,
      });
    }
  }
  return copies;
}

export type PortfolioOpportunity = {
  id: string;
  contactId: string | null;
  ownerName: string | null;
  status: string;
};

export type PortfolioOwner = {
  contactId: string;
  name: string | null;
  kind: "individual" | "company" | "unknown";
  representatives: string[];
  properties: number;
  active: number;
  opportunityIds: string[];
  limit: string | null;
};

export function portfolioGroups(input: {
  opportunities: readonly PortfolioOpportunity[];
  parties: readonly (AcquisitionParty & { opportunityId: string })[];
}): PortfolioOwner[] {
  const partiesByOpportunity = new Map<string, AcquisitionParty[]>();
  for (const party of input.parties) {
    const list = partiesByOpportunity.get(party.opportunityId) ?? [];
    list.push(party);
    partiesByOpportunity.set(party.opportunityId, list);
  }
  const groups = new Map<string, PortfolioOwner>();
  for (const row of input.opportunities) {
    const parties = partiesByOpportunity.get(row.id) ?? [];
    const company = parties.find((party) => party.role === "registered_owner" && party.partyKind === "company");
    const representative = parties.find((party) => party.role === "representative");
    const key = company
      ? `company:${company.displayName.trim().toLowerCase()}`
      : (row.contactId ?? `unlinked:${row.id}`);
    const current = groups.get(key) ?? {
      contactId: key,
      name: company?.displayName ?? row.ownerName,
      kind: company ? "company" : row.contactId ? "individual" : "unknown",
      representatives: [],
      properties: 0,
      active: 0,
      opportunityIds: [],
      limit: company ? "Properties for the same company name are grouped. The company is not a separate contact." : null,
    };
    current.properties += 1;
    if (row.status === "active" || row.status === "nurturing") current.active += 1;
    current.opportunityIds.push(row.id);
    const representativeName = representative?.displayName;
    if (representativeName && !current.representatives.includes(representativeName)) current.representatives.push(representativeName);
    groups.set(key, current);
  }
  return [...groups.values()];
}
