export const INSTALLATION_STATUSES = [
  "PLANNED",
  "SCHEDULED",
  "IN_PROGRESS",
  "PAUSED",
  "WORK_COMPLETED",
  "QA_PENDING",
  "COMMISSIONING_PENDING",
  "HANDOVER_PENDING",
  "COMPLETED",
  "CANCELLED",
] as const;

export const INSTALLATION_TYPES = ["PRIMARY", "PHASED", "RETURN", "EXPANSION", "REMEDIAL"] as const;

export const QA_OUTCOMES = ["PASS", "PASS_WITH_NOTES", "REQUIRES_REWORK"] as const;

export const INSTALLATION_PHOTO_CATEGORIES = [
  "BEFORE",
  "PV_ARRAY",
  "INVERTER",
  "BATTERY",
  "DB_BOARD",
  "PROTECTION",
  "CABLE_ROUTING",
  "COMPLETED_INSTALLATION",
  "OTHER",
] as const;

export const OPERATIONAL_PROJECT_ROLES = [
  "OWNER",
  "PROJECT_MANAGER",
  "ENGINEER",
  "TECHNICIAN",
  "INSTALLER",
] as const;

export const SOLAR_CHECKLIST_VERSION = 1;

export const SOLAR_INSTALLATION_CHECKLIST = [
  { section: "Site preparation", key: "access_confirmed", label: "Customer and site access confirmed" },
  { section: "Site preparation", key: "equipment_delivered", label: "Equipment delivered" },
  { section: "Site preparation", key: "work_area_safe", label: "Work area safe" },
  { section: "Site preparation", key: "location_confirmed", label: "Installation location confirmed" },
  { section: "PV installation", key: "mounting_completed", label: "Panel mounting completed" },
  { section: "PV installation", key: "panels_secured", label: "Panels secured" },
  { section: "PV installation", key: "cable_routing", label: "Cable routing completed" },
  { section: "PV installation", key: "pv_isolation", label: "PV isolation and protection installed" },
  { section: "Inverter", key: "inverter_installed", label: "Inverter installed" },
  { section: "Inverter", key: "ventilation", label: "Ventilation clearance checked" },
  { section: "Inverter", key: "inverter_wiring", label: "Inverter wiring completed" },
  { section: "Inverter", key: "inverter_protection", label: "Protection equipment installed" },
  { section: "Batteries", key: "batteries_installed", label: "Batteries installed" },
  { section: "Batteries", key: "battery_comms", label: "Battery communication connected" },
  { section: "Batteries", key: "polarity", label: "Polarity checked" },
  { section: "Batteries", key: "battery_config", label: "Battery configuration completed" },
  { section: "Electrical", key: "ac_connection", label: "AC connection completed" },
  { section: "Electrical", key: "earthing", label: "Earthing checked" },
  { section: "Electrical", key: "db_work", label: "Distribution board work completed" },
  { section: "Electrical", key: "labels", label: "Labels and isolators installed" },
  { section: "Finishing", key: "cables_secured", label: "Cables secured" },
  { section: "Finishing", key: "area_cleaned", label: "Work area cleaned" },
  { section: "Finishing", key: "photos_captured", label: "Installation photographs captured" },
] as const;

export const SOLAR_QA_CHECKS = [
  { key: "visual", label: "Visual installation inspection" },
  { key: "protection", label: "Protection devices present" },
  { key: "terminations", label: "Cable termination observation" },
  { key: "polarity", label: "Polarity checked" },
  { key: "earthing", label: "Earthing check recorded" },
  { key: "inverter_power", label: "Inverter powers correctly" },
  { key: "battery_comms", label: "Battery communication established" },
  { key: "pv_input", label: "PV input detected" },
  { key: "load_test", label: "Load test performed" },
  { key: "monitoring", label: "Monitoring or app connectivity checked, if applicable" },
] as const;

export const SOLAR_HANDOVER_CHECKS = [
  { key: "operation", label: "System operation explained" },
  { key: "inverter_controls", label: "Inverter basic controls explained" },
  { key: "monitoring", label: "Monitoring explained" },
  { key: "shutdown", label: "Safe shutdown explained" },
  { key: "warranty", label: "Warranty information provided" },
  { key: "manuals", label: "Manuals provided" },
  { key: "questions", label: "Customer questions answered" },
  { key: "clean", label: "Site left clean" },
  { key: "outstanding", label: "Outstanding items explained" },
] as const;

export type WarrantyLifecycle = "NOT_STARTED" | "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "VOIDED";

export function equipmentNeedsSerial(description: string, requiresSerial: boolean | null | undefined): boolean {
  if (requiresSerial === true) return true;
  if (requiresSerial === false) return false;
  const name = description.toLowerCase();
  if (/panel|module/.test(name)) return false;
  return /inverter|battery|controller/.test(name);
}

