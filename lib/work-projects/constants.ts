export const WORK_PROJECT_STATUSES = [
  "PLANNING",
  "SITE_ASSESSMENT",
  "AWAITING_CUSTOMER",
  "READY_TO_SCHEDULE",
  "SCHEDULED",
  "IN_PROGRESS",
  "QUALITY_CHECK",
  "HANDOVER",
  "COMPLETED",
  "ON_HOLD",
  "CANCELLED",
] as const;

export type WorkProjectStatus = (typeof WORK_PROJECT_STATUSES)[number];

export const WORK_PROJECT_STATUS_LABEL: Record<WorkProjectStatus, string> = {
  PLANNING: "Planning",
  SITE_ASSESSMENT: "Site Assessment",
  AWAITING_CUSTOMER: "Awaiting Customer",
  READY_TO_SCHEDULE: "Ready to Schedule",
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In Progress",
  QUALITY_CHECK: "Quality Check",
  HANDOVER: "Handover",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
  CANCELLED: "Cancelled",
};

export const WORK_PROJECT_OPEN_STATUSES: WorkProjectStatus[] = [
  "PLANNING",
  "SITE_ASSESSMENT",
  "AWAITING_CUSTOMER",
  "READY_TO_SCHEDULE",
  "SCHEDULED",
  "IN_PROGRESS",
  "QUALITY_CHECK",
  "HANDOVER",
  "ON_HOLD",
];

export const WORK_PROJECT_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type WorkProjectPriority = (typeof WORK_PROJECT_PRIORITIES)[number];

export const WORK_PROJECT_PRIORITY_LABEL: Record<WorkProjectPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export const WORK_PROJECT_WORKFLOWS = ["GENERAL_TRADES", "SOLAR_INSTALLATION"] as const;
export type WorkProjectWorkflow = (typeof WORK_PROJECT_WORKFLOWS)[number];

export const WORK_PROJECT_WORKFLOW_LABEL: Record<WorkProjectWorkflow, string> = {
  GENERAL_TRADES: "General Trades",
  SOLAR_INSTALLATION: "Solar Installation",
};

export const WORK_PROJECT_MEMBER_ROLES = [
  "OWNER",
  "PROJECT_MANAGER",
  "SALES_COORDINATOR",
  "ENGINEER",
  "TECHNICIAN",
  "INSTALLER",
  "FIELD_AGENT",
  "MEMBER",
] as const;

export type WorkProjectMemberRole = (typeof WORK_PROJECT_MEMBER_ROLES)[number];

export const WORK_PROJECT_ASSIGNABLE_ROLES = [
  "PROJECT_MANAGER",
  "SALES_COORDINATOR",
  "ENGINEER",
  "TECHNICIAN",
  "INSTALLER",
  "FIELD_AGENT",
  "MEMBER",
] as const;

export const WORK_PROJECT_FIELD_ROLES = ["ENGINEER", "TECHNICIAN", "INSTALLER", "FIELD_AGENT"] as const;

export const WORK_PROJECT_MEMBER_ROLE_LABEL: Record<WorkProjectMemberRole, string> = {
  OWNER: "Owner",
  PROJECT_MANAGER: "Project manager",
  SALES_COORDINATOR: "Sales coordinator",
  ENGINEER: "Engineer",
  TECHNICIAN: "Technician",
  INSTALLER: "Installer",
  FIELD_AGENT: "Field agent",
  MEMBER: "Member",
};

export const WORK_PROJECT_TASK_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"] as const;
export type WorkProjectTaskStatus = (typeof WORK_PROJECT_TASK_STATUSES)[number];

export const WORK_PROJECT_TASK_STATUS_LABEL: Record<WorkProjectTaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const WORK_PROJECT_TASK_TYPES = [
  "GENERAL",
  "SITE_ASSESSMENT",
  "CUSTOMER_ACTION",
  "TECHNICAL",
  "INSTALLATION_PREP",
  "DOCUMENTATION",
  "QUALITY",
  "OTHER",
] as const;
export type WorkProjectTaskType = (typeof WORK_PROJECT_TASK_TYPES)[number];

export const WORK_PROJECT_TASK_TYPE_LABEL: Record<WorkProjectTaskType, string> = {
  GENERAL: "General",
  SITE_ASSESSMENT: "Site assessment",
  CUSTOMER_ACTION: "Customer action",
  TECHNICAL: "Technical",
  INSTALLATION_PREP: "Installation prep",
  DOCUMENTATION: "Documentation",
  QUALITY: "Quality",
  OTHER: "Other",
};

