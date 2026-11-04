import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { confirmPayment, legalTransferAfterMilestone } from "../lib/real-estate/compliance-management/engine";
import { correctionMessages, customerDeliveryText, evidenceAccessDecision } from "../lib/real-estate/compliance-management/remediation";
import { parseClamAvResponse, scanWithClamAv, storedScanStatus, verdictFromScan } from "../lib/real-estate/compliance-management/scanner";

const service = readFileSync(new URL("../lib/real-estate/compliance-management/service.ts", import.meta.url), "utf8");
const foundation = readFileSync(new URL("../supabase/migrations/20261103195500_re_compliance_management_foundation.sql", import.meta.url), "utf8");
const scanMigration = readFileSync(new URL("../supabase/migrations/20261104023000_re_compliance_scan_lifecycle.sql", import.meta.url), "utf8");
const cronRoute = readFileSync(new URL("../app/api/cron/compliance-scan/route.ts", import.meta.url), "utf8");

test("a scanner response is the only path to a clean verdict", () => {
  assert.deepEqual(parseClamAvResponse("stream: OK"), { outcome: "clean", engine: "clamav", signature: null });
  assert.equal(parseClamAvResponse("stream: Eicar-Test-Signature FOUND").outcome, "infected");
  assert.equal(parseClamAvResponse("image/jpeg").outcome, "scan_failed");
  assert.equal(parseClamAvResponse("").outcome, "scan_failed");
  assert.equal(verdictFromScan({ response: "stream: OK", claimedStatus: "clean", checksumMatches: true }).outcome, "scan_failed");
  assert.equal(verdictFromScan({ response: "stream: OK", checksumMatches: false }).outcome, "scan_failed");
  assert.equal(storedScanStatus(parseClamAvResponse("stream: OK")), "clean");
});

test("an unscanned, infected, failed, or still-scanning file cannot be opened", () => {
  for (const status of ["unscanned", "scanning", "infected", "scan_failed", "quarantined", null]) {
    assert.equal(evidenceAccessDecision(status).allowBytes, false);
  }
  assert.equal(evidenceAccessDecision("clean").allowBytes, true);
});

test("the ClamAV boundary does not treat file bytes as a verdict", async () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const previous = process.env.COMPLIANCE_CLAMAV_HOST;
  delete process.env.COMPLIANCE_CLAMAV_HOST;
  assert.equal((await scanWithClamAv(jpeg)).outcome, "scan_failed");
  const infected = await scanWithClamAv(jpeg, async () => "stream: Eicar-Test-Signature FOUND");
  assert.equal(infected.outcome, "infected");
  const clean = await scanWithClamAv(Buffer.from("harmless"), async () => "stream: OK");
  assert.equal(clean.outcome, "clean");
  if (previous === undefined) delete process.env.COMPLIANCE_CLAMAV_HOST;
  else process.env.COMPLIANCE_CLAMAV_HOST = previous;
});

test("uploads stay unscanned and a request cannot submit a scan status", () => {
  assert.match(service, /scan_status: "unscanned"/);
  assert.doesNotMatch(service, /scan_status:\s*"clean"/);
  assert.match(service, /claimedStatus\) return fail\(400/);
  assert.match(cronRoute, /scanStatus/);
  assert.match(cronRoute, /SCAN_STATUS_REJECTED/);
  assert.match(scanMigration, /'scanning', 'clean', 'infected', 'scan_failed', 'quarantined'/);
});

test("customer correction text stays separate from the internal note", () => {
  const separated = correctionMessages({ customerInstruction: "Upload a clearer copy of the identification page.", internalNote: "Possible name mismatch with the mandate." });
  assert.equal(separated.ok, true);
  if (!separated.ok) return;
  const mailed = customerDeliveryText(separated.customerInstruction, separated.internalNote);
  assert.match(mailed, /clearer copy/);
  assert.doesNotMatch(mailed, /name mismatch/);
  assert.equal(correctionMessages({ customerInstruction: "Short", internalNote: "private" }).ok, false);
  assert.equal(correctionMessages({ customerInstruction: "Please upload the identification page again. private finding", internalNote: "private finding" }).ok, false);
  assert.match(service, /customerMessage: recordedReason/);
  assert.match(service, /confidential: true/);
  assert.doesNotMatch(service, /customerMessage: opts\.internalNote/);
});

test("a replacement is a new evidence version and a stale decision conflicts", () => {
  assert.match(service, /version_number: \(version\.count \?\? 0\) \+ 1/);
  assert.match(foundation, /compliance_prevent_evidence_delete/);
  assert.match(foundation, /p_expected_state/);
  assert.match(foundation, /RE409: This requirement changed/);
});

test("payment proof and handover do not confirm cleared funds or registered title", () => {
  assert.equal(confirmPayment({ from: "proof_uploaded", actorMayRecordFinance: true }).ok, false);
  assert.equal(confirmPayment({ from: "under_verification", actorMayRecordFinance: false }).ok, false);
  assert.equal(legalTransferAfterMilestone({ milestoneKey: "keys_handed_over", milestoneDone: true, route: "title_deed", current: "not_started" }), "not_started");
  assert.equal(legalTransferAfterMilestone({ milestoneKey: "registration_confirmed", milestoneDone: true, route: "title_deed", current: "lodged" }), "registered");
});