export function warrantyStatus(
  row: { voided_at?: string | null; starts_at: string; expires_at?: string | null },
  now = new Date()
): WarrantyLifecycle {
  if (row.voided_at) return "VOIDED";
  const start = new Date(row.starts_at);
  if (Number.isNaN(start.getTime()) || start.getTime() > now.getTime()) return "NOT_STARTED";
  if (!row.expires_at) return "ACTIVE";
  const end = new Date(row.expires_at);
  if (Number.isNaN(end.getTime())) return "ACTIVE";
  if (end.getTime() < now.getTime()) return "EXPIRED";
  const soon = new Date(now.getTime());
  soon.setDate(soon.getDate() + 30);
  if (end.getTime() <= soon.getTime()) return "EXPIRING_SOON";
  return "ACTIVE";
}

export function schedulingWarnings(input: {
  paymentReady: boolean;
  assessmentRequired: boolean;
  assessmentReady: boolean;
  equipmentGaps: Array<{ description: string; missing: number }>;
}): string[] {
  const warnings: string[] = [];
  if (!input.paymentReady) warnings.push("Payment gate is not satisfied.");
  if (input.assessmentRequired && !input.assessmentReady) warnings.push("Site assessment is not complete.");
  for (const gap of input.equipmentGaps) {
    warnings.push(`${gap.missing} × ${gap.description} still not reserved.`);
  }
  return warnings;
}

export function installationAttention(input: {
  status: string;
  scheduledStartAt?: string | null;
  equipmentIssuedShort: boolean;
  qaOutcome?: string | null;
  commissioningStatus?: string | null;
  handoverStatus?: string | null;
  projectStatus: string;
  missingSerials: string[];
  outstanding: number | null;
  now?: Date;
}): string[] {
  const now = input.now ?? new Date();
  const lines: string[] = [];
  const scheduled = input.scheduledStartAt ? new Date(input.scheduledStartAt) : null;
  if (["SCHEDULED", "IN_PROGRESS", "PAUSED"].includes(input.status) && input.equipmentIssuedShort) {
    lines.push("Installation is scheduled but equipment is not fully issued.");
  }
  if (input.status === "SCHEDULED" && scheduled && scheduled.getTime() < now.getTime()) {
    lines.push("Installation is overdue.");
  }
  if (input.status === "QA_PENDING" && !input.qaOutcome) {
    lines.push("Physical work is complete but quality check is missing.");
  }
  if (input.qaOutcome === "REQUIRES_REWORK") lines.push("Quality check requires rework.");
  if (input.qaOutcome && input.qaOutcome !== "REQUIRES_REWORK" && !input.commissioningStatus) {
    lines.push("Quality check passed but commissioning is missing.");
  }
  if (input.commissioningStatus === "FAILED") lines.push("Commissioning failed.");
  if (input.commissioningStatus === "COMPLETED" && input.handoverStatus !== "COMPLETED") {
    lines.push("Commissioning is complete but handover is missing.");
  }
  if (input.status === "COMPLETED" && input.projectStatus !== "COMPLETED" && input.projectStatus !== "CANCELLED") {
    lines.push("Project is operationally complete and still open.");
  }
  for (const name of input.missingSerials) lines.push(`Serial number missing for ${name}.`);
  if ((input.outstanding ?? 0) > 0 && (input.handoverStatus === "COMPLETED" || input.status === "HANDOVER_PENDING")) {
    lines.push("Customer balance is still outstanding at handover.");
  }
  return lines;
}

export function completionReadiness(input: {
  workflow: string;
  projectStatus: string;
  installationStatus: string | null;
  qaOutcome: string | null;
  commissioningStatus: string | null;
  handoverStatus: string | null;
  installedQuantity: number;
  assetCount: number;
  outstanding: number | null;
}): { canComplete: boolean; blockers: string[]; warnings: string[] } {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (input.projectStatus === "COMPLETED") blockers.push("Project is already complete.");
  if (input.projectStatus === "CANCELLED") blockers.push("Cancelled projects cannot be completed.");
  const solar = input.workflow === "SOLAR_INSTALLATION";
  const hasInstallation = Boolean(input.installationStatus);
  if (solar && input.installationStatus !== "COMPLETED") blockers.push("Installation handover is not complete.");
  if (!solar && hasInstallation && input.installationStatus !== "COMPLETED" && input.installationStatus !== "CANCELLED") {
    blockers.push("The open installation has not been handed over.");
  }
  if (hasInstallation && input.installationStatus !== "CANCELLED") {
    if (solar && input.qaOutcome !== "PASS" && input.qaOutcome !== "PASS_WITH_NOTES") blockers.push("Quality check has not passed.");
    if (solar && input.commissioningStatus !== "COMPLETED") blockers.push("Commissioning is not complete.");
    if (solar && input.handoverStatus !== "COMPLETED") blockers.push("Handover is not complete.");
    if (solar && input.installedQuantity > 0 && input.assetCount === 0) blockers.push("Installed equipment has no asset record.");
  }
  if ((input.outstanding ?? 0) > 0) warnings.push("Customer still has an outstanding balance.");
  return { canComplete: blockers.length === 0, blockers, warnings };
}
