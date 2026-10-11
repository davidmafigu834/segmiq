import "server-only";
import {
  isSealedIntegrationToken,
  revealIntegrationToken,
  sealIntegrationToken,
  type IntegrationTokenKind,
} from "@/lib/integrations/token-vault";

type ZohoTokenKind = Extract<IntegrationTokenKind, "zoho_books_access" | "zoho_books_refresh">;

export async function sealZohoToken(plaintext: string, kind: ZohoTokenKind, clientId: string): Promise<string> {
  const sealed = await sealIntegrationToken(plaintext, kind, clientId);
  if (!isSealedIntegrationToken(sealed)) {
    throw new Error("Zoho token sealing failed");
  }
  return sealed;
}

/** Sealed envelopes only. Plaintext tokens are refused. */
export async function revealZohoToken(
  stored: string | null | undefined,
  kind: ZohoTokenKind,
  clientId: string
): Promise<string | null> {
  if (!stored?.trim()) return null;
  if (!isSealedIntegrationToken(stored)) {
    throw new Error("Zoho token is not sealed");
  }
  return revealIntegrationToken(stored, kind, clientId);
}
