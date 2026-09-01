/**
 * Phase 15 — Advanced Tables & Data Display.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("sales datatable Phase 15", () => {
  it("exports selection bar and hook from the sales UI barrel", () => {
    const barrel = read("components/sales/ui/index.ts");
    for (const name of ["DataTableSelectionBar", "useDataTableSelection", "DataTableSortableTh"]) {
      assert.ok(barrel.includes(name), `index.ts should export ${name}`);
    }
  });

  it("DataTableSelectionBar renders count and clear affordance", () => {
    const src = read("components/sales/ui/DataTable.tsx");
    assert.ok(src.includes("export function DataTableSelectionBar"));
    assert.ok(src.includes("selected"));
    assert.ok(src.includes("onClear"));
    assert.ok(src.includes('role="status"'));
  });

  it("useDataTableSelection tracks page-scoped IDs", () => {
    const src = read("components/sales/ui/useDataTableSelection.ts");
    assert.ok(src.includes("toggleRow"));
    assert.ok(src.includes("togglePage"));
    assert.ok(src.includes("indeterminate"));
    assert.ok(src.includes("allPageSelected"));
  });

  it("company leads and quotations use DataTableSelectionBar", () => {
    const leads = read("components/dashboard/company/leads/CompanyLeadsTableCard.tsx");
    assert.ok(leads.includes("DataTableSelectionBar"));
    assert.ok(!leads.includes("window.confirm"));
    const quotes = read("components/dashboard/company/quotations/CompanyQuotationsTable.tsx");
    assert.ok(quotes.includes("DataTableSelectionBar"));
  });

  it("customers table omits selection without bulk actions", () => {
    const customers = read("components/dashboard/company/customers/CompanyCustomersTableCard.tsx");
    assert.ok(!customers.includes("DataTableCheckboxCell"));
    assert.ok(!customers.includes("setChecked"));
  });

  it("sales directory lists use DataTableWorkspace and DataTablePagination", () => {
    for (const file of [
      "components/sales/leads-directory/SalesLeadsClient.tsx",
      "components/sales/quotes/SalesQuotesClient.tsx",
      "components/sales/won-lost/WonLostClient.tsx",
      "components/sales/tasks/SalesTasksClient.tsx",
    ]) {
      const src = read(file);
      assert.ok(src.includes("DataTableWorkspace"), `${file} should use DataTableWorkspace`);
      assert.ok(src.includes("DataTablePagination"), `${file} should use DataTablePagination`);
      assert.ok(!src.includes("menuId"), `${file} should not use hand-rolled menuId state`);
    }
  });

  it("legacy bulk bars migrate to DataTableSelectionBar", () => {
    assert.ok(read("components/client-leads/ClientLeadsTable.tsx").includes("DataTableSelectionBar"));
    assert.ok(read("components/agency/AllLeadsView.tsx").includes("DataTableSelectionBar"));
  });
});
