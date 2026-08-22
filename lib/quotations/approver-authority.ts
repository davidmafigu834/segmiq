export type ApproverTarget = {
  approverUserId?: string | null;
  approverRole?: string | null;
};

export type ApprovalActor = {
  id: string;
  role: string;
};

function roleLabel(role: string | null | undefined): string {
  if (!role) return "an authorised manager";
  if (role === "CLIENT_MANAGER") return "Sales Manager";
  if (role === "SUPER_ADMIN") return "Admin";
  return role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Whether this actor may decide a pending approval against the resolved policy steps. */
export function actorCanApproveTargets(actor: ApprovalActor, targets: ApproverTarget[]): boolean {
  if (actor.role === "SUPER_ADMIN") return true;
  if (actor.role === "SALESPERSON") return false;
  if (actor.role !== "CLIENT_MANAGER") return false;
  if (targets.length === 0) return true;

  return targets.some((target) => {
    if (target.approverUserId) return target.approverUserId === actor.id;
    const role = target.approverRole || "CLIENT_MANAGER";
    return role === "CLIENT_MANAGER" || role === "SUPER_ADMIN";
  });
}

export function awaitingApproverLabel(targets: ApproverTarget[]): string {
  const named = targets.find((target) => target.approverUserId);
  if (named?.approverRole) {
    return `Awaiting approval from ${roleLabel(named.approverRole)}`;
  }
  const role = targets.find((target) => target.approverRole)?.approverRole;
  if (role && role !== "CLIENT_MANAGER") {
    return `Awaiting approval from ${roleLabel(role)}`;
  }
  return "Awaiting approval from an authorised manager";
}

export function targetsFromUnknownRules(rules: unknown): ApproverTarget[] {
  if (!Array.isArray(rules)) return [];
  return rules.map((rule) => {
    const row = (rule ?? {}) as Record<string, unknown>;
    return {
      approverUserId:
        (row.approverUserId as string | null | undefined) ??
        (row.approver_user_id as string | null | undefined) ??
        null,
      approverRole:
        (row.approverRole as string | null | undefined) ??
        (row.approver_role as string | null | undefined) ??
        null,
    };
  });
}