export const WORK_PROJECT_VISIT_TYPES = [
  "SITE_ASSESSMENT",
  "INSTALLATION",
  "INSPECTION",
  "CUSTOMER_MEETING",
  "MAINTENANCE",
  "SERVICE",
  "OTHER",
] as const;
export type WorkProjectVisitType = (typeof WORK_PROJECT_VISIT_TYPES)[number];

export const WORK_PROJECT_VISIT_TYPE_LABEL: Record<WorkProjectVisitType, string> = {
  SITE_ASSESSMENT: "Site assessment",
  INSTALLATION: "Installation",
  INSPECTION: "Inspection",
  CUSTOMER_MEETING: "Customer meeting",
  MAINTENANCE: "Maintenance",
  SERVICE: "Service",
  OTHER: "Other",
};

export const WORK_PROJECT_VISIT_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "ON_SITE",
  "COMPLETED",
  "CANCELLED",
  "NO_ACCESS",
  "RESCHEDULED",
] as const;
export type WorkProjectVisitStatus = (typeof WORK_PROJECT_VISIT_STATUSES)[number];

export const WORK_PROJECT_VISIT_STATUS_LABEL: Record<WorkProjectVisitStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  ON_SITE: "On site",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_ACCESS: "No access",
  RESCHEDULED: "Rescheduled",
};

export const VISIT_CANCEL_REASONS = [
  "Customer unavailable",
  "Weather",
  "Team unavailable",
  "Access issue",
  "Project cancelled",
  "Other",
] as const;

export const SOLAR_PHOTO_CATEGORIES = [
  "ROOF",
  "DB_BOARD",
  "METER",
  "INVERTER_LOCATION",
  "BATTERY_LOCATION",
  "EXISTING_SOLAR",
  "SITE_GENERAL",
  "OTHER",
] as const;

export const SOLAR_PHOTO_CATEGORY_LABEL: Record<(typeof SOLAR_PHOTO_CATEGORIES)[number], string> = {
  ROOF: "Roof",
  DB_BOARD: "DB board",
  METER: "Meter",
  INVERTER_LOCATION: "Inverter location",
  BATTERY_LOCATION: "Battery location",
  EXISTING_SOLAR: "Existing solar",
  SITE_GENERAL: "Site",
  OTHER: "Other",
};

export const WORK_PROJECT_EVENT_TYPES = [
  "PROJECT_CREATED",
  "STATUS_CHANGED",
  "OWNER_CHANGED",
  "SCHEDULE_CHANGED",
  "NOTE_ADDED",
  "CUSTOMER_REQUIREMENT_UPDATED",
  "PROJECT_COMPLETED",
  "PROJECT_REOPENED",
  "PROJECT_CANCELLED",
  "PRIORITY_CHANGED",
  "DETAILS_UPDATED",
  "MEMBER_ADDED",
  "MEMBER_REMOVED",
  "MEMBER_ROLE_CHANGED",
  "TASK_CREATED",
  "TASK_ASSIGNED",
  "TASK_STARTED",
  "TASK_COMPLETED",
  "TASK_BLOCKED",
  "TASK_CANCELLED",
  "VISIT_SCHEDULED",
  "VISIT_RESCHEDULED",
  "VISIT_COMPLETED",
  "VISIT_CANCELLED",
  "SITE_ASSESSMENT_COMPLETED",
  "PROJECT_VALUE_CHANGED",
  "PAYMENT_SCHEDULE_CREATED",
  "PAYMENT_TERM_ADDED",
  "PAYMENT_RECORDED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_REVERSED",
  "PAYMENT_PROOF_ADDED",
  "PROJECT_FULLY_PAID",
  "EQUIPMENT_LIST_CREATED",
  "EQUIPMENT_UPDATED",
  "STOCK_RESERVED",
  "STOCK_PARTIALLY_RESERVED",
  "STOCK_RELEASED",
  "PROCUREMENT_REQUIRED",
  "INSTALLATION_CREATED",
  "INSTALLATION_SCHEDULED",
  "INSTALLATION_STARTED",
  "INSTALLATION_PAUSED",
  "INSTALLATION_WORK_COMPLETED",
  "EQUIPMENT_ISSUED",
  "EQUIPMENT_RETURNED",
  "SERIAL_RECORDED",
  "QA_COMPLETED",
  "QA_FAILED",
  "COMMISSIONING_COMPLETED",
  "COMMISSIONING_FAILED",
  "HANDOVER_COMPLETED",
  "INSTALLED_ASSET_CREATED",
  "WARRANTY_CREATED",
] as const;

