/**
 * Phase 14 — Overlays & Feedback (four-system architecture).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("sales overlay components", () => {
  it("exports Phase 14 overlay primitives from the sales UI barrel", () => {
    const barrel = read("components/sales/ui/index.ts");
    for (const name of [
      "ConfirmDialog",
      "Modal",
      "PremiumSheet",
      "Popover",
      "PopoverTrigger",
      "PopoverContent",
      "OverlayPortal",
      "useFocusTrap",
      "InlineAlert",
      "InlineLoading",
      "Stepper",
    ]) {
      assert.ok(barrel.includes(name), `index.ts should export ${name}`);
    }
  });

  it("ConfirmDialog composes PremiumSheet with destructive semantics", () => {
    const src = read("components/sales/ui/ConfirmDialog.tsx");
    assert.ok(src.includes("PremiumSheet"));
    assert.ok(src.includes('"alertdialog"'));
    assert.ok(src.includes("dismissOnBackdrop"));
    assert.ok(src.includes('"danger"'));
    assert.ok(src.includes("closeDisabled={loading}"));
  });

  it("PremiumSheet supports focus trap and backdrop dismiss control", () => {
    const src = read("components/sales/PremiumSheet.tsx");
    assert.ok(src.includes("useFocusTrap"));
    assert.ok(src.includes('role={dialogRole}'));
    assert.ok(src.includes("dismissOnBackdrop"));
    assert.ok(src.includes("Escape"));
  });

  it("Popover portals with dismiss handlers", () => {
    const src = read("components/sales/ui/Popover.tsx");
    assert.ok(src.includes("OverlayPortal"));
    assert.ok(src.includes("Escape"));
    assert.ok(src.includes("mousedown"));
    assert.ok(src.includes("--sales-z-popover"));
  });

  it("Stepper exposes aria-current for the active step", () => {
    const src = read("components/sales/ui/Stepper.tsx");
    assert.ok(src.includes('aria-current={isCurrent ? "step" : undefined}'));
  });

  it("InlineLoading uses status semantics", () => {
    const src = read("components/sales/ui/InlineLoading.tsx");
    assert.ok(src.includes('role="status"'));
    assert.ok(src.includes("Loader2"));
  });

  it("company client layout mounts toast provider once", () => {
    const layout = read("app/client/layout.tsx");
    assert.ok(layout.includes("CompanyClientProviders"));
    const providers = read("components/dashboard/company/CompanyClientProviders.tsx");
    assert.ok(providers.includes("ToastProvider"));
  });

  it("production flows migrate archive/delete confirms off window.confirm", () => {
    const leadPanel = read("app/sales/leads/LeadDetailPanel.tsx");
    assert.ok(leadPanel.includes("ConfirmDialog"));
    assert.ok(!leadPanel.includes('window.confirm("Archive this lead'));
    const listings = read("components/real-estate/ListingsManager.tsx");
    assert.ok(listings.includes("ConfirmDialog"));
    assert.ok(!listings.includes('window.confirm("Delete this listing'));
  });
});
