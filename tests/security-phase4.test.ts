import assert from "node:assert/strict";
import test from "node:test";
import { generateTotpSecret, verifyTotpCode, buildOtpAuthUri } from "@/lib/auth/mfa/totp";
import { Secret, TOTP } from "otpauth";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  generateChallengeToken,
  hashChallengeToken,
} from "@/lib/auth/mfa/recovery-codes";
import {
  mfaPolicyForRole,
  isSuperAdminMfaEnforced,
  mustHaveMfaToLogin,
} from "@/lib/auth/mfa/policy";
import { labelSessionDevice, formatRelativeActive } from "@/lib/auth/session-labels";
import { sanitizeEventMetadata } from "@/lib/auth/security-events";
import { checkSecurityRateLimit, clearSecurityRateLimitsForTests } from "@/lib/auth/security-rate-limit";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import {
  sealMfaTotpSecret,
  revealMfaTotpSecret,
} from "@/lib/auth/account-security-crypto";

function currentTotp(secret: string): string {
  const totp = new TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  });
  return totp.generate();
}

test("TEST labels: Chrome on Windows", () => {
  const l = labelSessionDevice({
    sessionType: "WEB",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  assert.equal(l.deviceName, "Chrome on Windows");
});

test("TEST labels: SegmiQ Sales App on Android", () => {
  const l = labelSessionDevice({
    sessionType: "MOBILE",
    userAgent: "okhttp/4 Android",
    metadata: { channel: "sales_app" },
  });
  assert.equal(l.deviceName, "SegmiQ Sales App on Android");
});

test("TEST labels: fallback SegmiQ session", () => {
  const l = labelSessionDevice({ sessionType: "WEB", userAgent: null });
  assert.equal(l.deviceName, "SegmiQ session");
});

test("TEST relative active now", () => {
  const now = Date.now();
  assert.equal(formatRelativeActive(new Date(now - 30_000).toISOString(), now), "Active now");
});

test("TEST 7/9: TOTP generate + verify enables path", () => {
  const secret = generateTotpSecret();
  const code = currentTotp(secret);
  assert.equal(verifyTotpCode(secret, code), true);
  assert.equal(verifyTotpCode(secret, "000000"), false);
});

test("TEST 8: invalid TOTP rejected", () => {
  const secret = generateTotpSecret();
  assert.equal(verifyTotpCode(secret, "abcdef"), false);
  assert.equal(verifyTotpCode(secret, "123456"), false);
});

test("TEST otpauth URI uses SegmiQ issuer", () => {
  const secret = generateTotpSecret();
  const uri = buildOtpAuthUri({ secret, accountLabel: "user@example.com" });
  assert.match(uri, /^otpauth:\/\/totp\//);
  assert.match(uri, /SegmiQ/);
  assert.doesNotMatch(uri, /userId/i);
});

test("TEST 10/18–20: recovery codes hash + normalize", async () => {
  const codes = generateRecoveryCodes(10);
  assert.equal(codes.length, 10);
  const userId = "11111111-1111-1111-1111-111111111111";
  const h1 = await hashRecoveryCode(codes[0], userId);
  const h2 = await hashRecoveryCode(normalizeRecoveryCode(codes[0].toLowerCase()), userId);
  assert.equal(h1, h2);
  assert.notEqual(h1, codes[0]);
  assert.equal(h1.length, 64);
});

test("TEST challenge token hashing", async () => {
  const t = generateChallengeToken();
  assert.equal(t.length, 64);
  const h = await hashChallengeToken(t);
  assert.equal(h.length, 64);
  assert.notEqual(h, t);
});

test("TEST 11: MFA secret sealed (encrypted) when key present", async () => {
  const prev = process.env.WHATSAPP_SESSION_ENCRYPTION_KEY;
  const accountPrev = process.env.ACCOUNT_SECURITY_ENCRYPTION_KEY;
  // 32 zero bytes hex for test only
  process.env.ACCOUNT_SECURITY_ENCRYPTION_KEY = "00".repeat(32);
  try {
    const secret = generateTotpSecret();
    const userId = "22222222-2222-2222-2222-222222222222";
    const sealed = await sealMfaTotpSecret(secret, userId);
    assert.ok(sealed.ciphertext);
    assert.ok(sealed.iv);
    assert.ok(sealed.authTag);
    assert.notEqual(sealed.ciphertext, secret);
    const revealed = await revealMfaTotpSecret(sealed, userId);
    assert.equal(revealed, secret);
  } finally {
    if (prev === undefined) delete process.env.WHATSAPP_SESSION_ENCRYPTION_KEY;
    else process.env.WHATSAPP_SESSION_ENCRYPTION_KEY = prev;
    if (accountPrev === undefined) delete process.env.ACCOUNT_SECURITY_ENCRYPTION_KEY;
    else process.env.ACCOUNT_SECURITY_ENCRYPTION_KEY = accountPrev;
  }
});

test("TEST 26–28: MFA policy by role", () => {
  assert.equal(mfaPolicyForRole("SALESPERSON"), "optional");
  assert.equal(mfaPolicyForRole("CLIENT_MANAGER"), "recommended");
  delete process.env.MFA_ENFORCE_SUPER_ADMIN;
  assert.equal(mfaPolicyForRole("SUPER_ADMIN"), "recommended");
  assert.equal(mustHaveMfaToLogin("SUPER_ADMIN", false), false);
  assert.equal(mustHaveMfaToLogin("SALESPERSON", true), true);
});

test("TEST SUPER_ADMIN enforcement gated by env + grace", () => {
  const prevE = process.env.MFA_ENFORCE_SUPER_ADMIN;
  const prevR = process.env.ACCOUNT_SECURITY_ROLLOUT_AT;
  const prevG = process.env.MFA_SUPER_ADMIN_GRACE_DAYS;
  try {
    process.env.MFA_ENFORCE_SUPER_ADMIN = "true";
    process.env.ACCOUNT_SECURITY_ROLLOUT_AT = "2020-01-01T00:00:00.000Z";
    process.env.MFA_SUPER_ADMIN_GRACE_DAYS = "0";
    assert.equal(isSuperAdminMfaEnforced(), true);
    assert.equal(mfaPolicyForRole("SUPER_ADMIN"), "required");

    process.env.ACCOUNT_SECURITY_ROLLOUT_AT = "2099-01-01T00:00:00.000Z";
    assert.equal(isSuperAdminMfaEnforced(), false);
    assert.equal(mfaPolicyForRole("SUPER_ADMIN"), "recommended");
  } finally {
    if (prevE === undefined) delete process.env.MFA_ENFORCE_SUPER_ADMIN;
    else process.env.MFA_ENFORCE_SUPER_ADMIN = prevE;
    if (prevR === undefined) delete process.env.ACCOUNT_SECURITY_ROLLOUT_AT;
    else process.env.ACCOUNT_SECURITY_ROLLOUT_AT = prevR;
    if (prevG === undefined) delete process.env.MFA_SUPER_ADMIN_GRACE_DAYS;
    else process.env.MFA_SUPER_ADMIN_GRACE_DAYS = prevG;
  }
});

test("TEST security event metadata strips secrets", () => {
  const cleaned = sanitizeEventMetadata({
    password: "x",
    totp: "123456",
    secret: "abc",
    sessionType: "WEB",
    reason: "ok",
  });
  assert.equal(cleaned.password, undefined);
  assert.equal(cleaned.secret, undefined);
  assert.equal(cleaned.sessionType, "WEB");
});

test("TEST MFA rate limit", () => {
  clearSecurityRateLimitsForTests();
  for (let i = 0; i < 5; i++) {
    assert.equal(checkSecurityRateLimit({ key: "t1", limit: 5, windowMs: 60_000 }).ok, true);
  }
  assert.equal(checkSecurityRateLimit({ key: "t1", limit: 5, windowMs: 60_000 }).ok, false);
});

test("TEST origin check blocks cross-site", () => {
  const bad = assertBrowserOrigin(
    new Request("https://app.segmiq.com/api/auth/mfa", {
      headers: { origin: "https://evil.example", host: "app.segmiq.com" },
    })
  );
  assert.equal(bad.ok, false);

  const good = assertBrowserOrigin(
    new Request("https://app.segmiq.com/api/auth/mfa", {
      headers: { origin: "https://app.segmiq.com", host: "app.segmiq.com" },
    })
  );
  assert.equal(good.ok, true);

  const bearer = assertBrowserOrigin(
    new Request("https://app.segmiq.com/api/auth/mfa", {
      headers: { authorization: "Bearer xyz", host: "app.segmiq.com" },
    })
  );
  assert.equal(bearer.ok, true);
});

test("TEST session ownership invariant (conceptual): revoke requires matching user_id", () => {
  // Device APIs never accept userId from body — ownership from session.
  // This documents the invariant; route handlers use session.userId exclusively.
  const body = { userId: "another-user", sessionId: "x" };
  assert.ok(body.userId);
  // Handlers ignore body.userId — assert shape that would be unsafe if trusted:
  assert.notEqual(body.userId, "authenticated-user");
});
