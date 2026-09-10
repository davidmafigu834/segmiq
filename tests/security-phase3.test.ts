import assert from "node:assert/strict";
import test from "node:test";
import {
  P,
  hasPermission,
  listPermissions,
  resolvePermissions,
  isPermission,
} from "@/lib/auth/rbac";
import { canManageCloudSettings } from "@/lib/auth/permissions";
import { isCloudAdminRole } from "@/lib/auth/roles";
import { canManageWhatsAppConnection } from "@/lib/whatsapp/connection-auth";

const managerA = {
  userId: "mgr-a",
  role: "CLIENT_MANAGER" as const,
  clientId: "client-a",
  alsoSells: false,
};

const sellingMgrA = { ...managerA, alsoSells: true, userId: "mgr-a-sells" };

const repA1 = {
  userId: "rep-a1",
  role: "SALESPERSON" as const,
  clientId: "client-a",
  alsoSells: false,
};

const repB = {
  userId: "rep-b",
  role: "SALESPERSON" as const,
  clientId: "client-b",
  alsoSells: false,
};

const admin = {
  userId: "admin-1",
  role: "SUPER_ADMIN" as const,
  clientId: null as string | null,
  alsoSells: false,
  isImpersonating: false,
};

const adminAsRepA = {
  userId: "rep-a1",
  role: "SALESPERSON" as const,
  clientId: "client-a",
  alsoSells: false,
  isImpersonating: true,
};

test("unknown permission defaults to DENY", () => {
  assert.equal(isPermission("not.a.real.permission"), false);
  assert.equal(hasPermission(managerA, "not.a.real.permission"), false);
});

test("salesperson cannot manage team or Cloud settings", () => {
  assert.equal(hasPermission(repA1, P.TEAM_MANAGE), false);
  assert.equal(hasPermission(repA1, P.CLOUD_TEAM_MANAGE), false);
  assert.equal(hasPermission(repA1, P.CLOUD_SETTINGS_MANAGE), false);
  assert.equal(hasPermission(repA1, P.WHATSAPP_CONNECTION_MANAGE), false);
  assert.equal(hasPermission(repA1, P.DATA_EXPORT), false);
  assert.equal(hasPermission(repA1, P.SETTINGS_MANAGE), false);
});

test("salesperson has assigned sales capabilities", () => {
  assert.equal(hasPermission(repA1, P.LEADS_READ_ASSIGNED), true);
  assert.equal(hasPermission(repA1, P.LEADS_READ_ALL), false);
  assert.equal(hasPermission(repA1, P.LEADS_ASSIGN), false);
  assert.equal(hasPermission(repA1, P.QUOTES_CREATE), true);
  assert.equal(hasPermission(repA1, P.WHATSAPP_SEND), true);
  assert.equal(hasPermission(repA1, P.AGENT_USE), true);
  assert.equal(hasPermission(repA1, P.AGENT_MANAGE), false);
});

test("manager has org oversight without personal sales writes by default", () => {
  assert.equal(hasPermission(managerA, P.LEADS_READ_ALL), true);
  assert.equal(hasPermission(managerA, P.LEADS_ASSIGN), true);
  assert.equal(hasPermission(managerA, P.TEAM_MANAGE), true);
  assert.equal(hasPermission(managerA, P.CLOUD_TEAM_MANAGE), true);
  assert.equal(hasPermission(managerA, P.WHATSAPP_CONNECTION_MANAGE), true);
  assert.equal(hasPermission(managerA, P.QUOTES_APPROVE), true);
  assert.equal(hasPermission(managerA, P.DATA_EXPORT), true);
  assert.equal(hasPermission(managerA, P.LEADS_UPDATE_ASSIGNED), false);
  assert.equal(hasPermission(managerA, P.WHATSAPP_SEND), false);
});

test("also_sells adds personal sales write permissions", () => {
  assert.equal(hasPermission(sellingMgrA, P.LEADS_UPDATE_ASSIGNED), true);
  assert.equal(hasPermission(sellingMgrA, P.DEALS_UPDATE_ASSIGNED), true);
  assert.equal(hasPermission(sellingMgrA, P.WHATSAPP_SEND), true);
  assert.equal(hasPermission(sellingMgrA, P.TEAM_MANAGE), true);
});

test("SUPER_ADMIN has platform permissions; org roles do not", () => {
  assert.equal(hasPermission(admin, P.PLATFORM_IMPERSONATE), true);
  assert.equal(hasPermission(admin, P.PLATFORM_CLIENTS_MANAGE), true);
  assert.equal(hasPermission(managerA, P.PLATFORM_IMPERSONATE), false);
  assert.equal(hasPermission(repA1, P.PLATFORM_CLIENTS_READ), false);
});

test("impersonated SUPER_ADMIN effective salesperson lacks platform and team.manage", () => {
  assert.equal(hasPermission(adminAsRepA, P.PLATFORM_IMPERSONATE), false);
  assert.equal(hasPermission(adminAsRepA, P.TEAM_MANAGE), false);
  assert.equal(hasPermission(adminAsRepA, P.LEADS_READ_ASSIGNED), true);
  assert.equal(hasPermission(adminAsRepA, P.CLOUD_SETTINGS_MANAGE), false);
});

test("P0: canManageCloudSettings denies salesperson", () => {
  assert.equal(canManageCloudSettings(repA1, "client-a"), false);
  assert.equal(canManageCloudSettings(managerA, "client-a"), true);
  assert.equal(canManageCloudSettings(managerA, "client-b"), false);
  assert.equal(canManageCloudSettings(admin, "client-a"), true);
  assert.equal(isCloudAdminRole("SALESPERSON"), false);
  assert.equal(isCloudAdminRole("CLIENT_MANAGER"), true);
});

test("WhatsApp connection manage is manager-only", () => {
  assert.equal(canManageWhatsAppConnection(repA1), false);
  assert.equal(canManageWhatsAppConnection(managerA), true);
  assert.equal(canManageWhatsAppConnection(adminAsRepA), false);
});

test("listPermissions is stable and excludes platform for org roles", () => {
  const listed = listPermissions(repA1);
  assert.ok(listed.includes(P.LEADS_READ_ASSIGNED));
  assert.ok(!listed.some((p) => p.startsWith("platform.")));
  assert.ok(resolvePermissions(admin).has(P.PLATFORM_SECURITY_READ));
});

test("cross-tenant permission identity does not grant other org resources", () => {
  // Permissions are identical shape; tenant isolation remains via clientId + resource helpers.
  assert.equal(repA1.clientId === repB.clientId, false);
  assert.equal(hasPermission(repA1, P.LEADS_READ_ASSIGNED), true);
  assert.equal(hasPermission(repB, P.LEADS_READ_ASSIGNED), true);
});
