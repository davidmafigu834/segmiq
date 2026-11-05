/**
 * Seller intake is off until a deployment sets RE_SELLER_INTAKE to on, true or 1.
 * Agency operations use the opposite default and do not enable this workflow.
 */
export function sellerIntakeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const value = env.RE_SELLER_INTAKE?.trim().toLowerCase();
  return value === "on" || value === "true" || value === "1";
}

export const SELLER_INTAKE_DISABLED_MESSAGE = "Not found";

export function intakePepper(env: Record<string, string | undefined> = process.env): string | null {
  const dedicated = env.SELLER_INTAKE_TOKEN_PEPPER?.trim();
  const fallback = env.NEXTAUTH_SECRET?.trim();
  const value = dedicated || fallback || "";
  return value.length >= 16 ? value : null;
}
