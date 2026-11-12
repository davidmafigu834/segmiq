import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareIds, compareNames, isZimbabweNationalId } from "../lib/real-estate/due-diligence/compare";
import { evaluateDueDiligence } from "../lib/real-estate/due-diligence/evaluate";
import { dueDiligenceEnabled } from "../lib/real-estate/due-diligence/flag";
import { verifyIdentity, smileSignature } from "../lib/real-estate/due-diligence/identity";
import { decideStatus, scoreRisk } from "../lib/real-estate/due-diligence/scoring";
import { interpretBiometricResult, toE164, verifySellerIdentity } from "../lib/identity-verification";
import type { DocumentExtraction, DocumentInput, EvaluationInput } from "../lib/real-estate/due-diligence/types";

function extraction(
  overrides: Partial<Omit<DocumentExtraction, "fields">> & { fields?: Partial<DocumentExtraction["fields"]> } = {}
): DocumentExtraction {
  const fields: DocumentExtraction["fields"] = {
    fullName: "Tendai Moyo",
    otherNames: [],
    idNumber: "12345678A12",
    dateOfBirth: null,
    propertyDescription: null,
    standNumber: null,
    suburb: null,
    city: null,
    deedNumber: null,
    localAuthority: null,
    issueDate: null,
    expiryDate: null,
    developerName: null,
    permitNumber: null,
    agreementNumber: null,
    restrictions: [],
    ...overrides.fields,
  };
  return {
    documentType: "national_id",
    confidence: 0.9,
    quality: "readable",
    qualityNotes: "",
    redFlags: [],
    ...overrides,
    fields,
  };
}

function document(id: string, declaredType: DocumentInput["declaredType"], extracted: DocumentExtraction | null, fileName = `${declaredType}.pdf`): DocumentInput {
  return { id, declaredType, fileName, extracted };
}

function input(partial: {
  seller?: Partial<EvaluationInput["seller"]>;
  property?: Partial<EvaluationInput["property"]>;
  documents?: EvaluationInput["documents"];
  identity?: EvaluationInput["identity"];
} = {}): EvaluationInput {
  const seller: EvaluationInput["seller"] = {
    fullName: "Tendai Moyo",
    idNumber: "12345678A12",
    phone: "+263771234567",
    email: "tendai@example.com",
    maritalStatus: "single",
    sellerKind: "individual",
    companyName: "",
    actingCapacity: "owner",
    representativeName: "",
    ...partial.seller,
  };
  const property: EvaluationInput["property"] = {
    address: "12 Baines Avenue",
    standNumber: "1234",
    suburb: "Borrowdale",
    city: "Harare",
    propertyType: "residential",
    tenureType: "title_deed",
    askingPriceUsd: 80000,
    localAuthority: "City of Harare",
    ...partial.property,
  };
  return {
    seller,
    property,
    documents: partial.documents ?? [],
    identity: partial.identity === undefined ? {
      provider: "smile_id",
      status: "verified",
      detail: "Validated",
      reference: "job-1",
      returnedName: "Tendai Moyo",
    } : partial.identity,
  };
}

function titleFile(): DocumentInput[] {
  return [
    document("id", "national_id", extraction()),
    document("deed", "title_deed", extraction({
      documentType: "title_deed",
      fields: { fullName: "Moyo Tendai", standNumber: "Stand 1234", suburb: "Borrowdale", idNumber: "12-345678A12", deedNumber: "1234/2020" },
    })),
    document("rates", "rates_clearance", extraction({ documentType: "rates_clearance", fields: { fullName: "Tendai Moyo", expiryDate: "2099-01-01" } })),
    document("diagram", "survey_diagram", extraction({ documentType: "survey_diagram", fields: { fullName: null, idNumber: null } })),
  ];
}

