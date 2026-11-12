import { compareNames } from "@/lib/real-estate/due-diligence/compare";
import { smileSignature, verifyIdentity } from "@/lib/real-estate/due-diligence/identity";
import type { IdentityDecision, IdentityOutcome } from "@/lib/real-estate/due-diligence/types";

/**
 * Provider boundary for seller identity checks.
 * Smile ID is the current provider. A replacement implements verifySellerIdentity
 * and returns the same IdentityOutcome, including decision and confidence.
 *
 * Zimbabwe's ID-number product has no photo on file. A face match therefore
 * compares the selfie with the photo on the National ID, which is Smile ID
 * document verification. A Clear result also requires a liveness sequence.
 */

export type VerificationImage = {
  bytes: Buffer;
  contentType: string;
  fileName: string;
};

export type SellerVerificationInput = {
  idNumber: string;
  fullName: string;
  email: string;
  phone: string;
  jobId: string;
  userId: string;
  nationalId: VerificationImage | null;
  selfie: VerificationImage | null;
  livenessFrames: VerificationImage[];
  pendingJobId?: string | null;
};

type Options = {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  now?: Date;
  sleep?: (ms: number) => Promise<void>;
  attempts?: number;
};

type SmileBody = {
  token?: string;
  access_token?: string;
  status?: string;
  message?: string;
  reason?: string | null;
  job_id?: string;
  error?: string;
  ResultText?: string;
  FullName?: string;
  ConfidenceValue?: string | number;
  confidence?: number;
  id_fields?: { full_name?: string | null };
  result?: SmileBody;
  antifraud?: { fraud_risk?: { risk_score?: number } };
};

const PHOTO_TYPES = new Set(["image/jpeg", "image/png"]);
const TERMINAL = new Set(["clear", "attention", "block", "error"]);

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function toE164(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) {
    return /^\+[1-9]\d{6,14}$/.test(trimmed.replace(/\s/g, "")) ? trimmed.replace(/\s/g, "") : null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (/^0\d{8,10}$/.test(digits)) return `+263${digits.slice(1)}`;
  if (/^263\d{8,10}$/.test(digits)) return `+${digits}`;
  return null;
}

