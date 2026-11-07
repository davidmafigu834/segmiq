import assert from "node:assert/strict";
import test from "node:test";
import { PDFParse } from "pdf-parse";
import { createFakePostgrest, type FakePostgrest, type Row } from "./helpers/fake-postgrest";
import { canReviewMandate } from "../lib/real-estate/acquisition-plan";
import { sellerIntakeEnabled } from "../lib/real-estate/seller-intake/flag";
import {
  answersFromClient,
  categoryMapping,
  exclusivityNote,
  fieldsForKind,
  mandateDates,
  mergeCorrection,
  rightsMapping,
  submissionGaps,
} from "../lib/real-estate/seller-intake/fields";
import {
  canReadSavedAnswers,
  canReviewIntake,
  canSeeRestrictedIntake,
  intakeReviewGrantsMandateApproval,
  linkAccess,
  parseSellerSessionCookie,
  publicFormProjection,
  sellerSessionCookieValue,
} from "../lib/real-estate/seller-intake/access";
import { countsAsSignatureEvidence, intakeCommercialPlan, partyDrafts, recordDifferences, signedUploadState } from "../lib/real-estate/seller-intake/review-plan";
import { renderMandatePdf } from "../lib/real-estate/seller-intake/pdf";
import { listingPartyPlan, portfolioGroups } from "../lib/real-estate/seller-intake/parties";
import { sellerScanTransition } from "../lib/real-estate/seller-intake/scan";
import type { IntakeSnapshot } from "../lib/real-estate/seller-intake/review-plan";

const SUPABASE_URL = "https://seller-intake.test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
process.env.NEXTAUTH_SECRET = "test-nextauth-secret-not-real-0123456789";
process.env.RE_SELLER_INTAKE = "on";

let activeDb: FakePostgrest | null = null;
const originalFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (activeDb && url.host === new URL(SUPABASE_URL).host) return activeDb.fetch(input, init);
  return originalFetch(input, init);
}) as typeof fetch;

const ORG = "org-a";
const agent = { id: "agent-a", name: "Ada Agent", role: "SALESPERSON", clientId: ORG };
const otherAgent = { id: "agent-b", name: "Ben Agent", role: "SALESPERSON", clientId: ORG };
const manager = { id: "manager-a", name: "Mia Manager", role: "CLIENT_MANAGER", clientId: ORG };
const outsider = { id: "agent-c", name: "Out Agent", role: "SALESPERSON", clientId: "org-b" };

function seed(): Record<string, Row[]> {
  return {
    clients: [
      { id: ORG, business_type: "real_estate" },
      { id: "org-b", business_type: "real_estate" },
    ],
    contacts: [{ id: "contact-moyo", client_id: ORG, name: "Rudo Moyo", phone: "+263771111111", email: "rudo@example.test" }],
    leads: [{ id: "lead-1", client_id: ORG }],
    listings: [],
    real_estate_acquisition_opportunities: [],
    real_estate_acquisition_events: [],
    real_estate_contact_roles: [],
    real_estate_mandates: [],
    real_estate_mandate_events: [],
    real_estate_price_discussions: [],
    compliance_cases: [],
    compliance_related_parties: [],
    re_acquisition_parties: [],
    re_seller_intake_templates: [],
    re_seller_intake_requests: [],
    re_seller_intake_submissions: [],
    re_seller_intake_events: [],
    re_seller_intake_reviews: [],
    re_seller_intake_documents: [],
    activity_subjects: [],
    security_rate_limits: [],
  };
}

async function service() {
  return import("../lib/real-estate/seller-intake/service");
}

function useDb() {
  activeDb = createFakePostgrest(SUPABASE_URL, seed());
  return activeDb;
}

const openAnswers = {
  propertyAddress: "12 Cork Road, Avondale, Harare",
  registeredOwner: "Rudo Moyo",
  propertyCategory: "Land",
  propertyRights: "Share Transfer",
  mandatePrice: "120000",
  askingPrice: "125000",
  cell: "0771111111",
  identityNumber: "63-111111-A-00",
  sourceOfFunds: "Salary",
  pep: "No",
  clientId: ORG,
  contactId: "someone-else",
};

test("seller intake stays off unless the flag is explicitly on", () => {
  assert.equal(sellerIntakeEnabled({}), false);
  assert.equal(sellerIntakeEnabled({ RE_SELLER_INTAKE: "off" }), false);
  assert.equal(sellerIntakeEnabled({ RE_SELLER_INTAKE: "on" }), true);
});