describe("due diligence rules", () => {
  it("stays a conditional pass on a complete title deed until the Deeds Registry search is recorded", () => {
    const result = evaluateDueDiligence(input({ documents: titleFile() }));
    assert.equal(result.status, "conditional_pass");
    assert.ok(result.score >= 50 && result.score < 80);
    assert.equal(result.checks.find((item) => item.code === "deeds_registry_search")?.status, "warning");
    assert.equal(result.checks.find((item) => item.code === "identity_name_match")?.status, "pass");
    assert.ok(result.recommendations.some((item) => item.includes("Deeds Registry")));
    assert.ok(result.recommendations.some((item) => item.includes("SI 76 of 2025")));
    assert.equal(result.missingDocuments.length, 0);
  });

  it("fails a title deed with no rates clearance", () => {
    const documents = titleFile().filter((item) => item.declaredType !== "rates_clearance");
    const result = evaluateDueDiligence(input({ documents }));
    assert.equal(result.status, "fail");
    assert.ok(result.missingDocuments.includes("Rates clearance"));
    assert.equal(result.checks.find((item) => item.code === "document_rates_clearance")?.critical, true);
  });

  it("fails when the deed name does not match the seller", () => {
    const documents = titleFile().map((item) => item.declaredType === "title_deed"
      ? document(item.id, item.declaredType, extraction({ documentType: "title_deed", fields: { fullName: "Rudo Ncube", standNumber: "1234", suburb: "Borrowdale" } }))
      : item);
    const result = evaluateDueDiligence(input({ documents }));
    assert.equal(result.status, "fail");
    assert.equal(result.checks.find((item) => item.code === "identity_name_match")?.status, "fail");
  });

  it("fails a council cession without an agreement of sale", () => {
    const result = evaluateDueDiligence(input({
      property: { tenureType: "council_cession" },
      documents: [document("id", "national_id", extraction())],
    }));
    assert.equal(result.status, "fail");
    assert.ok(result.missingDocuments.includes("Agreement of sale"));
    assert.equal(result.checks.find((item) => item.code === "council_verification")?.status, "warning");
  });

  it("fails a developer cession that is missing a permit", () => {
    const result = evaluateDueDiligence(input({
      property: { tenureType: "developer_cession" },
      documents: [
        document("id", "national_id", extraction()),
        document("sub", "subdivision_permit", extraction({ documentType: "subdivision_permit", fields: { standNumber: "1234", fullName: "Tendai Moyo" } })),
      ],
    }));
    assert.equal(result.status, "fail");
    assert.ok(result.missingDocuments.includes("Development permit"));
    assert.equal(result.checklist.find((item) => item.code === "document_development_permit")?.status, "missing");
  });

  it("can pass a developer file when identity is verified and every required document matches", () => {
    const result = evaluateDueDiligence(input({
      property: { tenureType: "developer_cession", askingPriceUsd: 40000 },
      documents: [
        document("id", "national_id", extraction()),
        document("sub", "subdivision_permit", extraction({ documentType: "subdivision_permit", fields: { standNumber: "1234", suburb: "Borrowdale", fullName: "Tendai Moyo" } })),
        document("dev", "development_permit", extraction({ documentType: "development_permit", fields: { standNumber: "1234", suburb: "Borrowdale", fullName: "Tendai Moyo" } })),
        document("rates", "rates_clearance", extraction({ documentType: "rates_clearance", fields: { fullName: "Tendai Moyo", expiryDate: "2099-01-01" } })),
      ],
    }));
    assert.equal(result.status, "pass");
    assert.ok(result.score >= 80);
  });

  it("fails an expired rates clearance", () => {
    const documents = titleFile().map((item) => item.declaredType === "rates_clearance"
      ? document(item.id, item.declaredType, extraction({ documentType: "rates_clearance", fields: { fullName: "Tendai Moyo", expiryDate: "2020-01-01" } }))
      : item);
    const result = evaluateDueDiligence(input({ documents }));
    assert.equal(result.status, "fail");
    assert.equal(result.checks.find((item) => item.code === "rates_expiry")?.status, "fail");
    assert.ok(result.redFlags.some((item) => item.includes("expired")));
    assert.ok(result.recommendations.some((item) => item.includes("current rates clearance")));
  });

  it("treats a printed bond as a red flag and a conditional pass", () => {
    const result = evaluateDueDiligence(input({
      property: { tenureType: "developer_cession", askingPriceUsd: 40000 },
      documents: [
        document("id", "national_id", extraction()),
        document("sub", "subdivision_permit", extraction({ documentType: "subdivision_permit", fields: { standNumber: "1234", suburb: "Borrowdale", fullName: "Tendai Moyo" } })),
        document("dev", "development_permit", extraction({
          documentType: "development_permit",
          fields: { standNumber: "1234", suburb: "Borrowdale", fullName: "Tendai Moyo", restrictions: ["Mortgage bond in favour of CBZ"] },
        })),
        document("rates", "rates_clearance", extraction({ documentType: "rates_clearance", fields: { fullName: "Tendai Moyo", expiryDate: "2099-01-01" } })),
      ],
    }));
    assert.equal(result.status, "conditional_pass");
    assert.ok(result.score >= 50 && result.score < 80);
    assert.ok(result.redFlags.some((item) => item.includes("Mortgage bond in favour of CBZ")));
  });

  it("asks for a conveyancer when the asking price is high", () => {
    const result = evaluateDueDiligence(input({
      property: { askingPriceUsd: 150000 },
      documents: titleFile(),
    }));
    assert.ok(result.recommendations.some((item) => item.includes("conveyancer")));
  });

  it("does not treat an unknown Smile ID result as verified", async () => {
    const outcome = await verifyIdentity(
      { idNumber: "12345678A12", fullName: "Tendai Moyo", jobId: "m1", userId: "u1" },
      {
        env: { SMILE_ID_PARTNER_ID: "085", SMILE_ID_API_KEY: "secret", SMILE_ID_BASE_URL: "https://example.test" },
        fetchImpl: async () => Response.json({ ResultCode: "9999", ResultText: "Unrecognised", SmileJobID: "job-x" }),
      }
    );
    assert.equal(outcome.status, "inconclusive");
    assert.equal(outcome.provider, "smile_id");
  });

  it("does not treat a missing Smile ID configuration as a verified identity", async () => {
    let called = false;
    const outcome = await verifyIdentity(
      { idNumber: "12345678A12", fullName: "Tendai Moyo", jobId: "m1", userId: "u1" },
      { env: {}, fetchImpl: async () => { called = true; return new Response("{}"); } }
    );
    assert.equal(outcome.status, "not_configured");
    assert.equal(called, false);
    const result = evaluateDueDiligence(input({ documents: titleFile(), identity: outcome }));
    assert.equal(result.checks.find((item) => item.code === "identity_verification")?.status, "warning");
    assert.notEqual(result.status, "pass");
  });
});

