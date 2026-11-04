import { notFound } from "next/navigation";
import { ComplianceCentre } from "@/components/real-estate/compliance/ComplianceCentre";
import { ContextCompliancePanel } from "@/components/real-estate/compliance/ContextCompliancePanel";
import { PublicSubmissionPortal } from "@/components/real-estate/compliance/PublicSubmissionPortal";
import { ReEmptyState, ReErrorState, ReSkeletonRows } from "@/components/real-estate/ui";

export const dynamic = "force-dynamic";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const queue = [
  { id: "syn-1", caseId: "syn-case-1", caseType: "buyer", requirement: "Identity document", state: "submitted", submittedAt: minutesAgo(12), nextAction: "Open the requirement and record a decision." },
  { id: "syn-2", caseId: "syn-case-2", caseType: "seller", requirement: "Proof of authority to sell", state: "more_information_required", submittedAt: minutesAgo(180), nextAction: "Waiting on the customer." },
  { id: "syn-3", caseId: "syn-case-3", caseType: "property", requirement: "Agency mandate", state: "under_review", submittedAt: minutesAgo(50), nextAction: "Finish the review." },
  { id: "syn-4", caseId: "syn-case-4", caseType: "transaction", requirement: "Agreement of sale", state: "submitted", submittedAt: minutesAgo(1440), nextAction: "Open the requirement and record a decision." },
];

const centre = {
  counts: { pendingReviews: 3, changesRequested: 1, escalated: 0 },
  queue,
  canReview: true,
  canManage: true,
  policies: [{ id: "syn-policy", template_key: "individual_purchaser", version: 1, status: "draft", enforcement: { listing_publication: false }, review_note: "Sample starting point. Not a legal determination." }],
  templates: [{ key: "individual_purchaser", label: "Individual purchaser", disclaimer: "A reviewable starting point. It is not legal advice and it is not mandatory until a reviewer activates it." }],
  events: [{ id: "syn-event", summary: "Identity document submitted for review.", at: minutesAgo(12) }],
  evidence: [
    { id: "syn-file-1", caseId: "syn-case-1", label: "Identity document", filename: "identity.pdf", uploadedAt: minutesAgo(12), version: 1, scanStatus: "unscanned", canOpen: false },
    { id: "syn-file-2", caseId: "syn-case-1", label: "Identity document", filename: "identity-clear.pdf", uploadedAt: minutesAgo(8), version: 2, scanStatus: "clean", canOpen: true },
    { id: "syn-file-3", caseId: "syn-case-3", label: "Agency mandate", filename: "mandate.pdf", uploadedAt: minutesAgo(50), version: 1, scanStatus: "infected", canOpen: false },
  ],
  requests: [{ id: "syn-request", caseType: "buyer", purpose: "submission", status: "sent", expiresAt: minutesAgo(-1440), sentAt: minutesAgo(30), submittedAt: null }],
};

const buyer = {
  notice: "Sample checklist. It does not block the sale until a reviewed policy is enforced.",
  summary: {
    caseId: "syn-buyer",
    statusLabel: "Awaiting documents",
    readiness: "action_required",
    nextAction: "Request the outstanding items.",
    missing: ["Identity document", "Proof of address", "Source of funds"],
    requirements: [
      { id: "b1", key: "legal_name", label: "Full legal name", state: "verified", mandatory: true },
      { id: "b2", key: "identity_document", label: "Identity document", state: "awaiting_information", mandatory: true },
      { id: "b3", key: "address", label: "Proof of address", state: "submitted", mandatory: true },
      { id: "b4", key: "funds", label: "Source of funds", state: "more_information_required", mandatory: false },
    ],
    invitations: [{ id: "inv", status: "sent", purpose: "submission", expires_at: minutesAgo(-1440) }],
    canInvite: true,
    canReview: true,
    reviewerName: "Rudo Ncube",
    lastReviewedAt: minutesAgo(4000),
  },
  templates: [{ key: "individual_purchaser", label: "Individual", disclaimer: "Sample.", requirements: [{ key: "legal_name", label: "Full legal name", help: "The name on the identity document." }] }],
};

