import assert from "node:assert/strict";
import test from "node:test";
import { validateAuthClaims } from "@/lib/auth/session-validation";
import { buildPublicMagicLeadPayload } from "@/lib/leads/public-magic";
import { buildPublicQuotationPayload } from "@/lib/quotations/public-payload";
import { buildPublicProposalPayload } from "@/lib/proposals/public-payload";
import { markConfirmation } from "@/lib/agent/manager/confirmations";
import type { ManagerActor } from "@/lib/agent/manager/types";

test("deactivated web user claims are rejected", async () => {
  const result = await validateAuthClaims(
    {
      userId: "u1",
      role: "CLIENT_MANAGER",
      clientId: "c1",
      alsoSells: false,
      sessionVersion: 4,
    },
    {
      skipSessionRegistry: true,
      fetchUserById: async () => ({
        id: "u1",
        role: "CLIENT_MANAGER",
        client_id: "c1",
        is_active: false,
        session_version: 4,
        also_sells: false,
      }),
    }
  );

  assert.deepEqual(result, { ok: false, reason: "target_inactive" });
});

test("session version bump rejects stale web session claims", async () => {
  const result = await validateAuthClaims(
    {
      userId: "u1",
      role: "CLIENT_MANAGER",
      clientId: "c1",
      alsoSells: false,
      sessionVersion: 4,
    },
    {
      skipSessionRegistry: true,
      fetchUserById: async () => ({
        id: "u1",
        role: "CLIENT_MANAGER",
        client_id: "c1",
        is_active: true,
        session_version: 5,
        also_sells: false,
      }),
    }
  );

  assert.deepEqual(result, { ok: false, reason: "session_version_mismatch" });
});

test("deleted user claims are rejected", async () => {
  const result = await validateAuthClaims(
    {
      userId: "ghost",
      role: "SALESPERSON",
      clientId: "c1",
      alsoSells: false,
      sessionVersion: 1,
    },
    {
      skipSessionRegistry: true,
      fetchUserById: async () => null,
    }
  );

  assert.deepEqual(result, { ok: false, reason: "target_missing" });
});

test("mobile bearer claims require matching sessionVersion", async () => {
  const result = await validateAuthClaims(
    {
      userId: "rep-1",
      role: "SALESPERSON",
      clientId: "c1",
      alsoSells: false,
      sessionVersion: 7,
    },
    {
      skipSessionRegistry: true,
      fetchUserById: async () => ({
        id: "rep-1",
        role: "SALESPERSON",
        client_id: "c1",
        is_active: true,
        session_version: 8,
        also_sells: false,
      }),
    }
  );

  assert.deepEqual(result, { ok: false, reason: "session_version_mismatch" });
});

test("legacy mobile bearer claims without sessionVersion are rejected", async () => {
  const result = await validateAuthClaims(
    {
      userId: "rep-1",
      role: "SALESPERSON",
      clientId: "c1",
      alsoSells: false,
    },
    {
      skipSessionRegistry: true,
      fetchUserById: async () => ({
        id: "rep-1",
        role: "SALESPERSON",
        client_id: "c1",
        is_active: true,
        session_version: 8,
        also_sells: false,
      }),
    }
  );

  assert.deepEqual(result, { ok: false, reason: "missing_session_version" });
});

test("clientId-only public lead submission no longer works", async () => {
  const { POST } = await import("@/app/api/leads/submit/route");
  const response = await POST(
    new Request("http://localhost/api/leads/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: "11111111-1111-1111-1111-111111111111",
        formData: { name: "Mallory" },
        source: "LANDING_PAGE",
      }),
    })
  );

  assert.equal(response.status, 400);
});

test("clientId-only public profile lead submission no longer works", async () => {
  const { POST } = await import("@/app/api/public/submit-lead/route");
  const response = await POST(
    new Request("http://localhost/api/public/submit-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: "22222222-2222-2222-2222-222222222222",
        formData: { name: "Mallory" },
      }),
    })
  );

  assert.equal(response.status, 400);
});

test("public magic payload is explicitly allowlisted", () => {
  const payload = buildPublicMagicLeadPayload({
    id: "lead-1",
    name: "Lead Name",
    phone: "+263700000000",
    email: "lead@example.com",
    source: "WEBSITE",
    status: "NEW",
    budget: "$10,000",
    project_type: "Solar",
    timeline: "Soon",
    form_data: { note: "hello" },
    created_at: "2026-09-09T10:00:00.000Z",
    magic_token_expires_at: "2026-09-10T10:00:00.000Z",
    client_id: "client-1",
    assigned_to_id: "user-1",
    clients: [{ id: "client-1", name: "Client", slug: "client" }],
    assigned_to: [{ id: "user-1", name: "Rep" }],
    call_logs: [],
    internal_notes: "hidden",
    score: 99,
  });

  assert.equal("internal_notes" in payload, false);
  assert.equal("score" in payload, false);
  assert.equal(payload.clients?.slug, "client");
});