describe("due diligence comparison helpers", () => {
  it("matches names regardless of order and titles", () => {
    assert.equal(compareNames("Mr Tendai Moyo", "Moyo Tendai"), "match");
    assert.equal(compareNames("Tendai Moyo", "Rudo Ncube"), "mismatch");
    assert.equal(compareIds("12-345678 A12", "12345678A12"), "match");
    assert.equal(isZimbabweNationalId("12345678A12"), true);
    assert.equal(isZimbabweNationalId("ABC"), false);
  });

  it("signs Smile ID requests without treating an unknown result as verified", () => {
    const first = smileSignature("2026-11-10T00:00:00.000Z", "085", "secret");
    const second = smileSignature("2026-11-10T00:00:01.000Z", "085", "secret");
    assert.notEqual(first, second);
    assert.match(first, /^[A-Za-z0-9+/]+=*$/);
    const failed = scoreRisk([{ code: "x", label: "X", status: "fail", critical: true, weight: 55, detail: "Missing", evidence: {} }]);
    assert.equal(decideStatus([{ code: "x", label: "X", status: "fail", critical: true, weight: 55, detail: "Missing", evidence: {} }], failed.score), "fail");
    const open = scoreRisk([{ code: "y", label: "Y", status: "warning", critical: false, weight: 25, detail: "Open", evidence: {} }]);
    assert.equal(decideStatus([{ code: "y", label: "Y", status: "warning", critical: false, weight: 25, detail: "Open", evidence: {} }], open.score), "conditional_pass");
  });

  it("stays off unless the deployment flag is on", () => {
    assert.equal(dueDiligenceEnabled({}), false);
    assert.equal(dueDiligenceEnabled({ RE_DUE_DILIGENCE: "on" }), true);
    assert.equal(dueDiligenceEnabled({ RE_DUE_DILIGENCE: "false" }), false);
  });
});

function photo(name: string): { bytes: Buffer; contentType: string; fileName: string } {
  return { bytes: Buffer.from("jpeg"), contentType: "image/jpeg", fileName: name };
}

function sellerPhotos() {
  return {
    idNumber: "12345678A12",
    fullName: "Tendai Moyo",
    email: "tendai@example.com",
    phone: "0771234567",
    jobId: "mandate-1",
    userId: "agent-1",
    nationalId: photo("national-id.jpg"),
    selfie: photo("selfie.jpg"),
    livenessFrames: [1, 2, 3, 4, 5, 6].map((index) => photo(`liveness-${index}.jpg`)),
  };
}

