import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canViewDocument,
  hasDocumentPermission,
} from "../lib/documents/permissions";
import { sanitizeDocumentFilename, validateDocumentFile } from "../lib/documents/validation";

describe("document validation", () => {
  it("accepts a valid PDF", () => {
    const result = validateDocumentFile("contract.pdf", "application/pdf", 1024);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.mimeType, "application/pdf");
      assert.equal(result.safeFilename, "contract.pdf");
    }
  });

  it("rejects unsupported extensions", () => {
    const result = validateDocumentFile("malware.exe", "application/octet-stream", 100);
    assert.equal(result.ok, false);
  });

  it("rejects oversize files", () => {
    const result = validateDocumentFile(
      "big.pdf",
      "application/pdf",
      60 * 1024 * 1024
    );
    assert.equal(result.ok, false);
  });

  it("sanitizes unsafe filenames", () => {
    assert.equal(sanitizeDocumentFilename("../../etc/passwd"), "passwd");
    assert.equal(sanitizeDocumentFilename("  Mutasa Agreement.pdf  "), "Mutasa Agreement.pdf");
  });
});

describe("document permissions", () => {
  const manager = { userId: "u1", role: "CLIENT_MANAGER", clientId: "c1" };
  const sales = { userId: "u2", role: "SALESPERSON", clientId: "c1" };

  it("grants managers upload and view", () => {
    assert.equal(hasDocumentPermission(manager, "documents.upload"), true);
    assert.equal(hasDocumentPermission(manager, "documents.view"), true);
  });

  it("grants salespeople view and upload", () => {
    assert.equal(hasDocumentPermission(sales, "documents.view"), true);
    assert.equal(hasDocumentPermission(sales, "documents.upload"), true);
    assert.equal(hasDocumentPermission(sales, "documents.archive"), false);
  });

  it("allows company-scoped documents for salespeople", () => {
    const doc = { client_id: "c1", owner_user_id: null, uploaded_by: "u9" };
    const policy = {
      id: "p1",
      client_id: "c1",
      document_id: "d1",
      scope_type: "COMPANY" as const,
      scope_id: null,
      classification: "GENERAL" as const,
    };
    assert.equal(canViewDocument(sales, doc, policy), true);
  });

  it("blocks private documents for other users", () => {
    const doc = { client_id: "c1", owner_user_id: "u9", uploaded_by: "u9" };
    const policy = {
      id: "p1",
      client_id: "c1",
      document_id: "d1",
      scope_type: "PRIVATE" as const,
      scope_id: "u9",
      classification: "HR" as const,
    };
    assert.equal(canViewDocument(sales, doc, policy), false);
  });
});
