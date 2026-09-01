/**
 * Field-close: convert existing lead to won deal + customer.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("convert lead won customer", () => {
  it("exposes API route and reopens NOT_QUALIFIED leads", () => {
    const service = read("lib/sales/leads/convert-lead-won-customer.ts");
    assert.ok(service.includes('previousStatus === "NOT_QUALIFIED"'));
    assert.ok(service.includes("closeDealWon"));
    assert.ok(service.includes('lifecycle: "customer"'));
    assert.ok(read("app/api/leads/[leadId]/convert-won-customer/route.ts").includes("convertLeadToWonCustomer"));
  });

  it("wires Record won customer on lead detail panel", () => {
    const panel = read("app/sales/leads/LeadDetailPanel.tsx");
    assert.ok(panel.includes("ConvertWonCustomerSheet"));
    assert.ok(panel.includes("Record won customer"));
  });
});
