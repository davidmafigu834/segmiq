import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  companyMobilePrimaryItems,
  companyNavBySection,
  companyNavIsActive,
  getCompanyNavigation,
  getCompanyNavSectionOrder,
} from "../lib/sales/navigation/company-nav-config";
import {
  REAL_ESTATE_SALES_SECTION_ORDER,
  resolveSalesNavItems,
  SALES_NAVIGATION,
  salesMobilePrimaryItems,
  salesNavIsActive,
  salesNavItemsBySection,
  salesNavSectionOrder,
} from "../lib/sales/navigation/sales-nav-config";
import {
  AGENT_PEOPLE_LINKS,
  agentWorkspaceShortcuts,
  MANAGER_PEOPLE_LINKS,
  MANAGER_REVIEW_LINKS,
  managerWorkspaceShortcuts,
} from "../lib/real-estate/workspace-links";

const HIDDEN_AGENT_IDS = [
  "opportunities",
  "introductions",
  "matching",
  "sharedListings",
  "compliance",
  "commissions",
  "pipeline",
  "command",
  "reports",
  "wonLost",
  "goals",
  "toolbox",
];

describe("real estate stage 1 navigation", () => {
  it("shows five agent destinations and keeps the older entries reachable by id", () => {
    const agent = resolveSalesNavItems(false, "real_estate");
    assert.deepEqual(salesNavSectionOrder("real_estate"), ["main", "acquisition", "buyer_sales"]);
    assert.deepEqual(
      salesNavItemsBySection(agent, "main").map((item) => item.id),
      ["dashboard", "listings", "calendar", "transactions", "whatsapp", "socialInbox", "tasks"]
    );
    assert.deepEqual(
      salesNavItemsBySection(agent, "acquisition").map((item) => item.id),
      ["mandates", "dueDiligence", "owners", "inspections"]
    );
    assert.deepEqual(
      salesNavItemsBySection(agent, "buyer_sales").map((item) => item.id),
      ["leads", "buyers", "viewings", "offers"]
    );
    assert.equal(agent.find((item) => item.id === "owners")?.label, "Sellers");
    assert.equal(agent.find((item) => item.id === "offers")?.label, "Offers");
    assert.equal(agent.find((item) => item.id === "leads")?.section, "buyer_sales");
    assert.equal(agent.find((item) => item.id === "dashboard")?.label, "Today");
    assert.equal(agent.find((item) => item.id === "calendar")?.label, "Calendar");
    assert.equal(agent.find((item) => item.id === "tasks")?.label, "My Activities");
    assert.equal(agent.find((item) => item.id === "whatsapp")?.label, "Sales Inbox");
    assert.deepEqual(
      salesMobilePrimaryItems(agent, "real_estate").map((item) => item.id),
      ["dashboard", "listings", "calendar", "transactions"]
    );
    for (const id of HIDDEN_AGENT_IDS) {
      const item = agent.find((entry) => entry.id === id);
      assert.ok(item, `missing compatibility entry ${id}`);
      assert.equal(REAL_ESTATE_SALES_SECTION_ORDER.includes(item.section), false);
    }
    assert.equal(salesNavIsActive(agent.find((item) => item.id === "listings")!, "/sales/acquisitions"), true);
    assert.equal(salesNavIsActive(agent.find((item) => item.id === "offers")!, "/sales/offers/abc"), true);
    assert.equal(salesNavIsActive(agent.find((item) => item.id === "listings")!, "/sales/offers/abc"), false);
    assert.equal(salesNavIsActive(agent.find((item) => item.id === "viewings")!, "/sales/viewings"), true);
    assert.equal(salesNavIsActive(agent.find((item) => item.id === "calendar")!, "/sales/viewings"), false);
    assert.equal(salesNavIsActive(agent.find((item) => item.id === "owners")!, "/sales/owners"), true);
    assert.equal(agent.some((item) => item.id === "people" || item.id === "mandateLink" || item.id === "viewingLink"), false);
    assert.equal(salesNavIsActive(agent.find((item) => item.id === "transactions")!, "/sales/compliance"), true);
    assert.equal(salesNavIsActive(agent.find((item) => item.id === "dashboard")!, "/sales/inbox"), false);
    assert.equal(agent.find((item) => item.id === "viewings")!.match("/sales/viewings"), true);
    assert.equal(agent.find((item) => item.id === "dashboard")!.match("/sales/inbox"), false);
  });

  it("gives the manager the same five names plus Review, without taking Review onto the phone bar", () => {
    const manager = getCompanyNavigation("real_estate");
    assert.deepEqual(getCompanyNavSectionOrder("real_estate"), ["main", "acquisition", "buyer_sales", "agency"]);
    assert.deepEqual(
      companyNavBySection(manager, "acquisition").map((item) => item.id),
      ["mandates", "dueDiligence", "owners", "inspections"]
    );
    assert.deepEqual(
      companyNavBySection(manager, "buyer_sales").map((item) => item.id),
      ["inquiries", "buyers", "viewings", "offers"]
    );
    assert.equal(manager.find((item) => item.id === "owners")?.label, "Sellers");
    assert.equal(manager.find((item) => item.id === "offers")?.label, "Offers");
    assert.deepEqual(
      companyNavBySection(manager, "main").map((item) => item.id),
      ["overview", "listings", "calendar", "transactions", "review", "whatsapp", "socialInbox"]
    );
    assert.deepEqual(
      companyMobilePrimaryItems(manager).map((item) => item.id),
      ["overview", "listings", "calendar", "transactions"]
    );
    assert.equal(manager.find((item) => item.id === "overview")?.label, "Today");
    assert.equal(manager.find((item) => item.id === "calendar")?.label, "Calendar");
    assert.equal(manager.find((item) => item.id === "whatsapp")?.section, "main");
    for (const id of ["agents", "commissions", "reports", "marketing", "settings", "billing", "developments"]) {
      assert.equal(manager.find((item) => item.id === id)?.section, "agency");
    }
    for (const id of ["opportunities", "introductions", "matching", "compliance", "reviews"]) {
      assert.ok(manager.some((item) => item.id === id), `missing compatibility entry ${id}`);
      assert.equal(["main", "acquisition", "buyer_sales", "agency"].includes(manager.find((item) => item.id === id)!.section), false);
    }
    const review = manager.find((item) => item.id === "review")!;
    assert.equal(companyNavIsActive(review, "/client/mandates"), false);
    assert.equal(companyNavIsActive(manager.find((item) => item.id === "mandates")!, "/client/mandates"), true);
    assert.equal(companyNavIsActive(review, "/client/compliance/reviews"), true);
    assert.equal(companyNavIsActive(manager.find((item) => item.id === "listings")!, "/client/mandates"), false);
    assert.equal(companyNavIsActive(manager.find((item) => item.id === "viewings")!, "/client/viewings"), true);
    assert.equal(companyNavIsActive(manager.find((item) => item.id === "calendar")!, "/client/viewings"), false);
    assert.equal(companyNavIsActive(manager.find((item) => item.id === "buyers")!, "/client/buyers"), true);
    assert.equal(manager.some((item) => item.id === "people"), false);
  });

  it("leaves trades and solar menus on their own destinations", () => {
    const trades = resolveSalesNavItems(false, "trades");
    assert.deepEqual(
      trades.map((item) => item.id),
      SALES_NAVIGATION.map((item) => item.id).filter((id) => id !== "projects" && id !== "myWork")
    );
    assert.deepEqual(salesNavSectionOrder("trades"), ["sales", "tools"]);
    assert.deepEqual(
      salesMobilePrimaryItems(trades, "trades").map((item) => item.id),
      ["dashboard", "pipeline", "whatsapp", "tasks"]
    );
    assert.equal(trades.find((item) => item.id === "quotes")?.href, "/sales/quotes");
    const solar = resolveSalesNavItems(false, "trades", { solarWorkflow: true });
    assert.equal(solar.some((item) => item.id === "projects"), true);
    assert.equal(solar.some((item) => item.id === "listings"), false);
    const company = getCompanyNavigation("trades");
    assert.deepEqual(getCompanyNavSectionOrder("trades"), ["company", "products", "tools"]);
    assert.equal(company.some((item) => item.id === "review" || item.id === "people"), false);
    assert.equal(company.find((item) => item.id === "leads")?.label, "Leads");
    assert.equal(getCompanyNavigation("trades", { solarWorkflow: true }).some((item) => item.id === "projects"), true);
  });

  it("maps each destination to the existing pages", () => {
    assert.deepEqual(
      agentWorkspaceShortcuts("/sales/dashboard").map((link) => link.href),
      ["/sales/inbox", "/sales/tasks", "/sales/leads", "/sales/social-inbox"]
    );
    assert.ok(agentWorkspaceShortcuts("/sales/calendar").some((link) => link.href === "/sales/viewings" && link.label === "Viewings"));
    assert.equal(agentWorkspaceShortcuts("/sales/listings").some((link) => link.href === "/sales/acquisitions"), false);
    assert.equal(agentWorkspaceShortcuts("/sales/listings").some((link) => link.href === "/sales/matching"), false);
    assert.ok(agentWorkspaceShortcuts("/sales/listings").some((link) => link.href === "/sales/mandates"));
    assert.ok(agentWorkspaceShortcuts("/sales/offers").some((link) => link.href === "/sales/mandates"));
    assert.deepEqual(agentWorkspaceShortcuts("/sales/people"), []);
    assert.deepEqual(agentWorkspaceShortcuts("/sales/inbox"), []);
    assert.deepEqual(AGENT_PEOPLE_LINKS.map((link) => link.href), [
      "/sales/owners",
      "/sales/buyers",
    ]);
    assert.ok(managerWorkspaceShortcuts("/client/dashboard").some((link) => link.href === "/client/review"));
    assert.ok(managerWorkspaceShortcuts("/client/dashboard").some((link) => link.href === "/client/inbox"));
    assert.ok(managerWorkspaceShortcuts("/client/calendar").some((link) => link.label === "Viewings"));
    assert.deepEqual(managerWorkspaceShortcuts("/client/review"), []);
    assert.deepEqual(managerWorkspaceShortcuts("/client/inbox"), []);
    assert.deepEqual(MANAGER_PEOPLE_LINKS.map((link) => link.href), [
      "/client/owners",
      "/client/buyers",
      "/client/contacts",
      "/client/customers",
    ]);
    assert.deepEqual(
      MANAGER_REVIEW_LINKS.map((link) => link.href),
      [
        "/client/mandates",
        "/client/listings",
        "/client/compliance/reviews",
        "/client/compliance",
        "/client/compliance/centre",
        "/client/commissions",
      ]
    );
  });
});
