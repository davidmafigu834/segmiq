/**
 * Phase 13 — Overlay runtime & contextual surfaces.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("sales overlay components", () => {
  it("exports overlay primitives from the sales UI barrel", () => {
    const barrel = read("components/sales/ui/index.ts");
    for (const name of [
      "ConfirmDialog",
      "Popover",
      "PopoverTrigger",
      "PopoverContent",
      "OverlayPortal",
      "useFocusTrap",
      "InlineAlert",
    ]) {
      assert.ok(barrel.includes(name), `index.ts should export ${name}`);
    }
  });

  it("ConfirmDialog composes PremiumSheet with danger footer", () => {
    const src = read("components/sales/ui/ConfirmDialog.tsx");
    assert.ok(src.includes("PremiumSheet"));
    assert.ok(src.includes('"danger"'));
    assert.ok(src.includes("closeDisabled={loading}"));
  });

  it("PremiumSheet uses focus trap", () => {
    const src = read("components/sales/PremiumSheet.tsx");
    assert.ok(src.includes("useFocusTrap"));
    assert.ok(src.includes('role="dialog"'));
    assert.ok(src.includes("Escape"));
  });

  it("Popover portals with dismiss handlers", () => {
    const src = read("components/sales/ui/Popover.tsx");
    assert.ok(src.includes("OverlayPortal"));
    assert.ok(src.includes("Escape"));
    assert.ok(src.includes("mousedown"));
    assert.ok(src.includes("--sales-z-popover"));
  });

  it("company client layout mounts toast provider once", () => {
    const layout = read("app/client/layout.tsx");
    assert.ok(layout.includes("CompanyClientProviders"));
    const providers = read("components/dashboard/company/CompanyClientProviders.tsx");
    assert.ok(providers.includes("ToastProvider"));
  });
});
