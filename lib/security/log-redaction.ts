/**
 * Central redaction for logs / error surfaces.
 * Never log tokens, cookies, WhatsApp auth state, or OAuth secrets.
 */

const SECRET_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /EAA[A-Za-z0-9]+/g,
  /("?(?:access_token|refresh_token|api_key|client_secret|authorization|cookie|password|private_key)"?\s*[:=]\s*")[^"]+"/gi,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
  /"ciphertext"\s*:\s*"[^"]+"/gi,
  /x-segmiq-signature[=:]\s*[A-Fa-f0-9]+/gi,
];

export function redactSecrets(input: string, maxLen = 2000): string {
  let out = input;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, (match) => {
      if (match.startsWith("EAA")) return "EAA[REDACTED]";
      if (/Bearer/i.test(match)) return "Bearer [REDACTED]";
      return "[REDACTED]";
    });
  }
  if (out.length > maxLen) out = `${out.slice(0, maxLen)}…`;
  return out;
}

export function redactUnknown(value: unknown): unknown {
  if (typeof value === "string") return redactSecrets(value);
  if (Array.isArray(value)) return value.map(redactUnknown);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/password|token|secret|authorization|cookie|ciphertext|authstate|session/i.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactUnknown(v);
      }
    }
    return out;
  }
  return value;
}

export function safeExternalErrorMessage(fallback = "Integration temporarily unavailable."): string {
  return fallback;
}