export type WorkProjectEventType = (typeof WORK_PROJECT_EVENT_TYPES)[number];

export const WORK_PROJECT_EVENT_LABEL: Record<WorkProjectEventType, string> = {
  PROJECT_CREATED: "Project created",
  STATUS_CHANGED: "Status changed",
  OWNER_CHANGED: "Owner changed",
  SCHEDULE_CHANGED: "Schedule changed",
  NOTE_ADDED: "Note",
  CUSTOMER_REQUIREMENT_UPDATED: "Customer requirements updated",
  PROJECT_COMPLETED: "Project completed",
  PROJECT_REOPENED: "Project reopened",
  PROJECT_CANCELLED: "Project cancelled",
  PRIORITY_CHANGED: "Priority changed",
  DETAILS_UPDATED: "Details updated",
  MEMBER_ADDED: "Team member added",
  MEMBER_REMOVED: "Team member removed",
  MEMBER_ROLE_CHANGED: "Team role changed",
  TASK_CREATED: "Task created",
  TASK_ASSIGNED: "Task assigned",
  TASK_STARTED: "Task started",
  TASK_COMPLETED: "Task completed",
  TASK_BLOCKED: "Task blocked",
  TASK_CANCELLED: "Task cancelled",
  VISIT_SCHEDULED: "Visit scheduled",
  VISIT_RESCHEDULED: "Visit rescheduled",
  VISIT_COMPLETED: "Visit completed",
  VISIT_CANCELLED: "Visit cancelled",
  SITE_ASSESSMENT_COMPLETED: "Site assessment completed",
  PROJECT_VALUE_CHANGED: "Project value changed",
  PAYMENT_SCHEDULE_CREATED: "Payment schedule created",
  PAYMENT_TERM_ADDED: "Payment milestone added",
  PAYMENT_RECORDED: "Payment recorded",
  PAYMENT_CONFIRMED: "Payment confirmed",
  PAYMENT_REVERSED: "Payment reversed",
  PAYMENT_PROOF_ADDED: "Payment proof added",
  PROJECT_FULLY_PAID: "Project fully paid",
  EQUIPMENT_LIST_CREATED: "Equipment list created",
  EQUIPMENT_UPDATED: "Equipment updated",
  STOCK_RESERVED: "Stock reserved",
  STOCK_PARTIALLY_RESERVED: "Stock partially reserved",
  STOCK_RELEASED: "Reservation released",
  PROCUREMENT_REQUIRED: "Procurement required",
  INSTALLATION_CREATED: "Installation created",
  INSTALLATION_SCHEDULED: "Installation scheduled",
  INSTALLATION_STARTED: "Installation started",
  INSTALLATION_PAUSED: "Installation paused",
  INSTALLATION_WORK_COMPLETED: "Installation work completed",
  EQUIPMENT_ISSUED: "Equipment issued",
  EQUIPMENT_RETURNED: "Equipment returned",
  SERIAL_RECORDED: "Serial number recorded",
  QA_COMPLETED: "Quality check completed",
  QA_FAILED: "Quality check needs rework",
  COMMISSIONING_COMPLETED: "Commissioning completed",
  COMMISSIONING_FAILED: "Commissioning failed",
  HANDOVER_COMPLETED: "Handover completed",
  INSTALLED_ASSET_CREATED: "Installed asset created",
  WARRANTY_CREATED: "Warranty recorded",
};

export function isWorkProjectMemberRole(value: string): value is WorkProjectMemberRole {
  return (WORK_PROJECT_MEMBER_ROLES as readonly string[]).includes(value);
}

