import { quotaBackoff } from "./import-plan";
import { booksUrl } from "./protocol";
import { resolveZohoRegion } from "./regions";

export class ZohoBooksRequestError extends Error {
  readonly quota: boolean;
  readonly retryAfterSeconds: number | null;
  readonly zohoCode: number | null;

  constructor(
    message: string,
    readonly status: number,
    readonly revoked: boolean,
    extra?: { quota?: boolean; retryAfterSeconds?: number | null; zohoCode?: number | null }
  ) {
    super(message);
    this.name = "ZohoBooksRequestError";
    this.quota = extra?.quota === true;
    this.retryAfterSeconds = extra?.retryAfterSeconds ?? null;
    this.zohoCode = extra?.zohoCode ?? null;
  }
}

function zohoCode(body: unknown): number | null {
  if (!body || typeof body !== "object" || !("code" in body)) return null;
  const code = Number((body as { code: unknown }).code);
  return Number.isFinite(code) ? code : null;
}

function retryAfterSeconds(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function quotaMessage(code: number | null): string {
  if (code === 45) return "Zoho Books daily API limit was reached for this organisation.";
  if (code === 44) return "Zoho Books per-minute limit was reached for this organisation.";
  if (code === 1070) return "Zoho Books already has too many requests in progress for this organisation.";
  return "Zoho Books rate limit was reached.";
}

export async function zohoBooksGet(input: {
  apiDomain: string;
  accessToken: string;
  path: string;
  query?: Record<string, string>;
  fetchImpl?: typeof fetch;
}): Promise<unknown> {
  const region = resolveZohoRegion({ apiDomain: input.apiDomain });
  const url = booksUrl(input.apiDomain, input.path, input.query ?? {});
  if (!region || !url || !input.accessToken) {
    throw new ZohoBooksRequestError("Zoho Books region is not supported.", 0, false);
  }
  const response = await (input.fetchImpl ?? fetch)(url, {
    method: "GET",
    cache: "no-store",
    headers: { Authorization: `Zoho-oauthtoken ${input.accessToken}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = zohoCode(body);
    const quota = response.status === 429 || code === 44 || code === 45 || code === 1070;
    const revoked = !quota && (response.status === 401 || response.status === 403);
    throw new ZohoBooksRequestError(
      quota ? quotaMessage(code) : revoked ? "Zoho Books rejected the connection." : "Zoho Books could not be reached.",
      response.status,
      revoked,
      { quota, retryAfterSeconds: retryAfterSeconds(response.headers.get("retry-after")), zohoCode: code }
    );
  }
  return body;
}

export async function zohoBooksGetWithBackoff(
  input: Parameters<typeof zohoBooksGet>[0],
  hooks?: { sleep?: (ms: number) => Promise<void> }
): Promise<unknown> {
  const sleep = hooks?.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let attempt = 0;
  for (;;) {
    try {
      return await zohoBooksGet(input);
    } catch (error) {
      if (!(error instanceof ZohoBooksRequestError) || !error.quota) throw error;
      const decision = quotaBackoff(attempt, error.retryAfterSeconds);
      if (decision.stop) throw error;
      await sleep(decision.retryMs);
      attempt += 1;
    }
  }
}
