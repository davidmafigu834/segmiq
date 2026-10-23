export const PLATFORM_SALES_FLAGS = {
  quotes: "PLATFORM_SALES_QUOTES_ENABLED",
  agreements: "PLATFORM_AGREEMENTS_ENABLED",
  activationGate: "PLATFORM_CUSTOMER_ACTIVATION_GATE_ENABLED",
} as const;

export function platformSalesEnabled(
  flag: keyof typeof PLATFORM_SALES_FLAGS,
): boolean {
  return process.env[PLATFORM_SALES_FLAGS[flag]] === "true";
}
