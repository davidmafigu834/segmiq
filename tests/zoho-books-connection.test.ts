import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { zohoBooksGet, ZohoBooksRequestError } from "../lib/zoho-books/http";
import {
  accessTokenNeedsRefresh,
  ACCESS_REFRESH_SKEW_MS,
  buildAuthorizeUrl,
  buildTokenRequest,
  evaluateOAuthState,
  omitSecrets,
  parseCustomerPreview,
  parseItemPreview,
  ZOHO_BOOKS_READ_SCOPES,
  ZOHO_BOOKS_SCOPE_PARAM,
} from "../lib/zoho-books/protocol";
import { resolveZohoRegion } from "../lib/zoho-books/regions";
import { decideOrganisationSelection } from "../lib/zoho-books/selection";
import { SETTINGS_SECTIONS } from "../lib/settings/company-settings-config";

const session = { userId: "user-1", clientId: "company-1", sessionId: "session-1" };
const future = new Date(Date.now() + 60_000).toISOString();
const past = new Date(Date.now() - 60_000).toISOString();

describe("zoho books oauth state", () => {
  const record = {
    userId: "user-1",
    clientId: "company-1",
    sessionId: "session-1",
    expiresAt: future,
    consumedAt: null,
  };

  it("accepts the initiating user, company and session", () => {
    assert.deepEqual(evaluateOAuthState({ record, now: Date.now(), session }), { ok: true });
  });

  it("rejects a replayed state", () => {
    const decision = evaluateOAuthState({
      record: { ...record, consumedAt: new Date().toISOString() },
      now: Date.now(),
      session,
    });
    assert.deepEqual(decision, { ok: false, reason: "replay" });
  });

  it("rejects a different user, company or session", () => {
    const wrongUser = evaluateOAuthState({ record, now: Date.now(), session: { ...session, userId: "other" } });
    const wrongCompany = evaluateOAuthState({ record, now: Date.now(), session: { ...session, clientId: "company-2" } });
    const wrongSession = evaluateOAuthState({ record, now: Date.now(), session: { ...session, sessionId: "session-2" } });
    assert.equal(wrongUser.ok, false);
    assert.equal(wrongCompany.ok, false);
    assert.equal(wrongSession.ok, false);
    if (wrongUser.ok || wrongCompany.ok || wrongSession.ok) return;
    assert.equal(wrongUser.reason, "wrong_user");
    assert.equal(wrongCompany.reason, "wrong_company");
    assert.equal(wrongSession.reason, "wrong_session");
  });

  it("rejects an expired or missing state", () => {
    const expired = evaluateOAuthState({ record: { ...record, expiresAt: past }, now: Date.now(), session });
    const missing = evaluateOAuthState({ record: null, now: Date.now(), session });
    assert.equal(expired.ok, false);
    assert.equal(missing.ok, false);
    if (!expired.ok) assert.equal(expired.reason, "expired");
    if (!missing.ok) assert.equal(missing.reason, "missing");
  });
});

describe("zoho books regions", () => {
  it("accepts the Europe accounts and API hosts together", () => {
    const region = resolveZohoRegion({
      accountsServer: "https://accounts.zoho.eu",
      apiDomain: "https://www.zohoapis.eu",
      location: "eu",
    });
    assert.equal(region?.location, "eu");
  });

  it("rejects an arbitrary callback host before any credential is sent", () => {
    assert.equal(resolveZohoRegion({ accountsServer: "https://evil.example" }), null);
    assert.equal(resolveZohoRegion({ accountsServer: "https://accounts.zoho.eu.evil.com" }), null);
    assert.equal(
      resolveZohoRegion({ accountsServer: "https://accounts.zoho.eu", location: "us" }),
      null
    );
    assert.equal(buildTokenRequest("https://evil.example", { grant_type: "authorization_code" }), null);
  });
});

describe("zoho books oauth request", () => {
  it("asks only for the read scopes, with an offline code grant", () => {
    assert.deepEqual([...ZOHO_BOOKS_READ_SCOPES], [
      "ZohoBooks.settings.READ",
      "ZohoBooks.contacts.READ",
      "ZohoBooks.invoices.READ",
    ]);
    assert.equal(ZOHO_BOOKS_SCOPE_PARAM.includes(".ALL"), false);
    assert.equal(ZOHO_BOOKS_SCOPE_PARAM.includes("CREATE"), false);
    assert.equal(ZOHO_BOOKS_SCOPE_PARAM.includes("estimates"), false);
    assert.equal(ZOHO_BOOKS_SCOPE_PARAM.includes("customerpayments"), false);
    const url = buildAuthorizeUrl({
      accountsServer: "https://accounts.zoho.eu",
      clientId: "client-id",
      redirectUri: "https://www.segmiq.com/api/integrations/zoho-books/oauth/callback",
      state: "state-1",
    });
    assert.ok(url);
    const parsed = new URL(url!);
    assert.equal(parsed.searchParams.get("response_type"), "code");
    assert.equal(parsed.searchParams.get("access_type"), "offline");
    assert.equal(parsed.searchParams.get("prompt"), "consent");
    assert.equal(parsed.searchParams.get("scope"), ZOHO_BOOKS_SCOPE_PARAM);
    assert.equal(parsed.searchParams.get("client_secret"), null);
  });

  it("exchanges the code with POST query parameters on the allowlisted accounts host", () => {
    const request = buildTokenRequest("https://accounts.zoho.eu/", {
      grant_type: "authorization_code",
      client_id: "client-id",
      client_secret: "secret-value",
      redirect_uri: "https://www.segmiq.com/api/integrations/zoho-books/oauth/callback",
      code: "one-time-code",
    });
    assert.equal(request?.method, "POST");
    const parsed = new URL(request!.url);
    assert.equal(parsed.origin, "https://accounts.zoho.eu");
    assert.equal(parsed.pathname, "/oauth/v2/token");
    assert.equal(parsed.searchParams.get("grant_type"), "authorization_code");
    assert.equal(parsed.searchParams.get("code"), "one-time-code");
  });
});

