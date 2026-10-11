/**
 * Official Zoho Books regions.
 * Accounts hosts and API hosts come from Zoho's Books introduction and OAuth
 * multi-DC notes. The OAuth page's sample table lists Billing URLs; those are
 * not used here.
 * https://www.zoho.com/books/api/v3/introduction/
 * https://www.zoho.com/books/api/v3/oauth/
 */

export type ZohoLocation = "us" | "eu" | "in" | "au" | "jp" | "ca" | "cn" | "sa" | "ae";

export type ZohoRegion = {
  location: ZohoLocation;
  label: string;
  accounts: string;
  api: string;
};

export const ZOHO_BOOKS_REGIONS: readonly ZohoRegion[] = [
  { location: "us", label: "United States", accounts: "https://accounts.zoho.com", api: "https://www.zohoapis.com" },
  { location: "eu", label: "Europe", accounts: "https://accounts.zoho.eu", api: "https://www.zohoapis.eu" },
  { location: "in", label: "India", accounts: "https://accounts.zoho.in", api: "https://www.zohoapis.in" },
  { location: "au", label: "Australia", accounts: "https://accounts.zoho.com.au", api: "https://www.zohoapis.com.au" },
  { location: "jp", label: "Japan", accounts: "https://accounts.zoho.jp", api: "https://www.zohoapis.jp" },
  { location: "ca", label: "Canada", accounts: "https://accounts.zoho.ca", api: "https://www.zohoapis.ca" },
  { location: "cn", label: "China", accounts: "https://accounts.zoho.com.cn", api: "https://www.zohoapis.com.cn" },
  { location: "sa", label: "Saudi Arabia", accounts: "https://accounts.zoho.sa", api: "https://www.zohoapis.sa" },
  { location: "ae", label: "United Arab Emirates", accounts: "https://accounts.zoho.ae", api: "https://www.zohoapis.ae" },
] as const;

function originOf(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    if (url.pathname !== "/" && url.pathname !== "") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function regionByAccounts(raw: string | null | undefined): ZohoRegion | null {
  const origin = originOf(raw);
  if (!origin) return null;
  return ZOHO_BOOKS_REGIONS.find((region) => region.accounts === origin) ?? null;
}

export function regionByApi(raw: string | null | undefined): ZohoRegion | null {
  const origin = originOf(raw);
  if (!origin) return null;
  return ZOHO_BOOKS_REGIONS.find((region) => region.api === origin) ?? null;
}

export function regionByLocation(raw: string | null | undefined): ZohoRegion | null {
  const location = raw?.trim().toLowerCase();
  if (!location) return null;
  return ZOHO_BOOKS_REGIONS.find((region) => region.location === location) ?? null;
}

/**
 * Accept a Zoho callback only when every supplied region hint is on the
 * allowlist and they all describe the same region. Missing hints are filled
 * from the ones that are present. An unknown host is rejected.
 */
export function resolveZohoRegion(input: {
  accountsServer?: string | null;
  apiDomain?: string | null;
  location?: string | null;
}): ZohoRegion | null {
  const fromAccounts = input.accountsServer ? regionByAccounts(input.accountsServer) : null;
  const fromApi = input.apiDomain ? regionByApi(input.apiDomain) : null;
  const fromLocation = input.location ? regionByLocation(input.location) : null;
  if (input.accountsServer && !fromAccounts) return null;
  if (input.apiDomain && !fromApi) return null;
  if (input.location && !fromLocation) return null;
  const chosen = fromAccounts ?? fromApi ?? fromLocation;
  if (!chosen) return null;
  if (fromAccounts && fromAccounts.location !== chosen.location) return null;
  if (fromApi && fromApi.location !== chosen.location) return null;
  if (fromLocation && fromLocation.location !== chosen.location) return null;
  return chosen;
}
