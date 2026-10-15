import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROSSI_ACTORS, type DemoActorSeed } from "../lib/demo/actors";
import { demoId } from "../lib/demo/ids";
import { buildBsaDataset } from "../lib/demo/industries/vehicle-hire/bsa/dataset";
import { BSA_ACTORS } from "../lib/demo/industries/vehicle-hire/bsa/identity";
import { buildRossiDataset } from "../lib/demo/industries/tyres/rossi/dataset";
import {
  buildDemoCalendar,
  buildDemoCommandReply,
  buildDemoCopilotConversation,
  buildDemoDailyWorkspace,
  buildDemoGoals,
  buildDemoReports,
  buildDemoSocialThreads,
  buildDemoTasks,
  buildDemoWonLost,
} from "../lib/demo/adapters/experience";
import { buildDemoCompanyCalendar, buildDemoCompanyTeam } from "../lib/demo/adapters/manager-tour";
import { buildDemoCompanyDashboard, buildDemoInbox, buildDemoSalesDashboard } from "../lib/demo/adapters/workspace-views";
import { applyDemoMutations, visibleDeals, visibleLeads } from "../lib/demo/mutations";
import { findDemoPersona } from "../lib/demo/personas";
import { materializeDemoDataset } from "../lib/demo/provider";
import { summariseDemo } from "../lib/demo/totals";
import type { DemoActor } from "../lib/demo/types";

const clientId = "22222222-2222-4222-8222-222222222222";

function actors(seeds: readonly DemoActorSeed[], prefix: string) {
  const map: Record<string, DemoActor> = {};
  for (const seed of seeds) {
    map[seed.key] = { ...seed, id: demoId(`${prefix}:actor:${seed.key}`) };
  }
  return map;
}

function bsa(now = new Date("2026-10-14T08:00:00.000Z")) {
  return buildBsaDataset({ now, clientId, actors: actors(BSA_ACTORS, "bsa") });
}

