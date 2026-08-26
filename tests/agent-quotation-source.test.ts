import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  catalogSearchNote,
  isBuiltinQuoteTemplate,
  packageHasSellableComponents,
} from "../lib/agent/tools/quotation";
import { validateToolInput } from "../lib/agent/tools/registry";

describe("agent quotation source guards", () => {
  it("treats builtin presentation layouts as templates, not catalogues", () => {
    assert.equal(isBuiltinQuoteTemplate({ is_builtin: true }), true);
    assert.equal(isBuiltinQuoteTemplate({ builtin_key: "residential-premium-solar" }), true);
    assert.equal(isBuiltinQuoteTemplate({ is_builtin: false, builtin_key: null }), false);
  });

  it("requires a priced package or a positive fixed price", () => {
    assert.equal(packageHasSellableComponents([], null), false);
    assert.equal(packageHasSellableComponents([{ unit_price: 0 }], null), false);
    assert.equal(packageHasSellableComponents([{ unit_price: 1 }], null), true);
    assert.equal(packageHasSellableComponents([], 2500), true);
  });

  it("tells the agent to escalate when no package is ready to quote", () => {
    assert.match(
      catalogSearchNote({ readyPackageCount: 0, packageCount: 1, productCount: 2 }),
      /escalate/i
    );
    assert.match(
      catalogSearchNote({ readyPackageCount: 1, packageCount: 1, productCount: 0 }),
      /ready_to_quote/
    );
  });

  it("rejects quotation_prepare_draft without a package_id", () => {
    const missing = validateToolInput("quotation_prepare_draft", {
      template_id: "08107b5a-cb46-4d51-a6fd-5bc385257565",
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.match(missing.error, /package_id/);

    const ok = validateToolInput("quotation_prepare_draft", {
      package_id: "ee1c2fb1-be26-48dc-8488-bf7dcef3b088",
    });
    assert.equal(ok.ok, true);
  });
});
