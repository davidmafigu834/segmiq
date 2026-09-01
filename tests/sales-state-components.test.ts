/**
 * Phase 12 — Empty States & Feedback primitives.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { truncateStateQuery } from "../components/sales/ui/state-layout";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("sales state components", () => {
  it("exports state primitives from the sales UI barrel", () => {
    const barrel = read("components/sales/ui/index.ts");
    for (const name of [
      "FilteredEmptyState",
      "ErrorState",
      "LoadingState",
      "SuccessState",
      "InfoState",
      "DataTableFilteredEmpty",
      "DataTableError",
    ]) {
      assert.ok(barrel.includes(name), `index.ts should export ${name}`);
    }
  });

  it("defines semantic layout, copy, and accessibility in state sources", () => {
    const layout = read("components/sales/ui/state-layout.tsx");
    const states = read("components/sales/ui/states.tsx");
    const feedback = read("components/sales/ui/Feedback.tsx");

    assert.ok(layout.includes("aria-hidden"));
    assert.ok(layout.includes("max-w-[440px]"));
    assert.ok(states.includes('role="alert"'));
    assert.ok(states.includes('role="status"'));
    assert.ok(states.includes('aria-busy="true"'));
    assert.ok(states.includes('variant="primary"'));
    assert.ok(states.includes("Clear filters"));
    assert.ok(feedback.includes("StateLayout"));
  });

  it("truncates long search queries for filtered-empty titles", () => {
    const long = "a".repeat(80);
    const truncated = truncateStateQuery(long);
    assert.ok(truncated.endsWith("…"));
    assert.ok(truncated.length < long.length);
    assert.equal(truncateStateQuery("solar"), "solar");
  });

  it("wires ErrorState into production fetch failures with real retry handlers", () => {
    for (const file of [
      "components/sales/leads-directory/SalesLeadsClient.tsx",
      "components/sales/quotes/SalesQuotesClient.tsx",
      "components/sales/won-lost/WonLostClient.tsx",
      "components/sales/tasks/SalesTasksClient.tsx",
      "components/inbox/TeamInbox.tsx",
      "components/dashboard/company/commercial/CompanyProductsPage.tsx",
      "components/dashboard/company/commercial/CompanyInventoryPage.tsx",
      "components/dashboard/company/commercial/CompanyPackagesPage.tsx",
      "components/dashboard/company/settings/TeamSettingsViews.tsx",
      "components/dashboard/company/reports/CompanyReportsPage.tsx",
      "components/dashboard/company/quotations/CompanyQuotationsTable.tsx",
    ]) {
      const source = read(file);
      assert.ok(source.includes("ErrorState"), `${file} should use ErrorState for fetch errors`);
      assert.ok(source.includes("onRetry"), `${file} should wire onRetry to an existing reload`);
    }
  });

  it("uses FilteredEmptyState for table no-match rows where filters exist", () => {
    for (const file of [
      "components/sales/leads-directory/SalesLeadsClient.tsx",
      "components/sales/quotes/SalesQuotesClient.tsx",
      "components/sales/won-lost/WonLostClient.tsx",
    ]) {
      const source = read(file);
      assert.ok(source.includes("DataTableFilteredEmpty"), `${file} should use DataTableFilteredEmpty`);
      assert.ok(source.includes("clearAllFilters"), `${file} should expose clearAllFilters`);
    }
  });

  it("keeps ChartErrorState on shared ErrorState without full red wash", () => {
    const charts = read("components/sales/ui/Charts.tsx");
    assert.ok(charts.includes("ErrorState"));
    assert.equal(charts.includes("bg-sales-danger-soft px-4 text-center"), false);
  });

  it("documents phase 12 in the design system showcase", () => {
    const showcase = read("app/dev/sales-design-system/SalesDesignSystemClient.tsx");
    assert.ok(showcase.includes('id="states"'));
    assert.ok(showcase.includes("12 — Empty States & Feedback"));
    assert.ok(showcase.includes("StatesShowcaseSection"));
  });
});