describe("zoho books organisation selection", () => {
  const authorised = [
    { id: "org-1", name: "First Books" },
    { id: "org-2", name: "Second Books" },
  ];

  it("does not accept an organisation that was not returned", () => {
    assert.equal(
      decideOrganisationSelection({
        requestedId: "org-1",
        authorised: [],
        currentId: null,
        confirmChange: false,
        claimedByOtherCompany: false,
      }).ok,
      false
    );
  });

  it("requires an explicit choice and a confirmation before switching", () => {
    const selected = decideOrganisationSelection({
      requestedId: "org-2",
      authorised,
      currentId: null,
      confirmChange: false,
      claimedByOtherCompany: false,
    });
    assert.deepEqual(selected, { ok: true, name: "Second Books", changed: false });
    const change = decideOrganisationSelection({
      requestedId: "org-2",
      authorised,
      currentId: "org-1",
      confirmChange: false,
      claimedByOtherCompany: false,
    });
    assert.deepEqual(change, { ok: false, reason: "change_confirmation_required" });
    const confirmed = decideOrganisationSelection({
      requestedId: "org-2",
      authorised,
      currentId: "org-1",
      confirmChange: true,
      claimedByOtherCompany: false,
    });
    assert.deepEqual(confirmed, { ok: true, name: "Second Books", changed: true });
  });

  it("rejects an organisation reserved by another company", () => {
    const reserved = decideOrganisationSelection({
      requestedId: "org-1",
      authorised,
      currentId: null,
      confirmChange: false,
      claimedByOtherCompany: true,
    });
    assert.equal(reserved.ok, false);
    if (!reserved.ok) assert.equal(reserved.reason, "claimed_by_other_company");
  });
});

describe("zoho books token and preview handling", () => {
  it("refreshes ahead of expiry and reuses a still-valid token", () => {
    const now = Date.now();
    assert.equal(accessTokenNeedsRefresh(new Date(now + ACCESS_REFRESH_SKEW_MS).toISOString(), now), true);
    assert.equal(accessTokenNeedsRefresh(new Date(now + ACCESS_REFRESH_SKEW_MS + 5_000).toISOString(), now), false);
    assert.equal(accessTokenNeedsRefresh(null, now), true);
  });

  it("removes credential fields from a connection payload", () => {
    const safe = omitSecrets({
      status: "connected",
      access_token: "secret-access",
      refresh_token: "secret-refresh",
      client_secret: "secret-client",
      access_token_sealed: "sealed",
      organization_name: "Wood example",
    });
    assert.equal("access_token" in safe, false);
    assert.equal("refresh_token" in safe, false);
    assert.equal("client_secret" in safe, false);
    assert.equal(safe.organization_name, "Wood example");
  });

  it("previews at most five customers and skips vendors", () => {
    const contacts = Array.from({ length: 7 }, (_, index) => ({
      contact_id: String(index),
      contact_name: `Customer ${index}`,
      contact_type: index === 0 ? "vendor" : "customer",
    }));
    const preview = parseCustomerPreview({ contacts }, 5);
    assert.equal(preview.length, 5);
    assert.equal(preview.some((row) => row.name === "Customer 0"), false);
  });

  it("previews at most five items", () => {
    const items = Array.from({ length: 8 }, (_, index) => ({ item_id: String(index), name: `Item ${index}` }));
    assert.equal(parseItemPreview({ items }, 5).length, 5);
  });

  it("sends the Zoho OAuth header only to an allowlisted Books host", async () => {
    let called = false;
    await assert.rejects(
      () =>
        zohoBooksGet({
          apiDomain: "https://evil.example",
          accessToken: "token-value",
          path: "/books/v3/organizations",
          fetchImpl: async () => {
            called = true;
            throw new Error("must not be called");
          },
        }),
      (error: unknown) => error instanceof ZohoBooksRequestError
    );
    assert.equal(called, false);

    let header = "";
    let requestUrl = "";
    await zohoBooksGet({
      apiDomain: "https://www.zohoapis.eu",
      accessToken: "token-value",
      path: "/books/v3/organizations",
      fetchImpl: async (input, init) => {
        requestUrl = String(input);
        header = new Headers(init?.headers).get("authorization") ?? "";
        return new Response(JSON.stringify({ organizations: [] }), { status: 200 });
      },
    });
    assert.equal(header, "Zoho-oauthtoken token-value");
    assert.equal(requestUrl.includes("token-value"), false);
    assert.equal(new URL(requestUrl).origin, "https://www.zohoapis.eu");
  });
});

describe("zoho books settings placement", () => {
  it("adds Zoho Books under company integration settings", () => {
    assert.equal(SETTINGS_SECTIONS.integrations.some((section) => section.id === "zoho-books"), true);
  });
});