const transaction = {
  notice: "Commercial progress, compliance readiness and legal transfer stay separate.",
  summary: buyer.summary,
  transaction: {
    commercialStage: "agreement_signed",
    complianceReadiness: "action_required",
    legalTransferStatus: "in_progress",
    paymentEvidenceStatus: "proof_uploaded",
    legalRoute: "title_deed",
  },
};

export default function CompliancePreviewPage({ searchParams }: { searchParams?: { screen?: string } }) {
  if (process.env.NODE_ENV === "production") notFound();
  const screen = searchParams?.screen ?? "overview";

  return (
    <main className="sales-dashboard-premium min-h-screen bg-sales-bg px-4 py-6 text-sales-text-primary sm:px-8">
      {screen === "portal" || screen === "documents" || screen === "denied" || screen === "error" || screen === "loading" ? <p className="mb-4 text-[12px] font-medium text-sales-text-muted">Development preview. Synthetic records only. Decisions are not saved.</p> : null}
      {screen === "overview" || screen === "queue" || screen === "requests" || screen === "policies" || screen === "audit" ? (
        <ComplianceCentre
          clientId="synthetic"
          manager
          synthetic={centre}
          initialSection={screen === "queue" || screen === "requests" || screen === "policies" || screen === "audit" ? screen : "overview"}
        />
      ) : null}
      {screen === "empty" ? (
        <ComplianceCentre clientId="synthetic" manager synthetic={{ counts: { pendingReviews: 0, changesRequested: 0, escalated: 0 }, queue: [], canReview: true }} />
      ) : null}
      {screen === "denied" ? <ReErrorState title="You don't have permission to review this case" description="Ask a manager if your role should include compliance." /> : null}
      {screen === "error" ? <ReErrorState title="Compliance data is unavailable" description="Your submission couldn't be completed. Please try again." /> : null}
      {screen === "loading" ? <ReSkeletonRows rows={4} label="Loading compliance" /> : null}
      {screen === "buyer" ? <ContextCompliancePanel clientId="synthetic" context="buyer" title="Buyer verification" synthetic={buyer} /> : null}
      {screen === "seller" ? <ContextCompliancePanel clientId="synthetic" context="seller" title="Seller verification" customerType="company" synthetic={buyer} /> : null}
      {screen === "property" ? <ContextCompliancePanel clientId="synthetic" context="property" title="Listing compliance" synthetic={{ ...buyer, parties: [{ contact_id: "syn", party_role: "owner" }] }} /> : null}
      {screen === "transaction" ? <ContextCompliancePanel clientId="synthetic" context="transaction" title="Transaction compliance" synthetic={transaction} /> : null}
      {screen === "portal" ? <PublicSubmissionPortal token="sample" sample="individual" /> : null}
      {screen === "documents" ? (
        <section className="max-w-xl">
          <h1 className="font-display text-[1.5rem] font-semibold">Identity document</h1>
          <p className="mt-1 text-[13px] text-sales-text-secondary">Protected files open from the case. This preview has no file and does not show a document address.</p>
          <ul className="mt-4 divide-y divide-sales-border text-[13px]">
            <li className="flex items-center justify-between gap-3 py-3">
              <span><span className="block font-medium">National identity</span><span className="text-[12px] text-sales-text-muted">PDF · selected for review · no file in this preview</span></span>
              <button type="button" className="min-h-11 font-semibold text-sales-text-muted" disabled>View unavailable</button>
            </li>
          </ul>
          <ReEmptyState compact title="No verification documents have been submitted yet" description="When a file is stored, View opens it through the existing protected link." />
        </section>
      ) : null}
    </main>
  );
}
