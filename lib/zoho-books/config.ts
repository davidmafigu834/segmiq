import "server-only";
import { regionByAccounts } from "./regions";

export type ZohoBooksConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accountsUrl: string;
};

function encryptionKeyReady(): boolean {
  const raw = process.env.WHATSAPP_SESSION_ENCRYPTION_KEY?.trim();
  if (!raw) return false;
  if (/^[a-f0-9]{64}$/i.test(raw)) return true;
  try {
    return Buffer.from(raw, "base64").length === 32;
  } catch {
    return false;
  }
}

export function zohoBooksMissingConfig(): string[] {
  const missing: string[] = [];
  if (!process.env.ZOHO_BOOKS_CLIENT_ID?.trim()) missing.push("ZOHO_BOOKS_CLIENT_ID");
  if (!process.env.ZOHO_BOOKS_CLIENT_SECRET?.trim()) missing.push("ZOHO_BOOKS_CLIENT_SECRET");
  if (!process.env.ZOHO_BOOKS_REDIRECT_URI?.trim()) missing.push("ZOHO_BOOKS_REDIRECT_URI");
  const accounts = process.env.ZOHO_BOOKS_ACCOUNTS_URL?.trim();
  if (!accounts || !regionByAccounts(accounts)) missing.push("ZOHO_BOOKS_ACCOUNTS_URL");
  if (!encryptionKeyReady()) missing.push("WHATSAPP_SESSION_ENCRYPTION_KEY");
  return missing;
}

export function readZohoBooksConfig(): ZohoBooksConfig | null {
  if (zohoBooksMissingConfig().length > 0) return null;
  const accounts = process.env.ZOHO_BOOKS_ACCOUNTS_URL!.trim();
  const region = regionByAccounts(accounts);
  if (!region) return null;
  return {
    clientId: process.env.ZOHO_BOOKS_CLIENT_ID!.trim(),
    clientSecret: process.env.ZOHO_BOOKS_CLIENT_SECRET!.trim(),
    redirectUri: process.env.ZOHO_BOOKS_REDIRECT_URI!.trim(),
    accountsUrl: region.accounts,
  };
}
