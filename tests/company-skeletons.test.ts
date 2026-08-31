/**
 * Company loading skeletons must share grid geometry with the live pages.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { COMPANY_KPI_GRID } from "../lib/sales/company-skeleton-grids";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("company page skeletons", () => {
  it("keeps KPI grids in lockstep with live pages", () => {
    const pairs: Array<{ live: string; skeleton: string; grid: string; key: keyof typeof COMPANY_KPI_GRID }> = [
      {
        live: "components/dashboard/company/CompanyDashboard.tsx",
        skeleton: "components/dashboard/company/CompanyDashboardSkeleton.tsx",
        grid: COMPANY_KPI_GRID.dashboard,
        key: "dashboard",
      },
      {
        live: "components/dashboard/company/leads/CompanyLeadsPage.tsx",
        skeleton: "components/dashboard/company/leads/CompanyLeadsPageSkeleton.tsx",
        grid: COMPANY_KPI_GRID.leads,
        key: "leads",
      },
      {
        live: "components/dashboard/company/pipeline/CompanyPipelinePage.tsx",
        skeleton: "components/dashboard/company/pipeline/CompanyPipelinePageSkeleton.tsx",
        grid: COMPANY_KPI_GRID.pipeline,
        key: "pipeline",
      },
      {
        live: "components/dashboard/company/team/CompanyTeamPage.tsx",
        skeleton: "components/dashboard/company/team/CompanyTeamPageSkeleton.tsx",
        grid: COMPANY_KPI_GRID.team,
        key: "team",
      },
      {
        live: "components/dashboard/company/customers/CompanyCustomersPage.tsx",
        skeleton: "components/dashboard/company/customers/CompanyCustomersPageSkeleton.tsx",
        grid: COMPANY_KPI_GRID.customers,
        key: "customers",
      },
      {
        live: "components/dashboard/company/quotations/CompanyQuotationsPage.tsx",
        skeleton: "components/dashboard/company/quotations/CompanyQuotationsPageSkeleton.tsx",
        grid: COMPANY_KPI_GRID.quotations,
        key: "quotations",
      },
      {
        live: "components/dashboard/company/calendar/CompanyCalendarSummary.tsx",
        skeleton: "components/dashboard/company/calendar/CompanyCalendarPageSkeleton.tsx",
        grid: COMPANY_KPI_GRID.calendar,
        key: "calendar",
      },
      {
        live: "components/real-estate/viewings/CompanyViewingsPage.tsx",
        skeleton: "components/real-estate/viewings/CompanyViewingsPageSkeleton.tsx",
        grid: COMPANY_KPI_GRID.viewings,
        key: "viewings",
      },
      {
        live: "components/real-estate/lead-sources/CompanyLeadSourcesPage.tsx",
        skeleton: "components/real-estate/lead-sources/CompanyLeadSourcesPageSkeleton.tsx",
        grid: COMPANY_KPI_GRID.sources,
        key: "sources",
      },
      {
        live: "components/real-estate/offers/OffersWorkspace.tsx",
        skeleton: "components/real-estate/offers/CompanyOffersPageSkeleton.tsx",
        grid: COMPANY_KPI_GRID.offers,
        key: "offers",
      },
      {
        live: "components/real-estate/ListingsManager.tsx",
        skeleton: "components/real-estate/listings/CompanyListingsPageSkeleton.tsx",
        grid: COMPANY_KPI_GRID.listings,
        key: "listings",
      },
      {
        live: "components/real-estate/website-leads/CompanyWebsiteLeadsPage.tsx",
        skeleton: "components/real-estate/website-leads/CompanyWebsiteLeadsPageSkeleton.tsx",
        grid: COMPANY_KPI_GRID.websiteLeads,
        key: "websiteLeads",
      },
      {
        live: "components/real-estate/agent-performance/CompanyAgentPerformancePage.tsx",
        skeleton: "components/real-estate/agent-performance/CompanyAgentPerformancePageSkeleton.tsx",
        grid: COMPANY_KPI_GRID.agentPerformance,
        key: "agentPerformance",
      },
      {
        live: "components/real-estate/marketing/RealEstateMarketingWorkspace.tsx",
        skeleton: "components/real-estate/marketing/CompanyMarketingPageSkeleton.tsx",
        grid: COMPANY_KPI_GRID.marketing,
        key: "marketing",
      },
      {
        live: "components/real-estate/FeedbackWorkspace.tsx",
        skeleton: "components/real-estate/feedback/CompanyFeedbackPageSkeleton.tsx",
        grid: COMPANY_KPI_GRID.feedback,
        key: "feedback",
      },
      {
        live: "components/real-estate/DevelopmentsManager.tsx",
        skeleton: "components/real-estate/developments/CompanyDevelopmentsPageSkeleton.tsx",
        grid: COMPANY_KPI_GRID.developments,
        key: "developments",
      },
      {
        live: "components/real-estate/compliance/ComplianceWorkspace.tsx",
        skeleton: "components/real-estate/compliance/CompanyCompliancePageSkeleton.tsx",
        grid: COMPANY_KPI_GRID.compliance,
        key: "compliance",
      },
      {
        live: "components/real-estate/RealEstateReportsWorkspace.tsx",
        skeleton: "components/real-estate/reports/CompanyReReportsPageSkeleton.tsx",
        grid: COMPANY_KPI_GRID.reports,
        key: "reports",
      },
    ];

    for (const pair of pairs) {
      const live = read(pair.live);
      const skeleton = read(pair.skeleton);
      assert.ok(live.includes(pair.grid), `${pair.live} is missing KPI grid ${pair.grid}`);
      assert.ok(
        skeleton.includes(`COMPANY_KPI_GRID.${pair.key}`),
        `${pair.skeleton} should use COMPANY_KPI_GRID.${pair.key}`
      );
    }
  });

  it("paints the company shell instead of a blank first frame", () => {
    const shell = read("components/dashboard/company/CompanyWorkspaceShell.tsx");
    assert.equal(shell.includes("if (!mounted)"), false);
    assert.ok(shell.includes("CompanySidebar"));
  });

  it("wraps page skeletons in the company workspace shell", () => {
    const files = [
      "components/dashboard/company/CompanyDashboardSkeleton.tsx",
      "components/dashboard/company/leads/CompanyLeadsPageSkeleton.tsx",
      "components/dashboard/company/pipeline/CompanyPipelinePageSkeleton.tsx",
      "components/dashboard/company/team/CompanyTeamPageSkeleton.tsx",
      "components/dashboard/company/customers/CompanyCustomersPageSkeleton.tsx",
      "components/dashboard/company/quotations/CompanyQuotationsPageSkeleton.tsx",
      "components/dashboard/company/billing/CompanyBillingPageSkeleton.tsx",
      "components/dashboard/company/reports/CompanyReportsPageSkeleton.tsx",
      "components/dashboard/company/settings/CompanySettingsPageSkeleton.tsx",
      "components/dashboard/company/calendar/CompanyCalendarPageSkeleton.tsx",
      "components/real-estate/viewings/CompanyViewingsPageSkeleton.tsx",
      "components/real-estate/lead-sources/CompanyLeadSourcesPageSkeleton.tsx",
      "components/real-estate/offers/CompanyOffersPageSkeleton.tsx",
      "components/real-estate/listings/CompanyListingsPageSkeleton.tsx",
      "components/real-estate/website-leads/CompanyWebsiteLeadsPageSkeleton.tsx",
      "components/real-estate/agent-performance/CompanyAgentPerformancePageSkeleton.tsx",
      "components/real-estate/marketing/CompanyMarketingPageSkeleton.tsx",
      "components/real-estate/feedback/CompanyFeedbackPageSkeleton.tsx",
      "components/real-estate/developments/CompanyDevelopmentsPageSkeleton.tsx",
      "components/real-estate/compliance/CompanyCompliancePageSkeleton.tsx",
      "components/real-estate/reports/CompanyReReportsPageSkeleton.tsx",
      "components/inbox/CompanyInboxPageSkeleton.tsx",
    ];
    for (const file of files) {
      assert.ok(
        read(file).includes("CompanyPageSkeletonShell"),
        `${file} should wrap content in CompanyPageSkeletonShell`
      );
    }
  });

  it("does not double-pad the customers skeleton", () => {
    const source = read("components/dashboard/company/customers/CompanyCustomersPageSkeleton.tsx");
    assert.equal(source.includes("px-4 py-4"), false);
    assert.equal(source.includes("layout:px-8"), false);
  });

  it("keeps inbox skeleton on sales tokens", () => {
    const source = read("components/inbox/InboxSkeleton.tsx");
    assert.equal(source.includes("#E4E7EC"), false);
    assert.equal(source.includes("bg-white"), false);
    assert.ok(source.includes("bg-sales-surface"));
  });
});
