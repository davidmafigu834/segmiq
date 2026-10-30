import assert from "node:assert/strict";
import test from "node:test";
import {
  canManageClientProfile,
  evaluateCompanyProfileWriteAccess,
} from "../lib/auth/permissions";
import { canManageClientProfileRole } from "../lib/auth/roles";

test("company profile writes are limited to managers and platform admins", () => {
  assert.equal(canManageClientProfile("SUPER_ADMIN"), true);
  assert.equal(canManageClientProfile("CLIENT_MANAGER"), true);
  assert.equal(canManageClientProfile("SALESPERSON"), false);
  assert.equal(canManageClientProfile(null), false);
  assert.equal(canManageClientProfile(undefined), false);

  assert.equal(canManageClientProfileRole("SUPER_ADMIN"), true);
  assert.equal(canManageClientProfileRole("AGENCY_ADMIN"), true);
  assert.equal(canManageClientProfileRole("CLIENT_MANAGER"), true);
  assert.equal(canManageClientProfileRole("SALESPERSON"), false);
});

test("salesperson cannot PATCH their own organisation's company profile", () => {
  const result = evaluateCompanyProfileWriteAccess(
    { userId: "sp-1", role: "SALESPERSON", clientId: "org-a" },
    "org-a"
  );
  assert.deepEqual(result, {
    allowed: false,
    status: 403,
    error: "Only managers can edit company profile",
  });
});

test("solo-mode salesperson is also refused (role, not client mode, decides)", () => {
  const result = evaluateCompanyProfileWriteAccess(
    { userId: "solo-1", role: "SALESPERSON", clientId: "solo-org" },
    "solo-org"
  );
  assert.equal(result.allowed, false);
});

test("manager can write their own organisation but not another", () => {
  assert.deepEqual(
    evaluateCompanyProfileWriteAccess({ userId: "m-1", role: "CLIENT_MANAGER", clientId: "org-a" }, "org-a"),
    { allowed: true }
  );
  assert.deepEqual(
    evaluateCompanyProfileWriteAccess({ userId: "m-1", role: "CLIENT_MANAGER", clientId: "org-a" }, "org-b"),
    { allowed: false, status: 403, error: "Forbidden" }
  );
});

test("super admin may write any organisation; anonymous is 401", () => {
  assert.deepEqual(
    evaluateCompanyProfileWriteAccess({ userId: "sa", role: "SUPER_ADMIN", clientId: null }, "org-b"),
    { allowed: true }
  );
  assert.deepEqual(evaluateCompanyProfileWriteAccess(null, "org-a"), {
    allowed: false,
    status: 401,
    error: "Unauthorized",
  });
});