describe("BSA Mobility vehicle-hire demonstration", () => {
  it("loads a fictional two-salesperson book without Rossi records", () => {
    const dataset = bsa();
    const rossi = buildRossiDataset({
      now: new Date("2026-10-14T08:00:00.000Z"),
      clientId: "11111111-1111-4111-8111-111111111111",
      actors: actors(ROSSI_ACTORS, "rossi"),
    });
    assert.equal(dataset.organisationName, "BSA Mobility Solutions");
    assert.equal(dataset.industry, "vehicle_hire");
    assert.equal(dataset.scenario, "bsa_mobility");
    assert.equal(dataset.leads.length, 28);
    assert.equal(dataset.deals.length, 16);
    assert.equal(dataset.quotations.length, 7);
    assert.equal(dataset.deals.filter((deal) => deal.stage === "WON").length, 5);
    assert.equal(dataset.deals.filter((deal) => deal.stage === "LOST").length, 2);
    const salespeople = Object.values(dataset.actors).filter((actor) => actor.role === "SALESPERSON");
    assert.deepEqual(salespeople.map((actor) => actor.name).sort(), ["Munashe Moyo", "Tariro Dube"]);
    assert.equal(dataset.actors.owner?.role, "CLIENT_MANAGER");
    assert.equal(Object.keys(summariseDemo(dataset).byOwner).length, 2);
    const rossiIds = new Set(rossi.leads.map((lead) => lead.id));
    assert.equal(dataset.leads.some((lead) => rossiIds.has(lead.id)), false);
    assert.ok(dataset.messages.some((message) => message.text.includes("Simulated demonstration")));
    assert.ok(dataset.quotations.every((quote) => quote.notes?.includes("Fictional demonstration")));
  });

  it("keeps each salesperson on their own enquiries and lets the owner see both", () => {
    const dataset = bsa();
    const tariro = dataset.actors.tariro!;
    const munashe = dataset.actors.munashe!;
    const owner = dataset.actors.owner!;
    const tariroDeals = visibleDeals(dataset, tariro.id, "SALESPERSON");
    const munasheDeals = visibleDeals(dataset, munashe.id, "SALESPERSON");
    assert.ok(tariroDeals.length > 0);
    assert.ok(munasheDeals.length > 0);
    assert.ok(tariroDeals.every((deal) => deal.owner_id === tariro.id));
    assert.ok(munasheDeals.every((deal) => deal.owner_id === munashe.id));
    assert.equal(visibleLeads(dataset, tariro.id, "SALESPERSON").some((lead) => lead.name === "Farai Nyathi"), false);
    assert.equal(visibleDeals(dataset, owner.id, "CLIENT_MANAGER").length, dataset.deals.length);
    const ruvimbo = dataset.quotations.find((quote) => quote.quote_number === "BSA-1042");
    assert.equal(ruvimbo?.total, 450);
    const phantom = dataset.deals.find((deal) => deal.name.includes("Rolls-Royce"));
    assert.equal(phantom?.estimated_value, null);
  });

  it("keeps visitor mutations on a copy and leaves Rossi addressable", () => {
    const first = bsa();
    const second = bsa();
    const deal = first.deals.find((row) => row.stage === "PROPOSAL_SENT");
    assert.ok(deal);
    const changed = applyDemoMutations(first, [
      {
        id: "m1",
        type: "deal.stage",
        dealId: deal.id,
        stage: "NEGOTIATING",
        at: "2026-10-14T09:00:00.000Z",
        actorUserId: first.actors.tariro!.id,
      },
    ]);
    assert.equal(changed.deals.find((row) => row.id === deal.id)?.stage, "NEGOTIATING");
    assert.equal(second.deals.find((row) => row.id === deal.id)?.stage, "PROPOSAL_SENT");
    assert.equal(first.deals.find((row) => row.id === deal.id)?.stage, "PROPOSAL_SENT");
    assert.equal(findDemoPersona("vehicle_hire", "bsa_mobility", "tariro")?.role, "SALESPERSON");
    assert.equal(findDemoPersona("vehicle_hire", "bsa_mobility", "owner")?.role, "CLIENT_MANAGER");
    assert.equal(findDemoPersona("tyres", "rossi", "tinashe")?.role, "SALESPERSON");
    assert.equal(findDemoPersona("vehicle_hire", "bsa_mobility", "tinashe"), null);
    assert.equal(materializeDemoDataset({ industry: "vehicle_hire", scenario: "unknown", clientId, actors: {} }), null);
    const viaRegistry = materializeDemoDataset({
      industry: "vehicle_hire",
      scenario: "bsa_mobility",
      clientId,
      actors: actors(BSA_ACTORS, "bsa"),
    });
    assert.equal(viaRegistry?.leads.length, 28);
  });

  it("computes owner and salesperson dashboards from the same records", () => {
    const dataset = bsa();
    const summary = summariseDemo(dataset);
    const company = buildDemoCompanyDashboard(dataset);
    const blob = JSON.stringify(company);
    assert.equal(blob.includes("Tendai"), false);
    assert.equal(blob.includes("Westgate"), false);
    assert.equal(blob.includes("Brian Ncube"), false);
    assert.equal(blob.includes("4640"), false);
    assert.equal(company.team.length, 2);
    assert.equal(company.kpis.find((item) => item.id === "pipeline")?.supporting, `${summary.activeDeals} active deals`);
    assert.equal(company.kpis.find((item) => item.id === "won")?.supporting, `${summary.wonCount} deals`);
    const sourceTotal = company.sources.reduce((sum, row) => sum + row.count, 0);
    assert.equal(sourceTotal, dataset.leads.length);
    const tariro = buildDemoSalesDashboard(dataset, dataset.actors.tariro!.id, "SALESPERSON");
    assert.equal(JSON.stringify(tariro).includes("Farai Nyathi"), false);
    assert.equal(tariro.plan?.goal.hasGoal, false);
    assert.equal(company.metrics.avgResponseMinutes, null);
  });

  it("fills the salesperson tour with fictional conversations, tasks, and closed deals", () => {
    const dataset = bsa();
    const userId = dataset.actors.tariro!.id;
    const inbox = buildDemoInbox(dataset, userId, "SALESPERSON");
    const tasks = buildDemoTasks(dataset, userId, "SALESPERSON");
    const outcomes = buildDemoWonLost(dataset, userId, "SALESPERSON");
    const reports = buildDemoReports(dataset, userId, "SALESPERSON");
    const goals = buildDemoGoals(dataset, userId, "SALESPERSON");
    const calendar = buildDemoCalendar(dataset, userId, "SALESPERSON");
    const social = buildDemoSocialThreads(dataset, userId, "SALESPERSON");
    const reply = buildDemoCommandReply(dataset, userId, "SALESPERSON", "Which deals can I close?");
    assert.ok(inbox.length > 0);
    assert.ok(inbox.every((row) => row.lastMessage));
    assert.ok(tasks.tasks.length > 0);
    assert.ok(outcomes.deals.some((row) => row.status === "WON"));
    assert.ok(outcomes.deals.some((row) => row.status === "LOST"));
    assert.ok((reports.kpis.pipelineValue.value ?? 0) > 0);
    assert.equal(goals.goal?.editable, false);
    assert.ok((goals.progress.remaining ?? 0) > 0);
    assert.ok(calendar.events.length > 0);
    assert.ok(social.length > 0);
    assert.match(reply.reply, /No message has been sent/);
    assert.equal(reply.status, "COMPLETED");
    const copilot = buildDemoCopilotConversation(dataset, inbox[0]!.id);
    assert.equal(copilot.analysis.status, "ready");
    assert.ok(copilot.items.some((item) => item.actionType === "answer_question"));
    assert.match(copilot.analysis.summary ?? "", /Simulated/);
    assert.equal(tasks.meta.copilotUnavailable, false);
    assert.ok(tasks.tasks.some((task) => task.copilot?.primaryAction === "draft"));
    const workspace = buildDemoDailyWorkspace(dataset, userId, "SALESPERSON");
    assert.equal(workspace.copilotUnavailable, false);
    assert.ok(workspace.actions.length > 0);
    assert.ok(workspace.actions.every((task) => task.copilot));
    assert.match(workspace.briefing, /follow-up|review/i);
    assert.equal(workspace.viewAllHref, "/sales/tasks");
  });

  it("fills the manager tour from fictional records", () => {
    const dataset = bsa();
    const team = buildDemoCompanyTeam(dataset);
    const calendar = buildDemoCompanyCalendar(dataset);
    assert.equal(team.canManageTeam, false);
    assert.ok(team.members.some((member) => member.name === "Tariro Dube" && member.roleColumn === "Salesperson"));
    assert.ok(team.members.some((member) => member.roleGroup === "manager"));
    assert.ok(team.members.some((member) => member.activeDeals > 0));
    assert.ok(calendar.events.length > 0);
    assert.ok(calendar.events.every((event) => event.canEdit === false));
    assert.ok(dataset.products.length > 0);
    assert.ok(dataset.quotations.length > 0);
  });
});