describe("identity verification", () => {
  it("formats a Zimbabwe mobile number for Smile ID", () => {
    assert.equal(toE164("0771234567"), "+263771234567");
    assert.equal(toE164("+263771234567"), "+263771234567");
    assert.equal(toE164("123"), null);
  });

  it("requires a liveness sequence before a face match is Clear", () => {
    const matched = interpretBiometricResult({
      status: "clear",
      message: "Document and face matched.",
      job_id: "job-1",
      id_fields: { full_name: "Tendai Moyo" },
      confidence: 96,
    }, "Tendai Moyo", true);
    assert.equal(matched.decision, "clear");
    assert.equal(matched.status, "verified");
    assert.equal(matched.confidence, 96);
    assert.equal(matched.faceMatch, "matched");
    assert.equal(matched.liveness, "passed");

    const noLiveness = interpretBiometricResult({ status: "clear", message: "Face matched.", job_id: "job-2" }, "Tendai Moyo", false);
    assert.equal(noLiveness.decision, "review");
    assert.equal(noLiveness.liveness, "not_captured");

    const faceFail = interpretBiometricResult({ status: "block", reason: "face_verification_failed", message: "The selfie did not match the ID photo." }, "Tendai Moyo", true);
    assert.equal(faceFail.decision, "fail");
    assert.equal(faceFail.faceMatch, "unmatched");
  });

  it("does not call Smile ID when credentials are missing", async () => {
    let called = false;
    const outcome = await verifySellerIdentity(sellerPhotos(), {
      env: {},
      fetchImpl: async () => { called = true; return new Response("{}"); },
    });
    assert.equal(called, false);
    assert.equal(outcome.decision, "review");
    assert.equal(outcome.status, "not_configured");
    assert.equal(outcome.confidence, null);
  });

  it("sends the National ID, selfie, and liveness frames when they are on the file", async () => {
    const urls: string[] = [];
    const outcome = await verifySellerIdentity(sellerPhotos(), {
      env: {
        SMILE_ID_PARTNER_ID: "085",
        SMILE_ID_API_KEY: "secret",
        SMILE_ID_BASE_URL: "https://example.test",
        SMILE_ID_PRIVACY_POLICY_URL: "https://example.test/privacy",
      },
      attempts: 1,
      sleep: async () => {},
      fetchImpl: async (input) => {
        const url = String(input);
        urls.push(url);
        if (url.endsWith("/v3/token")) return Response.json({ token: "jwt" });
        if (url.endsWith("/v3/document_verification")) {
          return Response.json({ status: "accepted", job_id: "job-9", message: "queued" }, { status: 202 });
        }
        if (url.endsWith("/v3/status/job-9")) {
          return Response.json({ status: "clear", message: "Document and face matched.", job_id: "job-9", id_fields: { full_name: "Moyo Tendai" }, confidence: 91 });
        }
        return Response.json({ error: url }, { status: 500 });
      },
    });
    assert.equal(outcome.decision, "clear");
    assert.equal(outcome.confidence, 91);
    assert.equal(outcome.reference, "job-9");
    assert.ok(urls.some((url) => url.endsWith("/v3/document_verification")));
  });

  it("keeps an ID-number match as Review when no photos were compared", async () => {
    const outcome = await verifySellerIdentity({ ...sellerPhotos(), nationalId: null, selfie: null, livenessFrames: [] }, {
      env: { SMILE_ID_PARTNER_ID: "085", SMILE_ID_API_KEY: "secret", SMILE_ID_BASE_URL: "https://example.test" },
      fetchImpl: async () => Response.json({ ResultCode: "1012", ResultText: "ID number validated", FullName: "Tendai Moyo", SmileJobID: "job-n" }),
    });
    assert.equal(outcome.decision, "review");
    assert.equal(outcome.faceMatch, "not_compared");
    assert.notEqual(outcome.status, "verified");
  });

  it("fails the file when the biometric result is Fail and leaves a Review as conditional", () => {
    const documents = [
      document("id", "national_id", extraction()),
      document("sub", "subdivision_permit", extraction({ documentType: "subdivision_permit", fields: { standNumber: "1234", suburb: "Borrowdale", fullName: "Tendai Moyo" } })),
      document("dev", "development_permit", extraction({ documentType: "development_permit", fields: { standNumber: "1234", suburb: "Borrowdale", fullName: "Tendai Moyo" } })),
      document("rates", "rates_clearance", extraction({ documentType: "rates_clearance", fields: { fullName: "Tendai Moyo", expiryDate: "2099-01-01" } })),
    ];
    const failed = evaluateDueDiligence(input({
      property: { tenureType: "developer_cession", askingPriceUsd: 40000 },
      documents,
      identity: {
        provider: "smile_id",
        status: "mismatch",
        decision: "fail",
        confidence: 12,
        detail: "The selfie did not match the ID photo.",
        reference: "job-f",
        returnedName: "Tendai Moyo",
        faceMatch: "unmatched",
        liveness: "passed",
      },
    }));
    assert.equal(failed.status, "fail");
    assert.equal(failed.checks.find((item) => item.code === "identity_verification")?.status, "fail");

    const review = evaluateDueDiligence(input({
      property: { tenureType: "developer_cession", askingPriceUsd: 40000 },
      documents,
      identity: {
        provider: "smile_id",
        status: "inconclusive",
        decision: "review",
        confidence: null,
        detail: "The ID number matched. The face was not compared.",
        reference: null,
        returnedName: "Tendai Moyo",
        faceMatch: "not_compared",
        liveness: "not_captured",
      },
    }));
    assert.equal(review.status, "conditional_pass");
    assert.equal(review.checks.find((item) => item.code === "identity_verification")?.status, "warning");
    assert.ok(review.score >= 50 && review.score < 80);
  });
});

