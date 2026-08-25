import { canReassignLeads } from "@/lib/auth/permissions";
import { canModifyDeal } from "@/lib/sales/deals/permissions";
import { MAX_BULK, type ManagerActor, type ManagerRiskLevel } from "./types";

export type PolicyDecision =
  | { allowed: true; risk: ManagerRiskLevel; confirmationRequired: boolean }
  | { allowed: false; reason: string; code: "PERMISSION_DENIED" | "POLICY_BLOCKED" | "UNSUPPORTED" | "BULK_LIMIT" };

const WRITE_RISK: Record<string, ManagerRiskLevel> = {
  create_follow_ups: "LOW",
  pause_agent: "MEDIUM",
  resume_agent: "MEDIUM",
  cancel_proactive_job: "MEDIUM",
  schedule_appointment: "MEDIUM",
  reassign_leads: "HIGH",
  approve_quotation: "HIGH",
  reject_quotation: "HIGH",
  request_quote_changes: "HIGH",
  update_deal_stage: "HIGH",
  close_deal_won: "HIGH",
  close_deal_lost: "HIGH",
};

export function riskForTool(toolName: string, recordCount = 1): ManagerRiskLevel {
  const base = WRITE_RISK[toolName] ?? "MEDIUM";
  if (recordCount > 1 && (base === "LOW" || base === "MEDIUM")) return "HIGH";
  if (recordCount > 1 && base === "HIGH") return "HIGH";
  return base;
}

export function confirmationRequired(risk: ManagerRiskLevel, recordCount: number): boolean {
  if (risk === "VERY_HIGH") return true;
  if (risk === "HIGH") return true;
  if (risk === "MEDIUM" && recordCount > 1) return true;
  return false;
}

export function assertBulkSize(count: number): PolicyDecision | null {
  if (count > MAX_BULK) {
    return {
      allowed: false,
      code: "BULK_LIMIT",
      reason: `This would affect ${count} records. Command Center can change at most ${MAX_BULK} at a time.`,
    };
  }
  return null;
}

export function canRunManagerAgent(actor: ManagerActor): boolean {
  return actor.role === "CLIENT_MANAGER" || actor.role === "SUPER_ADMIN";
}

export function canManageTenant(actor: ManagerActor): boolean {
  return canReassignLeads(
    { userId: actor.userId, role: actor.role, clientId: actor.clientId },
    actor.clientId
  );
}

export async function evaluateWritePolicy(opts: {
  actor: ManagerActor;
  toolName: string;
  recordCount: number;
  dealId?: string;
}): Promise<PolicyDecision> {
  if (!canRunManagerAgent(opts.actor) || !canManageTenant(opts.actor)) {
    return {
      allowed: false,
      code: "PERMISSION_DENIED",
      reason: "You don't have permission to run this Command Center action.",
    };
  }

  const bulk = assertBulkSize(opts.recordCount);
  if (bulk) return bulk;

  if (opts.toolName === "update_deal_stage" || opts.toolName.startsWith("close_deal")) {
    if (!opts.dealId) {
      return { allowed: false, code: "POLICY_BLOCKED", reason: "A Deal is required." };
    }
    const check = await canModifyDeal(opts.dealId);
    if (!check.allowed) {
      return {
        allowed: false,
        code: "PERMISSION_DENIED",
        reason:
          "You don't have permission to change this Deal's stage. Company managers who don't sell can reassign ownership, but stage and Won/Lost stay with the Deal owner.",
      };
    }
  }

  const risk = riskForTool(opts.toolName, opts.recordCount);
  if (risk === "VERY_HIGH") {
    return {
      allowed: false,
      code: "UNSUPPORTED",
      reason: "This action is not available through Command Center.",
    };
  }

  return {
    allowed: true,
    risk,
    confirmationRequired: confirmationRequired(risk, opts.recordCount),
  };
}
