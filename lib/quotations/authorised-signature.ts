export function generateAuthorisedSignatureKey(clientId: string): string {
  return `clients/${clientId}/quotations/signature/${Date.now()}.png`;
}

export function isPngSignature(contentType: string | null | undefined): boolean {
  return (contentType ?? "").toLowerCase().split(";")[0].trim() === "image/png";
}

export const AUTHORISED_SIGNATURE_MAX_BYTES = 400_000;
