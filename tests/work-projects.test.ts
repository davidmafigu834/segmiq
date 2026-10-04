import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  canCancelOrReopenWorkProject,
  canCreateManualWorkProject,
  canReadWorkProject,
  canUpdateWorkProject,
} from "../lib/work-projects/access";
import { projectAttention } from "../lib/work-projects/attention";
import {
  canTransitionWorkProjectStatus,
  WORK_PROJECT_STATUS_LABEL,
  WORK_PROJECT_STATUSES,
} from "../lib/work-projects/constants";
import {
  buildWorkProjectTitle,
  formatWorkProjectNumber,
  readSolarQuoteSnapshot,
  suggestWorkProjectWorkflow,
} from "../lib/work-projects/draft";
import {
  COMPANY_NAVIGATION,
  REAL_ESTATE_COMPANY_NAVIGATION,
} from "../lib/sales/navigation/company-nav-config";
import { resolveSalesNavItems } from "../lib/sales/navigation/sales-nav-config";

const migration = readFileSync("supabase/migrations/20261003190000_work_projects.sql", "utf8");
const closeDeal = readFileSync("lib/sales/deals/close-deal.ts", "utf8");
const quoteAccept = readFileSync("app/api/quotes/[token]/route.ts", "utf8");
const dashboard = readFileSync("lib/sales/get-company-sales-dashboard-data.ts", "utf8");
const service = readFileSync("lib/work-projects/service.ts", "utf8");
const permissions = readFileSync("lib/auth/rbac/permissions.ts", "utf8");

const row = {
  client_id: "company-a",
  project_owner_id: "owner-1",
  deal_owner_id: "seller-1",
  member_user_ids: ["member-1"],
  status: "PLANNING",
};

describe("work project status model", () => {
  it("centralises the generic trades labels", () => {
    assert.equal(WORK_PROJECT_STATUS_LABEL.PLANNING, "Planning");
    assert.equal(WORK_PROJECT_STATUS_LABEL.SITE_ASSESSMENT, "Site Assessment");
    assert.equal(WORK_PROJECT_STATUS_LABEL.QUALITY_CHECK, "Quality Check");
    assert.equal(WORK_PROJECT_STATUSES.includes("PANELS_ORDERED" as never), false);
  });

  it("allows a delivery path and a return from quality check", () => {
    assert.equal(canTransitionWorkProjectStatus("PLANNING", "SITE_ASSESSMENT"), true);
    assert.equal(canTransitionWorkProjectStatus("SITE_ASSESSMENT", "READY_TO_SCHEDULE"), true);
    assert.equal(canTransitionWorkProjectStatus("READY_TO_SCHEDULE", "SCHEDULED"), true);
    assert.equal(canTransitionWorkProjectStatus("SCHEDULED", "IN_PROGRESS"), true);
    assert.equal(canTransitionWorkProjectStatus("IN_PROGRESS", "QUALITY_CHECK"), true);
    assert.equal(canTransitionWorkProjectStatus("QUALITY_CHECK", "IN_PROGRESS"), true);
    assert.equal(canTransitionWorkProjectStatus("QUALITY_CHECK", "HANDOVER"), true);
    assert.equal(canTransitionWorkProjectStatus("HANDOVER", "COMPLETED"), true);
    assert.equal(canTransitionWorkProjectStatus("IN_PROGRESS", "ON_HOLD"), true);
    assert.equal(canTransitionWorkProjectStatus("ON_HOLD", "PLANNING"), true);
  });

  it("rejects unknown jumps out of a closed project unless a manager reopens", () => {
    assert.equal(canTransitionWorkProjectStatus("COMPLETED", "PLANNING"), false);
    assert.equal(canTransitionWorkProjectStatus("CANCELLED", "IN_PROGRESS"), false);
    assert.equal(canTransitionWorkProjectStatus("COMPLETED", "IN_PROGRESS", { allowReopen: true }), true);
    assert.equal(canTransitionWorkProjectStatus("PLANNING", "PLANNING"), false);
  });
});

describe("work project attention and solar preset", () => {
  it("flags a missed target and a missed scheduled start", () => {
    const now = new Date("2026-10-03T12:00:00.000Z");
    assert.deepEqual(
      projectAttention(
        { status: "IN_PROGRESS", target_completion_date: "2026-10-01", scheduled_start_at: null },
        now
      ),
      { overdue: true, startOverdue: false }
    );
    assert.deepEqual(
      projectAttention(
        { status: "COMPLETED", target_completion_date: "2026-10-01", scheduled_start_at: null },
        now
      ),
      { overdue: false, startOverdue: false }
    );
    assert.equal(
      projectAttention(
        { status: "SCHEDULED", target_completion_date: "2026-10-20", scheduled_start_at: "2026-10-03T08:00:00.000Z" },
        now
      ).startOverdue,
      true
    );
  });

  it("preselects solar only from a solar quote layout or an explicit solar signal", () => {
    assert.equal(
      suggestWorkProjectWorkflow({ templateLayoutKey: "residential-premium-solar" }),
      "SOLAR_INSTALLATION"
    );
    assert.equal(
      suggestWorkProjectWorkflow({ dealName: "Residential solar installation" }),
      "SOLAR_INSTALLATION"
    );
    assert.equal(
      suggestWorkProjectWorkflow({ dealName: "Electrical upgrade", serviceSummary: "DB board" }),
      "GENERAL_TRADES"
    );
    assert.equal(suggestWorkProjectWorkflow({ explicit: "GENERAL_TRADES", dealName: "solar" }), "GENERAL_TRADES");
  });

  it("builds a customer and service title without inventing solar system data", () => {
    assert.equal(
      buildWorkProjectTitle({
        customerName: "Tendai Moyo",
        service: "Residential solar installation",
        workflow: "SOLAR_INSTALLATION",
      }),
      "Tendai Moyo — Residential solar installation"
    );
    assert.equal(formatWorkProjectNumber(124), "PRJ-000124");
    assert.equal(readSolarQuoteSnapshot("standard", { system_size_kwp: "8" }), null);
    assert.equal(
      readSolarQuoteSnapshot("residential-premium-solar", { system_size_kwp: "8", site_address: "Borrowdale, Harare" })
        ?.systemSize,
      "8 kWp"
    );
  });
});

