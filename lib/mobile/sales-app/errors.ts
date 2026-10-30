import { NextResponse } from "next/server";

/**
 * Stable error codes for the SegmiQ Sales mobile contract.
 * Edge-safe: imported by middleware. Codes are part of the public Android
 * contract — add new codes, never rename or repurpose existing ones.
 */
export const MOBILE_API_ERROR_CODES = [
  "INVALID_REQUEST",
  "INVALID_CREDENTIALS",
  "RATE_LIMITED",
  "MFA_VERIFICATION_FAILED",
  "MFA_REQUIRED",
  "MFA_ENROLMENT_REQUIRED",
  "TOKEN_INVALID",
  "TOKEN_EXPIRED",
  "SESSION_EXPIRED",
  "SESSION_REVOKED",
  "ACCOUNT_DISABLED",
  "INSUFFICIENT_ROLE",
  "NO_ORGANISATION",
  "ORGANISATION_SUSPENDED",
  "SUBSCRIPTION_SUSPENDED",
  "UNSUPPORTED_SESSION",
  "SERVICE_UNAVAILABLE",
  "SERVER_MISCONFIGURED",
] as const;

export type MobileApiErrorCode = (typeof MOBILE_API_ERROR_CODES)[number];

export const MOBILE_API_ERROR_STATUS: Record<MobileApiErrorCode, number> = {
  INVALID_REQUEST: 400,
  INVALID_CREDENTIALS: 401,
  RATE_LIMITED: 429,
  MFA_VERIFICATION_FAILED: 401,
  MFA_REQUIRED: 403,
  MFA_ENROLMENT_REQUIRED: 403,
  TOKEN_INVALID: 401,
  TOKEN_EXPIRED: 401,
  SESSION_EXPIRED: 401,
  SESSION_REVOKED: 401,
  ACCOUNT_DISABLED: 401,
  INSUFFICIENT_ROLE: 403,
  NO_ORGANISATION: 403,
  ORGANISATION_SUSPENDED: 403,
  SUBSCRIPTION_SUSPENDED: 402,
  UNSUPPORTED_SESSION: 403,
  SERVICE_UNAVAILABLE: 503,
  SERVER_MISCONFIGURED: 500,
};

const DEFAULT_MESSAGES: Record<MobileApiErrorCode, string> = {
  INVALID_REQUEST: "The request was not valid.",
  INVALID_CREDENTIALS: "Invalid email or password.",
  RATE_LIMITED: "Too many attempts. Wait a few minutes and try again.",
  MFA_VERIFICATION_FAILED: "The verification code was not accepted.",
  MFA_REQUIRED: "Confirm two-step verification for this session.",
  MFA_ENROLMENT_REQUIRED: "Set up two-step verification on the SegmiQ website before using the app.",
  TOKEN_INVALID: "Sign in again.",
  TOKEN_EXPIRED: "Your session has expired. Sign in again.",
  SESSION_EXPIRED: "Your session has expired. Sign in again.",
  SESSION_REVOKED: "This session was signed out. Sign in again.",
  ACCOUNT_DISABLED: "This account is disabled. Contact your administrator.",
  INSUFFICIENT_ROLE: "Segmiq Sales is for salesperson and selling manager accounts only.",
  NO_ORGANISATION: "Your account is not linked to a client.",
  ORGANISATION_SUSPENDED: "Your organisation's SegmiQ access is suspended. Contact your administrator.",
  SUBSCRIPTION_SUSPENDED:
    "Your organisation's SegmiQ subscription is suspended. Sales features are unavailable until billing is resolved.",
  UNSUPPORTED_SESSION: "This session type cannot use the SegmiQ Sales app.",
  SERVICE_UNAVAILABLE: "SegmiQ is temporarily unavailable. Try again shortly.",
  SERVER_MISCONFIGURED: "SegmiQ is temporarily unavailable. Try again shortly.",
};

export type MobileApiErrorBody = {
  /** Legacy human-readable or legacy-code string kept for existing clients. */
  error: string;
  code: MobileApiErrorCode;
  message: string;
} & Record<string, unknown>;

export function mobileApiErrorBody(
  code: MobileApiErrorCode,
  opts: { error?: string; message?: string; extra?: Record<string, unknown> } = {}
): MobileApiErrorBody {
  return {
    ...(opts.extra ?? {}),
    error: opts.error ?? code,
    code,
    message: opts.message ?? DEFAULT_MESSAGES[code],
  };
}

/**
 * `error` stays backward compatible (existing clients read it); `code` is the
 * stable machine-readable value Android must branch on.
 */
export function mobileApiError(
  code: MobileApiErrorCode,
  opts: {
    error?: string;
    message?: string;
    status?: number;
    extra?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {}
): NextResponse {
  return NextResponse.json(mobileApiErrorBody(code, opts), {
    status: opts.status ?? MOBILE_API_ERROR_STATUS[code],
    headers: { "Cache-Control": "no-store", ...(opts.headers ?? {}) },
  });
}
