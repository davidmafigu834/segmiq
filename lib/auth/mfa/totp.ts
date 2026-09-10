import { Secret, TOTP } from "otpauth";

export const MFA_ISSUER = "SegmiQ";
export const TOTP_DIGITS = 6;
export const TOTP_PERIOD = 30;
/** ±1 time step clock drift */
export const TOTP_WINDOW = 1;

export function generateTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

export function buildOtpAuthUri(opts: { secret: string; accountLabel: string }): string {
  const totp = new TOTP({
    issuer: MFA_ISSUER,
    label: opts.accountLabel,
    algorithm: "SHA1",
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: Secret.fromBase32(opts.secret),
  });
  return totp.toString();
}

export function verifyTotpCode(secret: string, code: string, nowMs = Date.now()): boolean {
  const normalized = code.replace(/\s+/g, "").trim();
  if (!/^\d{6}$/.test(normalized)) return false;
  const totp = new TOTP({
    issuer: MFA_ISSUER,
    algorithm: "SHA1",
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: Secret.fromBase32(secret),
  });
  const delta = totp.validate({ token: normalized, timestamp: nowMs, window: TOTP_WINDOW });
  return delta !== null;
}