function splitName(fullName: string): { givenNames: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { givenNames: "Seller", lastName: "Seller" };
  if (parts.length === 1) return { givenNames: parts[0], lastName: parts[0] };
  return { givenNames: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

function usablePhoto(image: VerificationImage | null): image is VerificationImage {
  return Boolean(image && PHOTO_TYPES.has(image.contentType) && image.bytes.length > 0);
}

function baseOutcome(partial: Omit<IdentityOutcome, "provider"> & { provider?: IdentityOutcome["provider"] }): IdentityOutcome {
  return {
    provider: partial.provider ?? "smile_id",
    status: partial.status,
    decision: partial.decision,
    confidence: partial.confidence ?? null,
    detail: partial.detail,
    reference: partial.reference,
    returnedName: partial.returnedName,
    documentChecked: partial.documentChecked ?? false,
    faceMatch: partial.faceMatch ?? "not_compared",
    liveness: partial.liveness ?? "not_captured",
    pending: partial.pending ?? false,
  };
}

function confidenceFrom(body: SmileBody): number | null {
  const risk = body.antifraud?.fraud_risk?.risk_score;
  if (typeof risk === "number" && Number.isFinite(risk)) return clampScore(100 - risk);
  const explicit = body.confidence ?? body.ConfidenceValue;
  if (typeof explicit === "number" && Number.isFinite(explicit)) return clampScore(explicit <= 1 ? explicit * 100 : explicit);
  if (typeof explicit === "string" && explicit.trim() && Number.isFinite(Number(explicit))) return clampScore(Number(explicit));
  return null;
}

function unwrap(body: SmileBody | null): SmileBody {
  if (!body) return {};
  return body.result && typeof body.result === "object" ? { ...body, ...body.result } : body;
}

/** Maps a finished Smile ID document-verification payload onto Clear, Review, or Fail. */
export function interpretBiometricResult(body: SmileBody | null, enteredName: string, livenessSent: boolean): IdentityOutcome {
  const payload = unwrap(body);
  const providerStatus = (payload.status ?? "").toLowerCase();
  const reason = payload.reason ?? "";
  const returnedName = payload.id_fields?.full_name?.trim() || payload.FullName?.trim() || null;
  const reference = payload.job_id ?? null;
  const message = payload.message?.trim() || payload.ResultText?.trim() || "Smile ID returned no result text.";
  const confidence = confidenceFrom(payload);
  const faceFailed = reason === "face_verification_failed";
  const livenessFailed = reason === "spoof_detected";
  const documentFailed = reason === "document_check_failed" || reason === "unsupported_document";

  if (!TERMINAL.has(providerStatus)) {
    return baseOutcome({
      status: "inconclusive",
      decision: "review",
      confidence,
      detail: "Smile ID accepted the National ID and selfie. The result is not back yet.",
      reference,
      returnedName,
      documentChecked: false,
      faceMatch: "not_compared",
      liveness: livenessSent ? "not_captured" : "not_captured",
      pending: true,
    });
  }

  if (providerStatus === "error") {
    return baseOutcome({
      status: "error",
      decision: "review",
      confidence,
      detail: `Smile ID could not finish the photo check. ${message}`,
      reference,
      returnedName,
      pending: false,
    });
  }

  if (providerStatus === "block" || faceFailed || livenessFailed || documentFailed) {
    return baseOutcome({
      status: "mismatch",
      decision: "fail",
      confidence,
      detail: message,
      reference,
      returnedName,
      documentChecked: !documentFailed,
      faceMatch: faceFailed ? "unmatched" : "matched",
      liveness: livenessFailed ? "failed" : livenessSent ? "passed" : "not_captured",
    });
  }

  if (returnedName && compareNames(enteredName, returnedName) === "mismatch") {
    return baseOutcome({
      status: "mismatch",
      decision: "fail",
      confidence,
      detail: `The name read from the National ID (${returnedName}) does not match the seller.`,
      reference,
      returnedName,
      documentChecked: true,
      faceMatch: "matched",
      liveness: livenessSent ? "passed" : "not_captured",
    });
  }

  if (providerStatus === "attention" || !livenessSent) {
    const livenessNote = livenessSent ? "" : " A full liveness sequence was not captured, so this stays a review.";
    return baseOutcome({
      status: "inconclusive",
      decision: "review",
      confidence,
      detail: `${message}${livenessNote}`,
      reference,
      returnedName,
      documentChecked: true,
      faceMatch: "matched",
      liveness: livenessSent ? "passed" : "not_captured",
    });
  }

  return baseOutcome({
    status: "verified",
    decision: "clear",
    confidence,
    detail: message,
    reference,
    returnedName,
    documentChecked: true,
    faceMatch: "matched",
    liveness: "passed",
  });
}

function reviewFromLookup(outcome: IdentityOutcome, reason: string): IdentityOutcome {
  const decision: IdentityDecision = outcome.status === "mismatch" ? "fail" : "review";
  return {
    ...outcome,
    decision,
    confidence: outcome.confidence ?? null,
    documentChecked: false,
    faceMatch: "not_compared",
    liveness: "not_captured",
    pending: false,
    status: outcome.status === "verified" ? "inconclusive" : outcome.status,
    detail: outcome.status === "verified" ? `${reason} ${outcome.detail}` : outcome.detail || reason,
  };
}

async function smileToken(args: {
  baseUrl: string;
  partnerId: string;
  apiKey: string;
  userId: string;
  jobId: string;
  fetchImpl: typeof fetch;
  now: Date;
}): Promise<string | null> {
  const timestamp = args.now.toISOString();
  const response = await args.fetchImpl(`${args.baseUrl}/v3/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      partner_id: args.partnerId,
      timestamp,
      signature: smileSignature(timestamp, args.partnerId, args.apiKey),
      user_id: args.userId,
      job_id: args.jobId,
      product: "document_verification",
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await response.json().catch(() => null)) as SmileBody | null;
  if (!response.ok) return null;
  return body?.token || body?.access_token || null;
}

function imagePart(image: VerificationImage): Blob {
  const copy = new Uint8Array(image.bytes.byteLength);
  copy.set(image.bytes);
  return new Blob([copy], { type: image.contentType });
}

async function submitDocumentCheck(args: {
  baseUrl: string;
  token: string;
  input: SellerVerificationInput;
  privacyUrl: string;
  callbackUrl: string;
  fetchImpl: typeof fetch;
  now: Date;
}): Promise<{ ok: true; jobId: string } | { ok: false; detail: string }> {
  const name = splitName(args.input.fullName);
  const phone = toE164(args.input.phone);
  const email = args.input.email.trim();
  const userDetails: Record<string, string> = { given_names: name.givenNames, last_name: name.lastName };
  if (email.includes("@")) userDetails.email = email;
  if (phone) userDetails.phone_number = phone;
  if (!userDetails.email && !userDetails.phone_number) {
    return { ok: false, detail: "Smile ID needs an email or a phone number in international format before it can check the photos." };
  }
  const form = new FormData();
  form.set("country", "ZW");
  form.set("id_type", "NATIONAL_ID");
  form.set("user_id", args.input.userId);
  form.set("partner_params", JSON.stringify({ job_id: args.input.jobId, job_type: "6" }));
  form.set("user_details", JSON.stringify(userDetails));
  form.set("consent", JSON.stringify({
    granted: true,
    granted_at: args.now.toISOString(),
    notice_language: "EN",
    notice_privacy_policy_url: args.privacyUrl,
  }));
  if (args.callbackUrl) form.set("callback_url", args.callbackUrl);
  if (args.input.nationalId) form.set("document", imagePart(args.input.nationalId), args.input.nationalId.fileName);
  if (args.input.selfie) form.set("selfie_image", imagePart(args.input.selfie), args.input.selfie.fileName);
  for (const frame of args.input.livenessFrames) form.append("liveness_images", imagePart(frame), frame.fileName);
  const response = await args.fetchImpl(`${args.baseUrl}/v3/document_verification`, {
    method: "POST",
    headers: { "SmileID-Token": args.token },
    body: form,
    signal: AbortSignal.timeout(45_000),
  });
  const body = (await response.json().catch(() => null)) as SmileBody | null;
  if (!response.ok || !body?.job_id) {
    return { ok: false, detail: body?.message || body?.error || `Smile ID returned ${response.status} for the photo check.` };
  }
  return { ok: true, jobId: body.job_id };
}

async function pollJob(args: {
  baseUrl: string;
  token: string;
  jobId: string;
  enteredName: string;
  livenessSent: boolean;
  fetchImpl: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  attempts: number;
}): Promise<IdentityOutcome> {
  for (let attempt = 0; attempt < args.attempts; attempt += 1) {
    const response = await args.fetchImpl(`${args.baseUrl}/v3/status/${encodeURIComponent(args.jobId)}`, {
      headers: { "SmileID-Token": args.token },
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await response.json().catch(() => null)) as SmileBody | null;
    if (response.ok && body) {
      const interpreted = interpretBiometricResult({ ...body, job_id: body.job_id || args.jobId }, args.enteredName, args.livenessSent);
      if (!interpreted.pending) return interpreted;
    }
    if (attempt < args.attempts - 1) await args.sleep(1500);
  }
  return baseOutcome({
    status: "inconclusive",
    decision: "review",
    confidence: null,
    detail: "Smile ID is still comparing the National ID photo with the selfie. Run the check again in a minute.",
    reference: args.jobId,
    returnedName: null,
    pending: true,
  });
}

/**
 * Checks the seller with Smile ID when credentials exist.
 * Photos are sent only when the National ID and selfie are JPEG or PNG and a privacy-policy URL is configured.
 * Without those, the ID number is looked up and the result stays Review, because no face was compared.
 */
export async function verifySellerIdentity(input: SellerVerificationInput, options: Options = {}): Promise<IdentityOutcome> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const partnerId = env.SMILE_ID_PARTNER_ID?.trim();
  const apiKey = env.SMILE_ID_API_KEY?.trim();
  if (!partnerId || !apiKey) {
    return baseOutcome({
      provider: "unconfigured",
      status: "not_configured",
      decision: "review",
      confidence: null,
      detail: "Smile ID is not configured. Set SMILE_ID_PARTNER_ID and SMILE_ID_API_KEY before treating identity as checked.",
      reference: null,
      returnedName: null,
    });
  }

  const baseUrl = (env.SMILE_ID_BASE_URL?.trim() || "https://testapi.smileidentity.com").replace(/\/$/, "");
  const privacyUrl = env.SMILE_ID_PRIVACY_POLICY_URL?.trim() || "";
  const callbackUrl = env.SMILE_ID_CALLBACK_URL?.trim() || "";
  const livenessFrames = input.livenessFrames.filter((frame) => usablePhoto(frame)).slice(0, 8);
  const canSendPhotos = usablePhoto(input.nationalId) && usablePhoto(input.selfie) && privacyUrl.startsWith("https://") && livenessFrames.length >= 6;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const attempts = options.attempts ?? 4;

  const lookup = () => verifyIdentity(
    { idNumber: input.idNumber, fullName: input.fullName, jobId: input.jobId, userId: input.userId },
    { env, fetchImpl, now }
  );

  if (!canSendPhotos && !input.pendingJobId) {
    const reason = !usablePhoto(input.nationalId) || !usablePhoto(input.selfie)
      ? "The National ID photo and a JPEG or PNG selfie were not both on the file."
      : livenessFrames.length < 6
        ? "A liveness sequence of 6 images was not captured."
        : "Set SMILE_ID_PRIVACY_POLICY_URL before sending the National ID photo and selfie to Smile ID.";
    try {
      return reviewFromLookup(await lookup(), reason);
    } catch (error) {
      const message = error instanceof Error ? error.message : "request failed";
      return baseOutcome({
        status: "error",
        decision: "review",
        confidence: null,
        detail: `Smile ID could not be reached. ${message}`,
        reference: null,
        returnedName: null,
      });
    }
  }

  try {
    const token = await smileToken({ baseUrl, partnerId, apiKey, userId: input.userId, jobId: input.jobId, fetchImpl, now });
    if (!token) {
      return reviewFromLookup(await lookup(), "Smile ID did not issue a token for the photo check.");
    }
    if (input.pendingJobId) {
      return pollJob({
        baseUrl,
        token,
        jobId: input.pendingJobId,
        enteredName: input.fullName,
        livenessSent: true,
        fetchImpl,
        sleep,
        attempts: 1,
      });
    }
    if (!canSendPhotos) {
      return reviewFromLookup(await lookup(), "The photo check is still open, and a new liveness sequence was not captured.");
    }
    const submitted = await submitDocumentCheck({
      baseUrl,
      token,
      input: { ...input, livenessFrames },
      privacyUrl,
      callbackUrl,
      fetchImpl,
      now,
    });
    if (!submitted.ok) return reviewFromLookup(await lookup(), submitted.detail);
    return pollJob({
      baseUrl,
      token,
      jobId: submitted.jobId,
      enteredName: input.fullName,
      livenessSent: true,
      fetchImpl,
      sleep,
      attempts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    return baseOutcome({
      status: "error",
      decision: "review",
      confidence: null,
      detail: `Smile ID could not be reached. ${message}`,
      reference: null,
      returnedName: null,
    });
  }
}
