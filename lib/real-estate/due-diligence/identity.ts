import { createHmac } from "crypto";
import { compareNames, isZimbabweNationalId, normaliseId } from "@/lib/real-estate/due-diligence/compare";
import type { IdentityOutcome } from "@/lib/real-estate/due-diligence/types";

export type IdentityCheckInput = {
  idNumber: string;
  fullName: string;
  jobId: string;
  userId: string;
};

type SmileResponse = {
  ResultCode?: string;
  ResultText?: string;
  SmileJobID?: string;
  FullName?: string;
  Actions?: { Verify_ID_Number?: string };
  error?: string;
};

const VERIFIED_CODES = new Set(["1012", "1020"]);
const PARTIAL_CODES = new Set(["1013", "1021"]);
const MISMATCH_CODES = new Set(["1022"]);
const UNAVAILABLE_CODES = new Set(["1015"]);

/**
 * Smile ID signs requests with HMAC-SHA256 over timestamp, partner id, and "sid_request".
 * https://docs.usesmileid.com — the API key is the HMAC secret and never leaves the server.
 */
export function smileSignature(timestamp: string, partnerId: string, apiKey: string): string {
  return createHmac("sha256", apiKey).update(timestamp).update(partnerId).update("sid_request").digest("base64");
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts[parts.length - 1] };
}

function interpret(body: SmileResponse, enteredName: string): IdentityOutcome {
  const code = body.ResultCode ?? "";
  const returnedName = body.FullName?.trim() || null;
  const reference = body.SmileJobID ?? null;
  const text = body.ResultText?.trim() || "Smile ID returned no result text.";
  if (VERIFIED_CODES.has(code) || body.Actions?.Verify_ID_Number === "Verified") {
    if (returnedName && compareNames(enteredName, returnedName) === "mismatch") {
      return {
        provider: "smile_id",
        status: "mismatch",
        detail: `Smile ID validated the number, but the returned name (${returnedName}) does not match the seller.`,
        reference,
        returnedName,
      };
    }
    return {
      provider: "smile_id",
      status: "verified",
      detail: `Smile ID validated the Zimbabwe national ID number. ${text} This product is an ID-number lookup. It does not include a face match.`,
      reference,
      returnedName,
    };
  }
  if (MISMATCH_CODES.has(code)) {
    return { provider: "smile_id", status: "mismatch", detail: text, reference, returnedName };
  }
  if (PARTIAL_CODES.has(code)) {
    return { provider: "smile_id", status: "inconclusive", detail: `Partial result from Smile ID. ${text}`, reference, returnedName };
  }
  if (UNAVAILABLE_CODES.has(code)) {
    return { provider: "smile_id", status: "error", detail: `The ID authority was unavailable. ${text}`, reference, returnedName };
  }
  return {
    provider: "smile_id",
    status: "inconclusive",
    detail: code ? `Smile ID result ${code}: ${text}` : text,
    reference,
    returnedName,
  };
}

/**
 * Zimbabwe coverage for a number-only lookup is Enhanced KYC, id type NATIONAL_ID_NO_PHOTO.
 * Face match and liveness go through lib/identity-verification.ts, because this ID type has no photo on file.
 */
export async function verifyIdentity(
  input: IdentityCheckInput,
  options: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; now?: Date } = {}
): Promise<IdentityOutcome> {
  const env = options.env ?? process.env;
  const partnerId = env.SMILE_ID_PARTNER_ID?.trim();
  const apiKey = env.SMILE_ID_API_KEY?.trim();
  const baseUrl = (env.SMILE_ID_BASE_URL?.trim() || "https://testapi.smileidentity.com").replace(/\/$/, "");
  if (!partnerId || !apiKey) {
    return {
      provider: "unconfigured",
      status: "not_configured",
      detail: "Smile ID is not configured. Set SMILE_ID_PARTNER_ID and SMILE_ID_API_KEY to look up a Zimbabwe national ID.",
      reference: null,
      returnedName: null,
    };
  }
  const idNumber = normaliseId(input.idNumber);
  if (!isZimbabweNationalId(idNumber)) {
    return {
      provider: "smile_id",
      status: "inconclusive",
      detail: "The ID number is not in the Zimbabwe format Smile ID expects (8 or 9 digits, a letter, then 2 digits). It was not submitted.",
      reference: null,
      returnedName: null,
    };
  }
  const timestamp = (options.now ?? new Date()).toISOString();
  const name = splitName(input.fullName);
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}/v1/id_verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partner_id: partnerId,
        source_sdk: "rest_api",
        source_sdk_version: "1.0.0",
        timestamp,
        signature: smileSignature(timestamp, partnerId, apiKey),
        country: "ZW",
        id_type: "NATIONAL_ID_NO_PHOTO",
        id_number: idNumber,
        first_name: name.firstName,
        last_name: name.lastName,
        partner_params: { job_type: 5, job_id: input.jobId, user_id: input.userId },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    return { provider: "smile_id", status: "error", detail: `Smile ID could not be reached. ${message}`, reference: null, returnedName: null };
  }
  const body = (await response.json().catch(() => null)) as SmileResponse | null;
  if (!response.ok || !body) {
    return {
      provider: "smile_id",
      status: "error",
      detail: body?.error || body?.ResultText || `Smile ID returned ${response.status}.`,
      reference: body?.SmileJobID ?? null,
      returnedName: null,
    };
  }
  return interpret(body, input.fullName);
}
