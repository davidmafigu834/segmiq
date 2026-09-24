import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROSSI_ACTORS } from "../lib/demo/actors";
import { daysAgo, demoToday, harareDateKey } from "../lib/demo/dates";
import { demoBlocksExternalSend } from "../lib/demo/external";
import { demoId } from "../lib/demo/ids";
import { buildRossiDataset } from "../lib/demo/industries/tyres/rossi/dataset";
import { applyDemoMutations, visibleDeals, visibleLeads } from "../lib/demo/mutations";
import { isDemoWorkspace } from "../lib/demo/mode";
import { getDataProvider } from "../lib/demo/provider";
import { buildDemoCustomerProfile, buildDemoCompanyPipeline, buildDemoLeadsDirectory, buildDemoQuotes } from "../lib/demo/adapters/lists";
import { demoQuotationWorkspace } from "../lib/demo/adapters/records";
import { buildDemoWeeklyDetail } from "../lib/demo/adapters/weekly";
import { buildDemoCompanyDashboard, buildDemoMessages, buildDemoSalesDashboard } from "../lib/demo/adapters/workspace-views";
import { summariseDemo } from "../lib/demo/totals";
import type { DemoActor, DemoMutation } from "../lib/demo/types";

function actors(): Record<string, DemoActor> {
  const map = {} as Record<string, DemoActor>;
  for (const seed of ROSSI_ACTORS) {
    map[seed.key] = {
      key: seed.key,
      id: demoId(`rossi:actor:${seed.key}`),
      name: seed.name,
      email: seed.email,
      role: seed.role,
      phone: seed.phone,
    };
  }
  return map;
}

const clientId = "11111111-1111-4111-8111-111111111111";

function dataset(now = new Date("2026-09-24T08:00:00.000Z")) {
  return buildRossiDataset({ now, clientId, actors: actors() as never });
}

describe("workspace mode", () => {
  it("selects the production provider for a normal organisation", () => {
    assert.equal(isDemoWorkspace({ workspace_mode: "production" }), false);
    assert.deepEqual(getDataProvider({ workspace_mode: "production" }), { kind: "production" });
    assert.deepEqual(getDataProvider({ mode: "production" }), { kind: "production" });
  });

  it("selects the demo provider from workspace mode, not an email", () => {
    const provider = getDataProvider({
      workspace_mode: "demo",
      demo_industry: "tyres",
      demo_scenario: "rossi",
    });
    assert.deepEqual(provider, { kind: "demo", industry: "tyres", scenario: "rossi" });
  });
});

describe("Rossi dataset", () => {
  it("keeps quotation, deal, customer, and owner references aligned", () => {
    const data = dataset();
    const tinashe = data.actors.tinashe.id;
    const hilux = data.deals.find((deal) => deal.name.includes("Hilux GD6") || deal.estimated_value === 780);
    assert.ok(hilux);
    assert.equal(hilux.owner_id, tinashe);
    assert.equal(hilux.stage, "PROPOSAL_SENT");
    assert.equal(hilux.client_id, clientId);
    const quote = data.quotations.find((row) => row.quote_number === "QT-1028");
    assert.ok(quote);
    assert.equal(quote.total, 780);
    assert.equal(quote.deal_id, hilux.id);
    assert.equal(quote.lead_id, hilux.originating_lead_id);
    assert.equal(quote.prepared_by_id, tinashe);
    const lead = data.leads.find((row) => row.id === hilux.originating_lead_id);
    assert.equal(lead?.name, "Tendai Moyo");
    assert.equal(lead?.score, 82);
    assert.equal(lead?.assigned_to_id, tinashe);
    const westgate = data.quotations.find((row) => row.quote_number === "QT-1031");
    assert.equal(westgate?.total, 7800);
    assert.equal(data.deals.find((deal) => deal.id === westgate?.deal_id)?.stage, "NEGOTIATING");
    const simba = data.deals.find((deal) => deal.lost_reason === "Went with competitor");
    assert.equal(simba?.stage, "LOST");
    const brian = data.leads.find((row) => row.name === "Brian Ncube");
    assert.equal(brian?.score, 92);
    for (const quoteRow of data.quotations) {
      assert.equal(quoteRow.client_id, clientId);
      assert.ok(data.leads.some((leadRow) => leadRow.id === quoteRow.lead_id));
      if (quoteRow.deal_id) assert.ok(data.deals.some((deal) => deal.id === quoteRow.deal_id));
    }
  });

  it("stays inside the requested volume and stays consistent across summaries", () => {
    const now = new Date("2026-09-24T08:00:00.000Z");
    const data = dataset(now);
    assert.ok(data.contacts.length >= 45 && data.contacts.length <= 60);
    const openLeads = data.leads.filter((lead) => lead.status === "NEW" || lead.status === "CONTACTED" || lead.status === "QUALIFIED");
    assert.ok(openLeads.length >= 15 && openLeads.length <= 20);
    const open = data.deals.filter((deal) => !["WON", "LOST"].includes(deal.stage));
    const won = data.deals.filter((deal) => deal.stage === "WON");
    const lost = data.deals.filter((deal) => deal.stage === "LOST");
    assert.ok(open.length >= 18 && open.length <= 25);
    assert.ok(won.length >= 8 && won.length <= 12);
    assert.ok(lost.length >= 5 && lost.length <= 8);
    assert.ok(data.products.length >= 20 && data.products.length <= 30);
    const threads = new Set(data.messages.map((message) => message.leadId));
    assert.ok(threads.size >= 20 && threads.size <= 30);
    assert.ok(data.activities.length >= 80);
    const summary = summariseDemo(data, now);
    const ownerSum = Object.values(summary.byOwner).reduce((sum, row) => sum + row.wonValue, 0);
    assert.equal(ownerSum, summary.wonValue);
    const pipelineSum = Object.values(summary.byOwner).reduce((sum, row) => sum + row.pipeline, 0);
    assert.equal(pipelineSum, summary.pipelineValue);
  });

  it("limits a salesperson to their own records and shows the manager the team", () => {
    const data = dataset();
    const tinashe = data.actors.tinashe.id;
    const own = visibleDeals(data, tinashe, "SALESPERSON");
    assert.ok(own.every((deal) => deal.owner_id === tinashe));
    assert.ok(own.length < data.deals.length);
    const manager = visibleLeads(data, data.actors.tendai.id, "CLIENT_MANAGER");
    assert.equal(manager.length, data.leads.length);
    assert.ok(visibleLeads(data, tinashe, "SALESPERSON").every((lead) => lead.assigned_to_id === tinashe));
  });
});

