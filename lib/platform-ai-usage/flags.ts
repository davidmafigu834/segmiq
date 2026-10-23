function enabled(name: string): boolean {
  return process.env[name] === "true";
}

export const platformAiUsageFlags = {
  shadowObserver: enabled("PLATFORM_AI_USAGE_SHADOW_ENABLED"),
  reporting: enabled("PLATFORM_AI_USAGE_REPORTING_ENABLED"),
  topups: enabled("PLATFORM_AI_TOPUPS_ENABLED"),
  enforcement: enabled("PLATFORM_AI_USAGE_ENFORCEMENT_ENABLED"),
  invoiceLines: enabled("PLATFORM_V2_INVOICE_LINES_ENABLED"),
} as const;

export function shadowClientAllowlist(): ReadonlySet<string> {
  return new Set(
    (process.env.PLATFORM_AI_USAGE_SHADOW_CLIENT_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function canObserveClient(clientId: string): boolean {
  return (
    platformAiUsageFlags.shadowObserver && shadowClientAllowlist().has(clientId)
  );
}