test("public quotation payload does not leak internal quote fields", () => {
  const payload = buildPublicQuotationPayload({
    token: "tok",
    quote: {
      id: "q1",
      status: "sent",
      quote_number: "Q-1",
      revision_number: 2,
      customer_name: "Acme",
      currency: "USD",
      valid_until: "2026-09-30",
      sent_at: "2026-09-09T10:00:00.000Z",
      created_at: "2026-09-08T10:00:00.000Z",
      tax_rate: 15,
      other_amount: 0,
      discount_percent: 0,
      notes: "Public note",
      terms: "Public terms",
      pdf_url: "https://example.test/quote.pdf",
      offer_options: [{ id: "o1", label: "Base" }],
      client_id: "hidden-client",
      prepared_by_id: "hidden-user",
      approval_status: "pending",
      margin_amount: 500,
    },
    items: [
      {
        id: "item-1",
        item_name: "Panels",
        description: "Solar panels",
        unit_price: 100,
        quantity: 2,
        amount: 200,
        group_label: null,
        is_optional: false,
      },
    ],
    brand: {
      companyName: "Acme Solar",
      logoUrl: null,
      brandColor: "#0F7A4F",
      companyEmail: null,
      companyPhone: null,
      companyAddress: null,
      footerNote: null,
    },
    customerActions: {
      accept: true,
      requestChanges: true,
      askQuestion: true,
      decline: true,
      optionSelection: true,
      requireName: false,
      requireCheckbox: true,
    },
  });

  assert.equal("client_id" in payload, false);
  assert.equal("prepared_by_id" in payload, false);
  assert.equal("approval_status" in payload, false);
  assert.equal(payload.quoteNumber, "Q-1");
});

test("public proposal payload does not leak internal proposal fields", () => {
  const payload = buildPublicProposalPayload({
    token: "tok",
    proposal: {
      id: "p1",
      status: "sent",
      title: "Proposal",
      proposal_number: "P-1",
      company_name: "Acme",
      recipient_name: "Alice",
      currency: "USD",
      valid_until: "2026-09-30",
      subtotal: 100,
      discount: 0,
      tax_rate: 15,
      tax_amount: 15,
      total: 115,
      terms: "Terms",
      pdf_url: "https://example.test/proposal.pdf",
      public_token: "hidden-token",
      client_id: "hidden-client",
      recipient_email: "hidden@example.com",
    },
    sections: [{ kind: "text", heading: "Overview", body: "Hello" }],
    items: [{ item_name: "Setup", description: null, unit_price: 100, quantity: 1, amount: 100, group_label: null }],
    brand: {
      companyName: "Segmiq",
      logoUrl: null,
      brandColor: "#0F7A4F",
      companyEmail: null,
      companyPhone: null,
      footerNote: null,
    },
  });

  assert.equal("client_id" in payload, false);
  assert.equal("recipient_email" in payload, false);
  assert.equal(payload.companyName, "Acme");
});

test("cross-tenant confirmation cancel fails", async () => {
  const actor: ManagerActor = {
    userId: "manager-a",
    clientId: "client-a",
    role: "CLIENT_MANAGER",
    alsoSells: false,
    name: "Manager A",
  };
  const filters: Array<[string, unknown]> = [];
  const fakeClient = () =>
    ({
      from() {
        return {
          update() {
            return this;
          },
          eq(key: string, value: unknown) {
            filters.push([key, value]);
            return this;
          },
          select() {
            return this;
          },
          maybeSingle: async () => ({ data: null }),
        };
      },
    }) as never;

  const ok = await markConfirmation(actor, "conf-1", "CANCELLED", undefined, {
    createClient: fakeClient,
  });

  assert.equal(ok, false);
  assert.deepEqual(filters, [
    ["id", "conf-1"],
    ["client_id", "client-a"],
    ["user_id", "manager-a"],
    ["status", "PENDING"],
  ]);
});

test("same-tenant confirmation cancel succeeds", async () => {
  const actor: ManagerActor = {
    userId: "manager-a",
    clientId: "client-a",
    role: "CLIENT_MANAGER",
    alsoSells: false,
    name: "Manager A",
  };
  const fakeClient = () =>
    ({
      from() {
        return {
          update() {
            return this;
          },
          eq() {
            return this;
          },
          select() {
            return this;
          },
          maybeSingle: async () => ({ data: { id: "conf-1" } }),
        };
      },
    }) as never;

  const ok = await markConfirmation(actor, "conf-1", "CANCELLED", undefined, {
    createClient: fakeClient,
  });

  assert.equal(ok, true);
});