export function isAssignableProjectRole(value: string): boolean {
  return (WORK_PROJECT_ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

export function workProjectMemberRoleLabel(role: string): string {
  if (isWorkProjectMemberRole(role)) return WORK_PROJECT_MEMBER_ROLE_LABEL[role];
  return role;
}

export function isWorkProjectTaskStatus(value: string): value is WorkProjectTaskStatus {
  return (WORK_PROJECT_TASK_STATUSES as readonly string[]).includes(value);
}

export function isWorkProjectTaskType(value: string): value is WorkProjectTaskType {
  return (WORK_PROJECT_TASK_TYPES as readonly string[]).includes(value);
}

export function isWorkProjectVisitType(value: string): value is WorkProjectVisitType {
  return (WORK_PROJECT_VISIT_TYPES as readonly string[]).includes(value);
}

export function isWorkProjectVisitStatus(value: string): value is WorkProjectVisitStatus {
  return (WORK_PROJECT_VISIT_STATUSES as readonly string[]).includes(value);
}

export function workProjectVisitTypeLabel(value: string): string {
  if (isWorkProjectVisitType(value)) return WORK_PROJECT_VISIT_TYPE_LABEL[value];
  return value;
}

export function workProjectVisitStatusLabel(value: string): string {
  if (isWorkProjectVisitStatus(value)) return WORK_PROJECT_VISIT_STATUS_LABEL[value];
  return value;
}

export function workProjectTaskStatusLabel(value: string): string {
  if (isWorkProjectTaskStatus(value)) return WORK_PROJECT_TASK_STATUS_LABEL[value];
  return value;
}

export function workProjectTaskTypeLabel(value: string): string {
  if (isWorkProjectTaskType(value)) return WORK_PROJECT_TASK_TYPE_LABEL[value];
  return value;
}

export function isWorkProjectStatus(value: string): value is WorkProjectStatus {
  return (WORK_PROJECT_STATUSES as readonly string[]).includes(value);
}

export function isWorkProjectPriority(value: string): value is WorkProjectPriority {
  return (WORK_PROJECT_PRIORITIES as readonly string[]).includes(value);
}

export function isWorkProjectWorkflow(value: string): value is WorkProjectWorkflow {
  return (WORK_PROJECT_WORKFLOWS as readonly string[]).includes(value);
}

export function workProjectStatusLabel(status: string): string {
  if (isWorkProjectStatus(status)) return WORK_PROJECT_STATUS_LABEL[status];
  return status;
}

export function workProjectPriorityLabel(priority: string): string {
  if (isWorkProjectPriority(priority)) return WORK_PROJECT_PRIORITY_LABEL[priority];
  return priority;
}

export function workProjectWorkflowLabel(workflow: string): string {
  if (isWorkProjectWorkflow(workflow)) return WORK_PROJECT_WORKFLOW_LABEL[workflow];
  return workflow;
}

/**
 * Open stages can move among themselves, onto Completed, On Hold, or Cancelled.
 * Completed and Cancelled stay put until a manager reopens them into an open stage.
 */
export function canTransitionWorkProjectStatus(
  from: WorkProjectStatus,
  to: WorkProjectStatus,
  opts?: { allowReopen?: boolean }
): boolean {
  if (from === to) return false;
  const fromOpen = WORK_PROJECT_OPEN_STATUSES.includes(from);
  const toOpen = WORK_PROJECT_OPEN_STATUSES.includes(to);
  if (fromOpen && (toOpen || to === "COMPLETED" || to === "CANCELLED")) return true;
  if ((from === "COMPLETED" || from === "CANCELLED") && opts?.allowReopen && toOpen) return true;
  return false;
}

export function nextOperationalStep(status: WorkProjectStatus, custom: string | null | undefined): string {
  const written = custom?.trim();
  if (written) return written;
  switch (status) {
    case "PLANNING":
      return "Confirm the site and customer requirements, then move to site assessment.";
    case "SITE_ASSESSMENT":
      return "Finish the site assessment, then mark the project ready to schedule.";
    case "AWAITING_CUSTOMER":
      return "Waiting on the customer before work can continue.";
    case "READY_TO_SCHEDULE":
      return "Set a scheduled start, then mark the project scheduled.";
    case "SCHEDULED":
      return "Start the work when the team is on site.";
    case "IN_PROGRESS":
      return "Finish the work, then move to quality check.";
    case "QUALITY_CHECK":
      return "Pass quality check, then hand the work to the customer.";
    case "HANDOVER":
      return "Complete the project once the customer has the work.";
    case "COMPLETED":
      return "Delivery is complete.";
    case "ON_HOLD":
      return "Resolve the hold, then return the project to the right stage.";
    case "CANCELLED":
      return "Delivery was cancelled. The sales deal is unchanged.";
    default:
      return "Update the project status.";
  }
}