test("open and sole forms do not collect the same fields or invent dates", () => {
  const open = fieldsForKind("open").map((field) => field.key);
  const sole = fieldsForKind("sole").map((field) => field.key);
  const title = fieldsForKind("open").find((field) => field.key === "sellerTitle");
  const marital = fieldsForKind("open").find((field) => field.key === "maritalStatus");
  const industry = fieldsForKind("open").find((field) => field.key === "industry");
  assert.deepEqual(title?.options, ["Mr", "Mrs", "Ms"]);
  assert.deepEqual(marital?.options, ["Single", "Married", "Divorced", "Widowed"]);
  assert.equal(industry?.options?.includes("Other"), true);
  assert.equal(open.includes("industryOther"), true);
  assert.equal(open.includes("mandatePrice"), true);
  assert.equal(open.includes("propertyCategory"), true);
  assert.equal(sole.includes("mandatePrice"), false);
  assert.equal(sole.includes("propertyCategory"), false);
  assert.equal(sole.includes("identityNumber"), false);
  assert.deepEqual(mandateDates("sole", { mandateEndDate: "2026-12-01" }), { startDate: null, expiryDate: null });
  assert.deepEqual(mandateDates("open", { mandateStartDate: "2026-11-01", mandateEndDate: "2027-11-01" }), {
    startDate: "2026-11-01",
    expiryDate: "2027-11-01",
  });
  assert.equal(exclusivityNote({ kind: "sole", minimumMonths: null, continuesUntilVaried: false })?.includes("No expiry date"), true);
  assert.equal(categoryMapping("Land").platform, null);
  assert.match(categoryMapping("Land").ambiguous ?? "", /residential stand/);
  assert.equal(categoryMapping("Cluster/Townhouse").platform, null);
  assert.equal(rightsMapping("Share Transfer").legalRoute, null);
  assert.equal(rightsMapping("Cession").legalRoute, "cession");
  const cleaned = answersFromClient("open", openAnswers);
  assert.equal(cleaned.contactId, undefined);
  assert.equal(cleaned.clientId, undefined);
  assert.equal(submissionGaps("open", cleaned).length, 0);
  assert.equal(submissionGaps("sole", { propertyAddress: "1 Main" }).includes("Registered owner"), true);
});

test("a new link does not reveal saved answers and intake review is not mandate approval", () => {
  assert.equal(canReadSavedAnswers({ purpose: "initial", sessionMatches: false }), false);
  assert.equal(canReadSavedAnswers({ purpose: "initial", sessionMatches: true }), true);
  assert.equal(canReadSavedAnswers({ purpose: "resume", sessionMatches: false }), true);
  assert.equal(canReadSavedAnswers({ purpose: "correction", sessionMatches: false }), true);
  assert.equal(linkAccess({ status: "in_progress", expiresAt: "2020-01-01T00:00:00Z", revokedAt: null, now: new Date("2026-11-05T00:00:00Z") }).ok, false);
  assert.equal(linkAccess({ status: "revoked", expiresAt: "2027-01-01T00:00:00Z", revokedAt: "2026-11-01T00:00:00Z", now: new Date("2026-11-05T00:00:00Z") }).ok, false);
  assert.equal(intakeReviewGrantsMandateApproval(), false);
  assert.equal(canReviewMandate({ role: "SALESPERSON", userId: agent.id, userClientId: ORG, resourceClientId: ORG }), false);
  assert.equal(canReviewIntake({ role: "SALESPERSON", userId: agent.id, userClientId: ORG, resourceClientId: ORG, responsibleAgentId: agent.id }), true);
  assert.equal(canReviewIntake({ role: "SALESPERSON", userId: otherAgent.id, userClientId: ORG, resourceClientId: ORG, responsibleAgentId: agent.id }), false);
  assert.equal(canReviewIntake({ role: "SALESPERSON", userId: agent.id, userClientId: "org-b", resourceClientId: ORG, responsibleAgentId: agent.id }), false);
  assert.equal(canSeeRestrictedIntake({ role: "SALESPERSON", userClientId: ORG, resourceClientId: ORG }), false);
  assert.equal(canSeeRestrictedIntake({ role: "CLIENT_MANAGER", userClientId: ORG, resourceClientId: ORG }), true);
  const merged = mergeCorrection({ propertyAddress: "Old road", cell: "077" }, { propertyAddress: "New road", cell: "078" }, ["parties"]);
  assert.equal(merged.cell, "077");
  assert.equal(merged.propertyAddress, "New road");
  const shown = publicFormProjection({
    kind: "open",
    purpose: "initial",
    answers: { identityNumber: "secret" },
    acceptedGroups: [],
    rejected: [],
    canRead: false,
    templateTitle: "Open",
    clauses: [],
    exclusivityNote: null,
  });
  assert.equal(shown.fields.find((field) => field.key === "identityNumber")?.value, "");
  assert.equal(shown.draftExists, true);
});

test("company owner stays distinct and prices are not collapsed", () => {
  const answers = { ownerKind: "Company", companyName: "Moyo Holdings", representativeName: "Tariro Ncube", registeredOwner: "Moyo Holdings", askingPrice: "90000", mandatePrice: "80000" };
  const parties = partyDrafts({ answers, personContactId: "person-1", negotiatorName: "Ada Agent" });
  const owner = parties.find((party) => party.role === "registered_owner");
  const representative = parties.find((party) => party.role === "representative");
  assert.equal(owner?.partyKind, "company");
  assert.equal(owner?.contactId, null);
  assert.equal(representative?.displayName, "Tariro Ncube");
  assert.equal(representative?.contactId, "person-1");
  const plan = intakeCommercialPlan({
    templateId: "t1",
    templateVersion: 1,
    kind: "open",
    title: "Open",
    clauses: [],
    exclusivityMinimumMonths: null,
    exclusivityContinuesUntilVaried: false,
    answers,
    submittedAt: "2026-11-05T08:00:00.000Z",
  });
  assert.equal(plan.mandatePrice, 80000);
  assert.equal(plan.askingPrice, 90000);
  assert.equal(plan.signatureDate, null);
  assert.equal(plan.createsListing, false);
  assert.equal(plan.mandateStatus, "submitted");
  assert.equal(plan.evidenceStatus, "not_provided");
  assert.equal(plan.complianceStatus, "awaiting_documents");
  assert.deepEqual(recordDifferences({ name: "Old" }, { name: "New" }), [{ field: "name", from: "Old", to: "New" }]);
  assert.equal(countsAsSignatureEvidence({ signatureState: "prepared_unsigned", scanStatus: "clean" }), false);
  assert.equal(countsAsSignatureEvidence(signedUploadState()), false);
});

