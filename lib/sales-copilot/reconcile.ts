import { payloadHash } from "./hash";
import type { ExistingWorkItem, ProposalDraft, WorkItemUpsert } from "./types";

function choiceStillValid(item: ExistingWorkItem, proposal: ProposalDraft): boolean {
  if (!item.salespersonChoice) return false;
  const options = Array.isArray(proposal.payload.options)
    ? (proposal.payload.options as Array<{ id?: string }>)
    : null;
  if (!options || !item.chosenId) return true;
  return options.some((option) => option.id === item.chosenId);
}

export function reconcileProposals(input: {
  proposals: ProposalDraft[];
  existing: ExistingWorkItem[];
  fulfilledKeys: string[];
  contextRevision: string;
  loadedMessageIds: string[];
}): { upserts: WorkItemUpsert[]; staleIds: string[]; obsoleteIds: string[] } {
  const upserts: WorkItemUpsert[] = [];
  const staleIds: string[] = [];
  const obsoleteIds: string[] = [];
  const proposedKeys = new Set(input.proposals.map((proposal) => proposal.semanticKey));

  for (const proposal of input.proposals) {
    const hash = payloadHash({
      actionType: proposal.actionType,
      proposedAt: proposal.proposedAt,
      payload: proposal.payload,
      missing: proposal.missing,
    });
    const related = input.existing.filter(
      (item) => item.semanticKey === proposal.semanticKey && item.fulfilmentStatus === "open"
    );
    const held = related.find(
      (item) => item.salespersonChoice && item.reviewStatus !== "dismissed" && item.reviewStatus !== "stale"
    );
    if (held && choiceStillValid(held, proposal)) continue;
    const dismissed = related.find((item) => item.reviewStatus === "dismissed" && item.payloadHash === hash);
    if (dismissed) continue;
    const pending = related.find((item) => item.reviewStatus === "pending" || item.reviewStatus === "snoozed");
    if (pending?.salespersonChoice && !choiceStillValid(pending, proposal)) {
      staleIds.push(pending.id);
    } else if (pending) {
      upserts.push({ ...proposal, id: pending.id, payloadHash: hash, contextRevision: input.contextRevision });
      continue;
    }
    const approved = related.find((item) => item.reviewStatus === "approved");
    if (approved && approved.payloadHash === hash && approved.executionStatus === "failed") continue;
    if (approved && approved.payloadHash === hash && approved.executionStatus === "succeeded") continue;
    if (approved && approved.payloadHash !== hash && approved.executionStatus !== "succeeded") {
      staleIds.push(approved.id);
    }
    upserts.push({ ...proposal, payloadHash: hash, contextRevision: input.contextRevision });
  }

  for (const item of input.existing) {
    if (item.fulfilmentStatus !== "open") continue;
    if (item.reviewStatus === "dismissed") continue;
    const fulfilled =
      input.fulfilledKeys.includes(item.semanticKey) ||
      (item.semanticKey.startsWith("contact_later") && input.fulfilledKeys.includes("contact_later")) ||
      (item.semanticKey.startsWith("customer_checkin") && input.fulfilledKeys.includes("customer_checkin"));
    if (fulfilled) {
      obsoleteIds.push(item.id);
      continue;
    }
    if (item.salespersonChoice && item.reviewStatus !== "stale") continue;
    if (
      !proposedKeys.has(item.semanticKey) &&
      (item.reviewStatus === "pending" || item.reviewStatus === "snoozed") &&
      item.executionStatus === "none"
    ) {
      const loaded = new Set(input.loadedMessageIds);
      const evidenceLoaded =
        item.evidenceMessageIds.length === 0 ||
        item.evidenceMessageIds.some((id) => loaded.has(id));
      if (evidenceLoaded) obsoleteIds.push(item.id);
    }
  }

  return { upserts, staleIds, obsoleteIds };
}