describe("document reading", () => {
  it("uses the platform Claude model when both Claude and OpenAI keys are set", async () => {
    const { extractDocument } = await import("../lib/real-estate/due-diligence/extract");
    let requestedModel = "";
    const outcome = await extractDocument(
      { declaredType: "national_id", fileName: "id.jpg", contentType: "image/jpeg", bytes: Buffer.from("jpeg") },
      {
        env: { ANTHROPIC_API_KEY: "sk-ant", ANTHROPIC_MODEL: "claude-sonnet-4-6", OPENAI_API_KEY: "sk-openai" },
        fetchImpl: async (input, init) => {
          const body = JSON.parse(String(init?.body)) as { model?: string };
          requestedModel = body.model ?? "";
          assert.equal(String(input), "https://api.anthropic.com/v1/messages");
          return Response.json({
            content: [{
              type: "tool_use",
              name: "record_document",
              input: {
                document_type: "national_id",
                confidence: 0.9,
                quality: "readable",
                quality_notes: "",
                red_flags: [],
                fields: {
                  full_name: "Tendai Moyo",
                  other_names: [],
                  id_number: "12345678A12",
                  date_of_birth: null,
                  property_description: null,
                  stand_number: null,
                  suburb: null,
                  city: null,
                  deed_number: null,
                  local_authority: null,
                  issue_date: null,
                  expiry_date: null,
                  developer_name: null,
                  permit_number: null,
                  agreement_number: null,
                  restrictions: [],
                },
              },
            }],
          });
        },
      }
    );
    assert.equal(outcome.ok, true);
    assert.equal(requestedModel, "claude-sonnet-4-6");
    if (outcome.ok) assert.equal(outcome.extraction.fields.fullName, "Tendai Moyo");
  });

  it("uses the configured gateway model even when a Claude key is also set", async () => {
    const { extractDocument } = await import("../lib/real-estate/due-diligence/extract");
    let requestedModel = "";
    const outcome = await extractDocument(
      { declaredType: "national_id", fileName: "id.jpg", contentType: "image/jpeg", bytes: Buffer.from("jpeg") },
      {
        env: {
          AGENT_LLM_PROVIDER: "vercel",
          AI_GATEWAY_API_KEY: "gateway-key",
          AI_GATEWAY_MODEL: "nvidia/nemotron-3.5-lightning-free",
          ANTHROPIC_API_KEY: "sk-ant",
        },
        fetchImpl: async (input, init) => {
          const body = JSON.parse(String(init?.body)) as { model?: string; reasoning?: { enabled?: boolean } };
          requestedModel = body.model ?? "";
          assert.equal(String(input), "https://ai-gateway.vercel.sh/v1/chat/completions");
          assert.equal(body.reasoning?.enabled, false);
          assert.equal(init?.headers && (init.headers as Record<string, string>).Authorization, "Bearer gateway-key");
          return Response.json({
            choices: [{
              message: {
                content: JSON.stringify({
                  document_type: "national_id",
                  confidence: 0.9,
                  quality: "readable",
                  quality_notes: "",
                  red_flags: [],
                  fields: {
                    full_name: "Tendai Moyo",
                    other_names: [],
                    id_number: "12345678A12",
                    date_of_birth: null,
                    property_description: null,
                    stand_number: null,
                    suburb: null,
                    city: null,
                    deed_number: null,
                    local_authority: null,
                    issue_date: null,
                    expiry_date: null,
                    developer_name: null,
                    permit_number: null,
                    agreement_number: null,
                    restrictions: [],
                  },
                }),
              },
            }],
          });
        },
      }
    );
    assert.equal(outcome.ok, true);
    assert.equal(requestedModel, "nvidia/nemotron-3.5-lightning-free");
    if (outcome.ok) assert.equal(outcome.extraction.fields.fullName, "Tendai Moyo");
  });
});
