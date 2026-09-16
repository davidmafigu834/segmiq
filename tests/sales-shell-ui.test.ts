import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const shellSource = readFileSync("components/sales/shell/SalesAppShell.tsx", "utf8");
const loadingSource = readFileSync("app/sales/loading.tsx", "utf8");
const dashboardCss = readFileSync("app/company-dashboard.css", "utf8");

describe("salesperson workspace shell", () => {
  it("exposes a semantic, keyboard-reachable main region", () => {
    assert.match(shellSource, /href="#sales-main-content"/);
    assert.match(shellSource, /<main/);
    assert.match(shellSource, /id="sales-main-content"/);
    assert.match(shellSource, /tabIndex=\{-1\}/);
  });

  it("keeps salesperson visual refinements scoped away from manager pages", () => {
    assert.match(shellSource, /data-sales-portal="true"/);
    assert.match(dashboardCss, /\.sales-dashboard-premium\[data-sales-portal="true"\]/);
  });

  it("provides an accessible route loading state", () => {
    assert.match(loadingSource, /role="status"/);
    assert.match(loadingSource, /aria-live="polite"/);
    assert.match(loadingSource, /aria-busy="true"/);
  });
});