describe("relative dates and reset", () => {
  it("moves operational dates with the current day", () => {
    const first = dataset(new Date("2026-09-24T08:00:00.000Z"));
    const later = dataset(new Date("2027-03-02T08:00:00.000Z"));
    const hiluxNow = first.deals.find((deal) => deal.estimated_value === 780);
    const hiluxLater = later.deals.find((deal) => deal.estimated_value === 780);
    assert.notEqual(hiluxNow?.updated_at.slice(0, 10), hiluxLater?.updated_at.slice(0, 10));
    assert.equal(hiluxNow?.id, hiluxLater?.id);
    const today = demoToday(new Date("2026-09-24T08:00:00.000Z"));
    const yesterday = daysAgo(1, new Date("2026-09-24T08:00:00.000Z"));
    assert.ok(today.getTime() > yesterday.getTime());
    assert.equal(harareDateKey(new Date("2026-09-24T22:30:00.000Z")), "2026-09-25");
  });

  it("restores canonical stage and messages when mutations are cleared", () => {
    const base = dataset();
    const hilux = base.deals.find((deal) => deal.estimated_value === 780)!;
    const leadId = hilux.originating_lead_id;
    const mutations: DemoMutation[] = [
      {
        id: "m1",
        type: "deal.stage",
        dealId: hilux.id,
        stage: "NEGOTIATING",
        at: "2026-09-24T10:00:00.000Z",
        actorUserId: base.actors.tinashe.id,
      },
      {
        id: "m2",
        type: "message",
        leadId,
        text: "Hi Tendai, just checking whether you had a chance to review our quotation.",
        at: "2026-09-24T10:05:00.000Z",
        actorUserId: base.actors.tinashe.id,
        kind: "message",
      },
    ];
    const changed = applyDemoMutations(base, mutations);
    assert.equal(changed.deals.find((deal) => deal.id === hilux.id)?.stage, "NEGOTIATING");
    assert.ok(changed.messages.some((message) => message.text.includes("review our quotation")));
    const restored = applyDemoMutations(base, []);
    assert.equal(restored.deals.find((deal) => deal.id === hilux.id)?.stage, "PROPOSAL_SENT");
    assert.equal(
      restored.messages.some((message) => message.text.includes("review our quotation")),
      false
    );
  });
});

describe("rendered demo views", () => {
  it("builds the salesperson, manager, quote, and weekly surfaces from one dataset", () => {
    const now = new Date("2026-09-24T08:00:00.000Z");
    const data = dataset(now);
    const sales = buildDemoSalesDashboard(data, data.actors.tinashe.id, "SALESPERSON");
    assert.ok(sales.plan.queue.length > 0);
    const company = buildDemoCompanyDashboard(data);
    assert.ok(company);
    const pipeline = buildDemoCompanyPipeline(data, data.actors.tendai.id, "CLIENT_MANAGER");
    assert.ok(pipeline.rows.length > 0);
    const quotes = buildDemoQuotes(data, data.actors.tinashe.id);
    assert.ok(quotes.quotes.some((row) => row.quoteNumber === "QT-1028" || row.number === "QT-1028" || JSON.stringify(row).includes("QT-1028")));
    const leads = buildDemoLeadsDirectory(data, data.actors.tinashe.id);
    assert.ok(leads.leads.length > 0);
    assert.ok(leads.leads.every((row) => row.name));
    const quote = data.quotations.find((row) => row.quote_number === "QT-1028");
    const workspace = demoQuotationWorkspace(data, quote!.id);
    assert.equal(workspace?.quotation.total, 780);
    assert.equal(workspace?.permissions.canSend, false);
    const contact = data.contacts.find((row) => row.name === "Tendai Moyo");
    const profile = buildDemoCustomerProfile(data, contact!.id);
    assert.equal(profile?.customer.name, "Tendai Moyo");
    assert.ok((profile?.customer.recentActivity.length ?? 0) > 0);
    const weekly = buildDemoWeeklyDetail(data, now);
    const summaryText = JSON.stringify(weekly.payload);
    assert.match(summaryText, /follow-up/i);
    const hiluxLead = data.leads.find((row) => row.name === "Tendai Moyo");
    const messages = buildDemoMessages(data, hiluxLead!.id);
    assert.ok(messages.some((message) => message.text.includes("265/70R16")));
  });
});

describe("external side effects", () => {
  it("blocks provider sends for demo workspaces", () => {
    assert.equal(demoBlocksExternalSend("demo"), true);
    assert.equal(demoBlocksExternalSend("production"), false);
    assert.equal(demoBlocksExternalSend(null), false);
  });
});
