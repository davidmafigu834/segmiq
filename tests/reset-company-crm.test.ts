import assert from "node:assert/strict";
import test from "node:test";
import { COMPANY_CRM_RESET_PRESERVED, COMPANY_CRM_RESET_TABLES } from "../lib/clients/reset-crm";

test("company CRM reset wipes operational records and keeps the account setup", () => {
  for (const table of ["leads", "deals", "quotations", "whatsapp_messages", "notifications"]) {
    assert.ok(COMPANY_CRM_RESET_TABLES.includes(table as (typeof COMPANY_CRM_RESET_TABLES)[number]), table);
  }
  for (const table of ["clients", "users", "whatsapp_connections", "product_catalog", "projects", "subscriptions"]) {
    assert.ok(COMPANY_CRM_RESET_PRESERVED.includes(table as (typeof COMPANY_CRM_RESET_PRESERVED)[number]), table);
    assert.equal(
      (COMPANY_CRM_RESET_TABLES as readonly string[]).includes(table),
      false,
      `${table} must not be wiped`
    );
  }
});