test("prepared mandate PDF keeps long answers, wraps pages, and does not invent a signature", async () => {
  const longName = "Tatenda ".repeat(30).trim();
  const clause = "Template clause supplied by the organisation. ".repeat(120);
  const snapshot: IntakeSnapshot = {
    templateId: "t1",
    templateVersion: 2,
    kind: "sole",
    title: "Organisation sole mandate",
    clauses: [clause],
    exclusivityMinimumMonths: 2,
    exclusivityContinuesUntilVaried: true,
    answers: { registeredOwner: longName, propertyAddress: "Stand 4, Borrowdale", askingPrice: "500000" },
    submittedAt: "2026-11-05T08:00:00.000Z",
  };
  const first = renderMandatePdf(snapshot);
  const second = renderMandatePdf(snapshot);
  assert.equal(first.sha256, second.sha256);
  assert.ok(first.pageCount > 1);
  const text = Buffer.from(first.bytes).toString("latin1");
  assert.ok(text.includes(longName.slice(0, 40)));
  assert.ok(text.includes(longName.slice(-40)));
  assert.ok(text.includes("Signature date: not recorded"));
  assert.equal(text.includes("15%"), false);
  const parsed = await new PDFParse({ data: first.bytes }).getText();
  const flat = parsed.text.replace(/\s+/g, "");
  assert.ok(parsed.total > 1);
  assert.ok(flat.includes(longName.replace(/\s+/g, "")));
  assert.ok(parsed.text.includes("not recorded"));
  const changed = renderMandatePdf({ ...snapshot, answers: { ...snapshot.answers, askingPrice: "1" } });
  assert.notEqual(changed.sha256, first.sha256);
});

test("disabled routes stay hidden and a cross-organisation actor cannot create a form", async () => {
  process.env.RE_SELLER_INTAKE = "off";
  const { GET } = await import("../app/api/clients/[clientId]/seller-intakes/route");
  const hidden = await GET(new Request("http://localhost/api"), { params: { clientId: ORG } });
  assert.ok(hidden);
  assert.equal(hidden.status, 404);
  process.env.RE_SELLER_INTAKE = "on";
  const db = useDb();
  const api = await service();
  const denied = await api.createSellerIntake({ clientId: ORG, actor: outsider, templateId: "00000000-0000-4000-8000-000000000001" });
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.status, 403);
  assert.equal(db.tables.re_seller_intake_requests.length, 0);
});