describe("work project permissions", () => {
  it("lets a manager read every company project and hides other companies", () => {
    assert.equal(
      canReadWorkProject({ userId: "mgr", role: "CLIENT_MANAGER", clientId: "company-a" }, row),
      true
    );
    assert.equal(
      canReadWorkProject({ userId: "mgr", role: "CLIENT_MANAGER", clientId: "company-b" }, row),
      false
    );
    assert.equal(
      canReadWorkProject(
        { userId: "stranger", role: "SALESPERSON", clientId: "company-a" },
        { ...row, project_owner_id: "other", deal_owner_id: "other", member_user_ids: [] }
      ),
      false
    );
  });

  it("lets a salesperson see projects they own, belong to, or originated", () => {
    const actor = { userId: "seller-1", role: "SALESPERSON", clientId: "company-a" };
    assert.equal(canReadWorkProject(actor, row), true);
    assert.equal(canReadWorkProject({ ...actor, userId: "owner-1" }, row), true);
    assert.equal(canReadWorkProject({ ...actor, userId: "member-1" }, row), true);
    assert.equal(canCreateManualWorkProject(actor, "company-a"), false);
    assert.equal(canCreateManualWorkProject({ userId: "mgr", role: "CLIENT_MANAGER", clientId: "company-a" }, "company-a"), true);
    assert.equal(canCancelOrReopenWorkProject(actor, "company-a"), false);
    assert.equal(canUpdateWorkProject(actor, row), true);
  });
});

describe("work project handoff safeguards", () => {
  it("does not create a project inside deal close or quote acceptance", () => {
    assert.equal(closeDeal.includes("createWorkProject"), false);
    assert.equal(closeDeal.includes("work_projects"), false);
    assert.equal(quoteAccept.includes("createWorkProject"), false);
    assert.equal(quoteAccept.includes("work_projects"), false);
  });

  it("keeps project value out of sales revenue", () => {
    assert.match(dashboard, /won_value/);
    assert.equal(dashboard.includes("project_value"), false);
    assert.match(dashboard, /loadWorkProjectSummary/);
  });

  it("requires a won deal, a cancellation reason, and does not change the deal", () => {
    assert.match(service, /Create a project after the deal is won/);
    assert.match(service, /A cancellation reason is required/);
    assert.match(service, /Only a manager can create a project directly/);
    const start = service.indexOf("export async function updateWorkProjectStatus");
    const end = service.indexOf("export async function addWorkProjectNote");
    const statusFn = service.slice(start, end);
    assert.equal(statusFn.includes('.from("deals")'), false);
    assert.match(service, /deal\.owner_id === actor\.userId/);
  });

  it("enforces one project per deal and a stable company number in SQL", () => {
    assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS work_projects_client_deal_uidx/);
    assert.match(migration, /ON CONFLICT \(client_id\) DO UPDATE/);
    assert.match(migration, /WHEN unique_violation THEN/);
    assert.match(migration, /'created', false/);
    assert.match(migration, /actual_start_at IS NULL/);
    assert.match(migration, /actual_completion_at IS NULL/);
    assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
    assert.match(migration, /'WORK_PROJECT'/);
    assert.match(migration, /'PROJECT'/);
    assert.equal(migration.includes("ALTER TABLE public.projects"), false);
    assert.match(migration, /support_cases/);
    assert.match(migration, /ADD COLUMN IF NOT EXISTS work_project_id/);
  });

  it("keeps project permissions inside client data so a platform admin does not inherit them", () => {
    assert.match(permissions, /CLIENT_DATA_PERMISSIONS/);
    assert.match(permissions, /P\.PROJECTS_CREATE/);
    assert.match(permissions, /P\.PROJECTS_MANAGE/);
  });

  it("shows Projects to trades and hides them from real estate", () => {
    assert.equal(COMPANY_NAVIGATION.some((item) => item.id === "projects"), true);
    assert.equal(REAL_ESTATE_COMPANY_NAVIGATION.some((item) => item.id === "projects"), false);
    assert.equal(resolveSalesNavItems(false, "trades").some((item) => item.id === "projects"), true);
    assert.equal(resolveSalesNavItems(false, "real_estate").some((item) => item.id === "projects"), false);
  });
});