test("agent to client to review creates one owner opportunity and an unsigned mandate", async () => {
  const db = useDb();
  const api = await service();
  const template = await api.createIntakeTemplate({
    clientId: ORG,
    actor: manager,
    kind: "open",
    title: "Open mandate",
    clauses: ["Organisation clause for this version."],
  });
  assert.equal(template.ok, true);
  if (!template.ok) return;
  const salespersonTemplate = await api.createIntakeTemplate({ clientId: ORG, actor: agent, kind: "open", title: "Nope", clauses: [] });
  assert.equal(salespersonTemplate.ok, false);
  const created = await api.createSellerIntake({
    clientId: ORG,
    actor: agent,
    templateId: template.template.id as string,
    leadId: "lead-1",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const otherOrg = await api.listSellerIntakes({ clientId: ORG, actor: outsider });
  assert.equal(otherOrg.ok, false);
  const blank = await api.publicSellerIntake({ token: created.token, sessionToken: null });
  assert.equal(blank.ok, true);
  if (!blank.ok) return;
  assert.equal(JSON.stringify(blank.form).includes("63-111111"), false);
  assert.equal(JSON.stringify(blank.form).includes("+263771111111"), false);
  const saved = await api.savePublicSellerIntake({ token: created.token, sessionToken: null, answers: openAnswers, version: blank.version || null, submit: false });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  const otherBrowser = await api.publicSellerIntake({ token: created.token, sessionToken: null });
  assert.equal(otherBrowser.ok, true);
  if (!otherBrowser.ok) return;
  assert.equal(otherBrowser.form.fields.find((field) => field.key === "identityNumber")?.value, "");
  assert.equal(otherBrowser.form.draftExists, true);
  const resumed = await api.publicSellerIntake({ token: created.token, sessionToken: saved.sessionToken });
  assert.equal(resumed.ok, true);
  if (!resumed.ok) return;
  assert.equal(resumed.form.fields.find((field) => field.key === "identityNumber")?.value, "63-111111-A-00");
  const blocked = await api.acceptIntakeReview({ clientId: ORG, requestId: created.request.id as string, actor: agent, submissionVersion: saved.version, store: memoryStore() });
  assert.equal(blocked.ok, false);
  const submitted = await api.savePublicSellerIntake({
    token: created.token,
    sessionToken: saved.sessionToken,
    answers: openAnswers,
    version: saved.version,
    submit: true,
  });
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  const again = await api.savePublicSellerIntake({ token: created.token, sessionToken: saved.sessionToken, answers: openAnswers, version: submitted.version, submit: true });
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.equal(again.idempotent, true);
  assert.equal(db.tables.re_seller_intake_submissions.length, 1);
  const stale = await api.savePublicSellerIntake({ token: created.token, sessionToken: saved.sessionToken, answers: { cell: "078" }, version: 1, submit: false });
  assert.equal(stale.ok, true);
  const duplicate = await api.acceptIntakeReview({ clientId: ORG, requestId: created.request.id as string, actor: agent, submissionVersion: submitted.version, store: memoryStore() });
  assert.equal(duplicate.ok, false);
  if (duplicate.ok) return;
  assert.equal(duplicate.status, 409);
  assert.equal("duplicates" in duplicate, true);
  const accepted = await api.acceptIntakeReview({
    clientId: ORG,
    requestId: created.request.id as string,
    actor: agent,
    submissionVersion: submitted.version,
    linkContactId: "contact-moyo",
    confirmChanges: true,
    store: memoryStore(),
  });
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  assert.equal(db.tables.contacts.length, 1);
  assert.equal(db.tables.real_estate_acquisition_opportunities.length, 1);
  assert.equal(db.tables.listings.length, 0);
  const mandate = db.tables.real_estate_mandates[0];
  assert.equal(mandate.status, "submitted");
  assert.equal(mandate.evidence_status, "not_provided");
  assert.equal(mandate.document_id ?? null, null);
  assert.equal(db.tables.re_seller_intake_documents[0].scan_status, "unscanned");
  assert.equal(db.tables.re_seller_intake_documents[0].signature_state, "prepared_unsigned");
  assert.equal(db.tables.real_estate_price_discussions.some((row) => row.price_type === "agreed_marketing"), false);
  assert.equal(db.tables.real_estate_price_discussions.some((row) => row.price_type === "owner_asking"), true);
  const compliance = db.tables.compliance_cases[0];
  assert.equal(compliance.status, "awaiting_documents");
  assert.equal(compliance.approved_at ?? null, null);
  const role = db.tables.real_estate_contact_roles[0];
  assert.equal(role.verification_status, "unverified");
  const repeated = await api.acceptIntakeReview({ clientId: ORG, requestId: created.request.id as string, actor: agent, submissionVersion: submitted.version, store: memoryStore() });
  assert.equal(repeated.ok, true);
  if (!repeated.ok) return;
  assert.equal(repeated.idempotent, true);
  assert.equal(db.tables.real_estate_mandates.length, 1);
  const originalHash = db.tables.re_seller_intake_documents[0].content_sha256;
  db.tables.re_seller_intake_submissions[0].answers = { ...openAnswers, registeredOwner: "Changed later" };
  const afterEdit = await api.acceptIntakeReview({ clientId: ORG, requestId: created.request.id as string, actor: agent, submissionVersion: submitted.version, store: memoryStore() });
  assert.equal(afterEdit.ok, true);
  assert.equal(db.tables.re_seller_intake_documents[0].content_sha256, originalHash);
  const download = await api.openIntakeDocument({
    clientId: ORG,
    actor: agent,
    requestId: created.request.id as string,
    documentId: db.tables.re_seller_intake_documents[0].id as string,
  });
  assert.equal(download.ok, false);
  if (!download.ok) assert.equal(download.status, 403);
  db.tables.re_seller_intake_documents[0].scan_status = "clean";
  const cleanSales = await api.openIntakeDocument({
    clientId: ORG,
    actor: agent,
    requestId: created.request.id as string,
    documentId: db.tables.re_seller_intake_documents[0].id as string,
  });
  assert.equal(cleanSales.ok, false);
  if (!cleanSales.ok) assert.equal(cleanSales.status, 403);
  const cleanManager = await api.openIntakeDocument({
    clientId: ORG,
    actor: manager,
    requestId: created.request.id as string,
    documentId: db.tables.re_seller_intake_documents[0].id as string,
  });
  assert.equal(cleanManager.ok, false);
  if (!cleanManager.ok) assert.equal(cleanManager.status, 503);
  const signed = await api.attachSignedIntakeDocument({
    clientId: ORG,
    requestId: created.request.id as string,
    actor: agent,
    filename: "signed.pdf",
    bytes: Buffer.from("%PDF-signed"),
    store: memoryStore(),
  });
  assert.equal(signed.ok, true);
  if (!signed.ok) return;
  assert.equal(signed.countsAsSignature, false);
  assert.equal(db.tables.real_estate_mandates[0].evidence_status, "not_provided");
  const review = await api.getSellerIntake({ clientId: ORG, requestId: created.request.id as string, actor: agent });
  assert.equal(review.ok, true);
  if (!review.ok) return;
  assert.equal(review.mandateApprovalGranted, false);
  assert.equal(review.fields.find((field) => field.key === "identityNumber")?.value, "Submitted for a permitted reviewer");
  const managerReview = await api.getSellerIntake({ clientId: ORG, requestId: created.request.id as string, actor: manager });
  assert.equal(managerReview.ok, true);
  if (!managerReview.ok) return;
  assert.equal(managerReview.fields.find((field) => field.key === "identityNumber")?.value, "63-111111-A-00");
  const stranger = await api.getSellerIntake({ clientId: ORG, requestId: created.request.id as string, actor: otherAgent });
  assert.equal(stranger.ok, false);
});

test("corrections keep accepted answers and a replaced link revokes the old session", async () => {
  const db = useDb();
  const api = await service();
  const template = await api.createIntakeTemplate({ clientId: ORG, actor: manager, kind: "sole", title: "Sole mandate", clauses: ["Sole clause."], exclusivityMinimumMonths: 2, exclusivityContinuesUntilVaried: true });
  assert.equal(template.ok, true);
  if (!template.ok) return;
  const created = await api.createSellerIntake({ clientId: ORG, actor: agent, templateId: template.template.id as string, contactId: "contact-moyo" });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const first = await api.savePublicSellerIntake({
    token: created.token,
    sessionToken: null,
    answers: { propertyAddress: "1 First Street", registeredOwner: "Rudo Moyo", askingPrice: "300000", cell: "0771111111" },
    version: null,
    submit: true,
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const corrections = await api.requestIntakeCorrections({
    clientId: ORG,
    requestId: created.request.id as string,
    actor: agent,
    groups: ["property"],
    instruction: "Please correct the property address.",
  });
  assert.equal(corrections.ok, true);
  if (!corrections.ok) return;
  const oldLink = await api.publicSellerIntake({ token: created.token, sessionToken: first.sessionToken });
  assert.equal(oldLink.ok, false);
  const corrected = await api.publicSellerIntake({ token: corrections.token, sessionToken: null });
  assert.equal(corrected.ok, true);
  if (!corrected.ok) return;
  assert.equal(corrected.form.fields.find((field) => field.key === "propertyAddress")?.value, "");
  assert.equal(corrected.form.fields.find((field) => field.key === "registeredOwner")?.value, "Rudo Moyo");
  const saved = await api.savePublicSellerIntake({
    token: corrections.token,
    sessionToken: null,
    answers: { propertyAddress: "9 Second Street", registeredOwner: "Someone else", askingPrice: "1", cell: "000" },
    version: corrected.version,
    submit: true,
  });
  assert.equal(saved.ok, true);
  const previous = db.tables.re_seller_intake_submissions.find((row) => row.version === 1);
  assert.equal((previous?.answers as { propertyAddress: string }).propertyAddress, "1 First Street");
  const latest = db.tables.re_seller_intake_submissions.find((row) => row.version === corrected.version + 1 || row.version === 2);
  const latestAnswers = (latest?.answers ?? {}) as { registeredOwner?: string; propertyAddress?: string };
  assert.equal(latestAnswers.registeredOwner, "Rudo Moyo");
  assert.equal(latestAnswers.propertyAddress, "9 Second Street");
  const request = db.tables.re_seller_intake_requests[0];
  request.token_expires_at = "2020-01-01T00:00:00.000Z";
  const expired = await api.publicSellerIntake({ token: corrections.token, sessionToken: null });
  assert.equal(expired.ok, false);
});

test("a failed document store can be retried without a second opportunity", async () => {
  const db = useDb();
  const api = await service();
  const template = await api.createIntakeTemplate({ clientId: ORG, actor: manager, kind: "sole", title: "Sole", clauses: ["Clause"] });
  assert.equal(template.ok, true);
  if (!template.ok) return;
  const created = await api.createSellerIntake({ clientId: ORG, actor: agent, templateId: template.template.id as string });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const submitted = await api.savePublicSellerIntake({
    token: created.token,
    sessionToken: null,
    answers: { propertyAddress: "4 Third Road", registeredOwner: "New Seller", askingPrice: "1000", cell: "0772222222" },
    version: null,
    submit: true,
  });
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  const failing = { put: async () => { throw new Error("PRIVATE_STORAGE_UNAVAILABLE"); } };
  const failed = await api.acceptIntakeReview({
    clientId: ORG,
    requestId: created.request.id as string,
    actor: agent,
    submissionVersion: submitted.version,
    confirmNewContact: true,
    store: failing,
  });
  assert.equal(failed.ok, false);
  assert.equal(db.tables.re_seller_intake_requests[0].status, "review_incomplete");
  assert.equal(db.tables.re_seller_intake_documents.length, 0);
  const retried = await api.acceptIntakeReview({
    clientId: ORG,
    requestId: created.request.id as string,
    actor: agent,
    submissionVersion: submitted.version,
    confirmNewContact: true,
    store: memoryStore(),
  });
  assert.equal(retried.ok, true);
  if (!retried.ok) return;
  assert.equal(db.tables.real_estate_acquisition_opportunities.length, 1);
  assert.equal(db.tables.contacts.filter((row) => row.name === "New Seller").length, 1);
  assert.equal(db.tables.real_estate_mandates.length, 1);
  assert.equal(db.tables.real_estate_mandates[0].expiry_date ?? null, null);
  assert.equal(db.tables.listings.length, 0);
});

test("one owner can have a second property without a second person", async () => {
  const db = useDb();
  const api = await service();
  const template = await api.createIntakeTemplate({ clientId: ORG, actor: manager, kind: "open", title: "Open", clauses: ["Clause"] });
  assert.equal(template.ok, true);
  if (!template.ok) return;
  for (const address of ["Plot A", "Plot B"]) {
    const created = await api.createSellerIntake({ clientId: ORG, actor: agent, templateId: template.template.id as string, contactId: "contact-moyo" });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const submitted = await api.savePublicSellerIntake({
      token: created.token,
      sessionToken: null,
      answers: { ...openAnswers, propertyAddress: address, registeredOwner: "Rudo Moyo" },
      version: null,
      submit: true,
    });
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;
    const accepted = await api.acceptIntakeReview({
      clientId: ORG,
      requestId: created.request.id as string,
      actor: agent,
      submissionVersion: submitted.version,
      linkContactId: "contact-moyo",
      confirmChanges: true,
      store: memoryStore(),
    });
    assert.equal(accepted.ok, true, JSON.stringify(accepted));
  }
  assert.equal(db.tables.contacts.length, 1);
  assert.equal(db.tables.real_estate_acquisition_opportunities.length, 2);
  assert.equal(db.tables.listings.length, 0);
});

test("concurrent reviews do not create two mandates", async () => {
  const db = useDb();
  const api = await service();
  const template = await api.createIntakeTemplate({ clientId: ORG, actor: manager, kind: "open", title: "Open", clauses: ["Clause"] });
  assert.equal(template.ok, true);
  if (!template.ok) return;
  const created = await api.createSellerIntake({ clientId: ORG, actor: agent, templateId: template.template.id as string });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const submitted = await api.savePublicSellerIntake({
    token: created.token,
    sessionToken: null,
    answers: { ...openAnswers, cell: "0773333333", registeredOwner: "Concurrent Seller" },
    version: null,
    submit: true,
  });
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  const store = memoryStore();
  const [first, second] = await Promise.all([
    api.acceptIntakeReview({ clientId: ORG, requestId: created.request.id as string, actor: agent, submissionVersion: submitted.version, confirmNewContact: true, store }),
    api.acceptIntakeReview({ clientId: ORG, requestId: created.request.id as string, actor: manager, submissionVersion: submitted.version, confirmNewContact: true, store }),
  ]);
  assert.equal(first.ok || second.ok, true);
  assert.equal(db.tables.real_estate_mandates.length, 1);
  assert.equal(db.tables.real_estate_acquisition_opportunities.length, 1);
  assert.equal(db.tables.listings.length, 0);
});

test("a company representative is not stored as the registered owner", async () => {
  const db = useDb();
  const api = await service();
  const template = await api.createIntakeTemplate({ clientId: ORG, actor: manager, kind: "open", title: "Open company", clauses: ["Clause"] });
  assert.equal(template.ok, true);
  if (!template.ok) return;
  const created = await api.createSellerIntake({ clientId: ORG, actor: agent, templateId: template.template.id as string });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const submitted = await api.savePublicSellerIntake({
    token: created.token,
    sessionToken: null,
    answers: {
      propertyAddress: "Company yard",
      registeredOwner: "Moyo Holdings",
      ownerKind: "Company",
      companyName: "Moyo Holdings",
      representativeName: "Tariro Ncube",
      representativePhone: "0774444444",
      mandatePrice: "100",
      askingPrice: "150",
      cell: "0774444444",
    },
    version: null,
    submit: true,
  });
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  const accepted = await api.acceptIntakeReview({
    clientId: ORG,
    requestId: created.request.id as string,
    actor: agent,
    submissionVersion: submitted.version,
    confirmNewContact: true,
    store: memoryStore(),
  });
  assert.equal(accepted.ok, true, JSON.stringify(accepted));
  const owner = db.tables.re_acquisition_parties.find((row) => row.role === "registered_owner");
  const representative = db.tables.re_acquisition_parties.find((row) => row.role === "representative");
  assert.equal(owner?.party_kind, "company");
  assert.equal(owner?.contact_id ?? null, null);
  assert.equal(owner?.display_name, "Moyo Holdings");
  assert.equal(representative?.display_name, "Tariro Ncube");
  assert.equal(db.tables.real_estate_acquisition_opportunities[0].owner_name, "Moyo Holdings");
  assert.notEqual(db.tables.contacts.find((row) => row.id === representative?.contact_id)?.name, "Moyo Holdings");
  assert.equal(db.tables.listings.length, 0);
});

test("a later template version does not rewrite an earlier prepared document", async () => {
  const db = useDb();
  const api = await service();
  const firstTemplate = await api.createIntakeTemplate({
    clientId: ORG,
    actor: manager,
    kind: "sole",
    title: "Synthetic sole mandate",
    organisationName: "Synthetic Agency",
    clauses: ["First organisation clause"],
    exclusivityMinimumMonths: 2,
    exclusivityContinuesUntilVaried: true,
  });
  assert.equal(firstTemplate.ok, true);
  if (!firstTemplate.ok) return;
  const created = await api.createSellerIntake({ clientId: ORG, actor: agent, templateId: firstTemplate.template.id as string });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const submitted = await api.savePublicSellerIntake({
    token: created.token,
    sessionToken: null,
    answers: { propertyAddress: "1 First Street", registeredOwner: "Rudo Moyo", askingPrice: "10" },
    version: null,
    submit: true,
  });
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  const accepted = await api.acceptIntakeReview({
    clientId: ORG,
    requestId: created.request.id as string,
    actor: agent,
    submissionVersion: submitted.version,
    linkContactId: "contact-moyo",
    confirmChanges: true,
    store: memoryStore(),
  });
  assert.equal(accepted.ok, true, JSON.stringify(accepted));
  const original = db.tables.re_seller_intake_documents[0].content_sha256;
  const second = await api.createIntakeTemplate({
    clientId: ORG,
    actor: manager,
    kind: "sole",
    title: "Synthetic sole mandate",
    organisationName: "Synthetic Agency",
    clauses: ["Replacement clause that must not enter the first document"],
    exclusivityMinimumMonths: 2,
    exclusivityContinuesUntilVaried: true,
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.template.version, 2);
  assert.equal(db.tables.re_seller_intake_templates.find((row) => row.id === firstTemplate.template.id)?.status, "retired");
  assert.equal(db.tables.re_seller_intake_documents[0].content_sha256, original);
  const snapshot = db.tables.re_seller_intake_submissions[0].snapshot as IntakeSnapshot;
  assert.deepEqual(snapshot.clauses, ["First organisation clause"]);
});

test("reissue revokes every earlier token and a cookie cannot cross requests", async () => {
  const api = await service();
  const db = useDb();
  const template = await api.createIntakeTemplate({ clientId: ORG, actor: manager, kind: "open", title: "Synthetic open", clauses: ["Clause"], organisationName: "Synthetic Agency" });
  assert.equal(template.ok, true);
  if (!template.ok) return;
  const first = await api.createSellerIntake({ clientId: ORG, actor: agent, templateId: template.template.id as string });
  const second = await api.createSellerIntake({ clientId: ORG, actor: agent, templateId: template.template.id as string });
  assert.equal(first.ok && second.ok, true);
  if (!first.ok || !second.ok) return;
  const saved = await api.savePublicSellerIntake({
    token: first.token,
    sessionToken: null,
    answers: { ...openAnswers, identityNumber: "SECRET-ID" },
    version: null,
    submit: false,
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  const otherTab = await api.publicSellerIntake({ token: second.token, sessionToken: saved.sessionToken });
  assert.equal(otherTab.ok, true);
  if (!otherTab.ok) return;
  assert.equal(JSON.stringify(otherTab.form).includes("SECRET-ID"), false);
  const resumedWrong = await api.publicSellerIntake({ token: first.token, sessionToken: sellerSessionCookieValue(second.request.id as string, "abcdefghijklmnopqrstuvwxyz") });
  assert.equal(resumedWrong.ok, true);
  if (!resumedWrong.ok) return;
  assert.equal(JSON.stringify(resumedWrong.form).includes("SECRET-ID"), false);
  const middle = await api.reissueSellerIntake({ clientId: ORG, requestId: first.request.id as string, actor: agent, purpose: "resume" });
  assert.equal(middle.ok, true);
  if (!middle.ok) return;
  const latest = await api.reissueSellerIntake({ clientId: ORG, requestId: first.request.id as string, actor: agent, purpose: "resume" });
  assert.equal(latest.ok, true);
  if (!latest.ok) return;
  assert.equal((await api.publicSellerIntake({ token: first.token, sessionToken: saved.sessionToken })).ok, false);
  assert.equal((await api.publicSellerIntake({ token: middle.token, sessionToken: null })).ok, false);
  assert.equal((await api.publicSellerIntake({ token: latest.token, sessionToken: null })).ok, true);
  assert.equal(db.tables.re_seller_intake_revoked_tokens.length >= 2, true);
  assert.equal(parseSellerSessionCookie(saved.sessionToken, second.request.id as string), null);
});

test("seller documents enter the scan worker and a client cannot set the result", async () => {
  delete process.env.COMPLIANCE_CLAMAV_HOST;
  const db = useDb();
  const { scanSellerDocument, scanPendingSellerDocuments } = await import("../lib/real-estate/seller-intake/scan");
  const bytes = Buffer.from("%PDF-1.4 synthetic");
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256").update(bytes).digest("hex");
  db.tables.re_seller_intake_documents.push({
    id: "doc-scan",
    client_id: ORG,
    storage_key: `clients/${ORG}/seller-intake/req/prepared.pdf`,
    content_sha256: hash,
    scan_status: "unscanned",
    byte_size: bytes.length,
  });
  const forged = await scanSellerDocument({ clientId: ORG, documentId: "doc-scan", claimedStatus: "clean" });
  assert.equal(forged.ok, false);
  if (!forged.ok) assert.equal(forged.status, 400);
  assert.equal(db.tables.re_seller_intake_documents[0].scan_status, "unscanned");
  const missing = await scanSellerDocument({ clientId: ORG, documentId: "doc-scan" });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.code, "SCANNER_NOT_CONFIGURED");
  assert.equal(db.tables.re_seller_intake_documents[0].scan_status, "unscanned");
  const unavailable = await scanSellerDocument({
    clientId: ORG,
    documentId: "doc-scan",
    exchange: async () => { throw new Error("scanner down"); },
    readBytes: async () => bytes,
  });
  assert.equal(unavailable.ok, true);
  if (unavailable.ok) assert.equal(unavailable.scanStatus, "scan_failed");
  const pending = await scanPendingSellerDocuments(5, async () => "stream: OK", async () => bytes);
  assert.equal(pending.ok, true);
  assert.equal(db.tables.re_seller_intake_documents[0].scan_status, "clean");
  const again = await scanSellerDocument({ clientId: ORG, documentId: "doc-scan", exchange: async () => "stream: Eicar FOUND", readBytes: async () => Buffer.from("replaced") });
  assert.equal(again.ok, true);
  if (again.ok) assert.equal(again.unchanged, true);
  assert.equal(db.tables.re_seller_intake_documents[0].content_sha256, hash);
  assert.equal(db.tables.re_seller_intake_documents[0].scan_status, "clean");
  db.tables.re_seller_intake_documents.push({
    id: "doc-bad",
    client_id: ORG,
    storage_key: `clients/${ORG}/seller-intake/req/bad.pdf`,
    content_sha256: "not-the-bytes",
    scan_status: "scan_failed",
    byte_size: 3,
  });
  const mismatch = await scanSellerDocument({ clientId: ORG, documentId: "doc-bad", exchange: async () => "stream: OK", readBytes: async () => Buffer.from("nope") });
  assert.equal(mismatch.ok, true);
  if (mismatch.ok) assert.equal(mismatch.scanStatus, "scan_failed");
  db.tables.re_seller_intake_documents.push({
    id: "doc-virus",
    client_id: ORG,
    storage_key: `clients/${ORG}/seller-intake/req/virus.pdf`,
    content_sha256: hash,
    scan_status: "pending",
    byte_size: bytes.length,
  });
  const infected = await scanSellerDocument({ clientId: ORG, documentId: "doc-virus", exchange: async () => "stream: Eicar FOUND", readBytes: async () => bytes });
  assert.equal(infected.ok, true);
  if (infected.ok) assert.equal(infected.scanStatus, "infected");
  assert.equal(sellerScanTransition({ scannerConfigured: false, currentStatus: "unscanned", storedHash: "a", actualHash: null, scannerResponse: "stream: OK" }).status, "unscanned");
});

test("company conversion copies the representative as representative, not owner", async () => {
  const copies = listingPartyPlan({
    contactId: "rep-1",
    parties: [
      { role: "registered_owner", partyKind: "company", contactId: null, displayName: "Moyo Holdings" },
      { role: "representative", partyKind: "individual", contactId: "rep-1", displayName: "Tariro Ncube" },
    ],
  });
  assert.deepEqual(copies.map((copy) => copy.partyRole), ["authorised_representative"]);
  const legacy = listingPartyPlan({ contactId: "person-1", parties: [] });
  assert.equal(legacy[0]?.partyRole, "owner");
  const groups = portfolioGroups({
    opportunities: [
      { id: "o1", contactId: "rep-1", ownerName: "Moyo Holdings", status: "active" },
      { id: "o2", contactId: "rep-2", ownerName: "Moyo Holdings", status: "active" },
    ],
    parties: [
      { opportunityId: "o1", role: "registered_owner", partyKind: "company", contactId: null, displayName: "Moyo Holdings" },
      { opportunityId: "o1", role: "representative", partyKind: "individual", contactId: "rep-1", displayName: "Tariro Ncube" },
      { opportunityId: "o2", role: "registered_owner", partyKind: "company", contactId: null, displayName: "Moyo Holdings" },
      { opportunityId: "o2", role: "representative", partyKind: "individual", contactId: "rep-2", displayName: "Chipo Dube" },
    ],
  });
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.name, "Moyo Holdings");
  assert.deepEqual(groups[0]?.representatives, ["Tariro Ncube", "Chipo Dube"]);
  assert.equal(groups[0]?.properties, 2);

  const db = useDb();
  const api = await service();
  const template = await api.createIntakeTemplate({ clientId: ORG, actor: manager, kind: "open", title: "Synthetic open", clauses: ["Clause"], organisationName: "Synthetic Agency" });
  assert.equal(template.ok, true);
  if (!template.ok) return;
  const created = await api.createSellerIntake({ clientId: ORG, actor: agent, templateId: template.template.id as string });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const submitted = await api.savePublicSellerIntake({
    token: created.token,
    sessionToken: null,
    answers: {
      ownerKind: "Company",
      companyName: "Moyo Holdings",
      representativeName: "Tariro Ncube",
      representativePhone: "0774444444",
      propertyAddress: "12 Cork Road",
      registeredOwner: "Moyo Holdings",
      mandatePrice: "100",
      askingPrice: "150",
      cell: "0774444444",
    },
    version: null,
    submit: true,
  });
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  const accepted = await api.acceptIntakeReview({
    clientId: ORG,
    requestId: created.request.id as string,
    actor: agent,
    submissionVersion: submitted.version,
    confirmNewContact: true,
    store: memoryStore(),
  });
  assert.equal(accepted.ok, true, JSON.stringify(accepted));
  const { prepareListingFromAcquisition } = await import("../lib/real-estate/acquisition-service");
  const blocked = await prepareListingFromAcquisition({ clientId: ORG, opportunityId: accepted.ok ? accepted.opportunityId as string : "", actor: manager });
  assert.equal(blocked.ok, false);
  db.tables.real_estate_mandates[0].status = "approved";
  db.tables.real_estate_mandates[0].expiry_date = null;
  const prepared = await prepareListingFromAcquisition({ clientId: ORG, opportunityId: accepted.ok ? accepted.opportunityId as string : "", actor: manager });
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  assert.equal(db.tables.listings[0].approval_status, "draft");
  assert.equal(db.tables.listings[0].status, "reserved");
  const roles = (db.tables.real_estate_listing_parties ?? []).map((row) => row.party_role);
  assert.deepEqual(roles, ["authorised_representative"]);
  const redacted = renderMandatePdf({
    templateId: "t",
    templateVersion: 1,
    kind: "open",
    title: "Synthetic open",
    organisationName: "Synthetic Agency",
    clauses: ["Clause"],
    exclusivityMinimumMonths: null,
    exclusivityContinuesUntilVaried: false,
    answers: { registeredOwner: "Rudo Moyo", identityNumber: "SECRET-ID", askingPrice: "1", propertyAddress: "12 Cork Road", mandatePrice: "1" },
    submittedAt: "2026-11-05T08:00:00.000Z",
  }, { includeRestricted: false });
  const visible = Buffer.from(redacted.bytes).toString("latin1");
  assert.equal(visible.includes("SECRET-ID"), false);
  assert.ok(visible.includes("Synthetic Agency"));
  assert.ok(redacted.pages.every((page) => page.some((line) => line.startsWith("Page "))));
  assert.ok(redacted.pages[redacted.pages.length - 1]?.some((line) => line.includes("Signature date: not recorded")));
});

function memoryStore() {
  const files = new Map<string, Buffer>();
  return { files, put: async (key: string, body: Buffer) => { files.set(key, body); } };
}
