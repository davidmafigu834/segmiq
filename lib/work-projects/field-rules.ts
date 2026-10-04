import {
  SOLAR_PHOTO_CATEGORIES,
  WORK_PROJECT_FIELD_ROLES,
  type WorkProjectMemberRole,
  type WorkProjectTaskStatus,
  type WorkProjectVisitStatus,
} from "@/lib/work-projects/constants";

export const SOLAR_ASSESSMENT_SCHEMA_VERSION = 1;

export type SolarLoadItem = {
  name: string;
  quantity: number;
  watts: number | null;
  essential: boolean;
  notes: string | null;
};

export type SolarAssessmentData = {
  site: {
    address: string | null;
    propertyType: string | null;
    siteContact: string | null;
    accessNotes: string | null;
  };
  power: {
    gridAvailable: "yes" | "no" | "unknown" | null;
    supplyType: string | null;
    generatorPresent: "yes" | "no" | "unknown" | null;
    existingSolar: "yes" | "no" | "unknown" | null;
    dbBoardCondition: string | null;
    earthing: string | null;
  };
  loads: SolarLoadItem[];
  loadNotes: string | null;
  roof: {
    roofType: string | null;
    usableArea: string | null;
    orientation: string | null;
    shading: string | null;
    condition: string | null;
    groundMount: "yes" | "no" | "unknown" | null;
    observations: string | null;
  };
  equipment: {
    inverterLocation: string | null;
    batteryLocation: string | null;
    ventilation: string | null;
    weatherProtection: string | null;
    cableNotes: string | null;
  };
  photos: Array<{ documentId: string; category: string; note: string | null }>;
  outcome: "suitable" | "technical_review" | "another_visit" | "site_issue" | "other" | null;
  outcomeNotes: string | null;
};

export function emptySolarAssessment(): SolarAssessmentData {
  return {
    site: { address: null, propertyType: null, siteContact: null, accessNotes: null },
    power: {
      gridAvailable: null,
      supplyType: null,
      generatorPresent: null,
      existingSolar: null,
      dbBoardCondition: null,
      earthing: null,
    },
    loads: [],
    loadNotes: null,
    roof: {
      roofType: null,
      usableArea: null,
      orientation: null,
      shading: null,
      condition: null,
      groundMount: null,
      observations: null,
    },
    equipment: {
      inverterLocation: null,
      batteryLocation: null,
      ventilation: null,
      weatherProtection: null,
      cableNotes: null,
    },
    photos: [],
    outcome: null,
    outcomeNotes: null,
  };
}

const OUTCOMES = new Set(["suitable", "technical_review", "another_visit", "site_issue", "other"]);
const TRI = new Set(["yes", "no", "unknown"]);

function text(value: unknown, max = 500): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function tri(value: unknown): "yes" | "no" | "unknown" | null {
  return typeof value === "string" && TRI.has(value) ? (value as "yes" | "no" | "unknown") : null;
}

export function parseSolarAssessment(input: unknown): { ok: true; data: SolarAssessmentData } | { ok: false; error: string } {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const site = (source.site ?? {}) as Record<string, unknown>;
  const power = (source.power ?? {}) as Record<string, unknown>;
  const roof = (source.roof ?? {}) as Record<string, unknown>;
  const equipment = (source.equipment ?? {}) as Record<string, unknown>;
  const rawLoads = Array.isArray(source.loads) ? source.loads : [];
  if (rawLoads.length > 40) return { ok: false, error: "Too many loads." };
  const loads: SolarLoadItem[] = [];
  for (const item of rawLoads) {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const name = text(row.name, 80);
    if (!name) return { ok: false, error: "Each load needs a name." };
    const quantity = Number(row.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return { ok: false, error: "Load quantity must be a whole number." };
    }
    const watts = row.watts == null || row.watts === "" ? null : Number(row.watts);
    if (watts != null && (!Number.isFinite(watts) || watts < 0 || watts > 100000)) {
      return { ok: false, error: "Load watts must be a number, or left blank." };
    }
    loads.push({
      name,
      quantity,
      watts,
      essential: Boolean(row.essential),
      notes: text(row.notes, 200),
    });
  }
  const photosRaw = Array.isArray(source.photos) ? source.photos : [];
  const photos = photosRaw.slice(0, 40).flatMap((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const documentId = text(row.documentId, 80);
    const category = text(row.category, 40);
    if (!documentId || !category) return [];
    if (!(SOLAR_PHOTO_CATEGORIES as readonly string[]).includes(category)) return [];
    return [{ documentId, category, note: text(row.note, 200) }];
  });
  const outcome = typeof source.outcome === "string" && OUTCOMES.has(source.outcome)
    ? (source.outcome as SolarAssessmentData["outcome"])
    : null;
  return {
    ok: true,
    data: {
      site: {
        address: text(site.address, 300),
        propertyType: text(site.propertyType, 80),
        siteContact: text(site.siteContact, 120),
        accessNotes: text(site.accessNotes, 500),
      },
      power: {
        gridAvailable: tri(power.gridAvailable),
        supplyType: text(power.supplyType, 80),
        generatorPresent: tri(power.generatorPresent),
        existingSolar: tri(power.existingSolar),
        dbBoardCondition: text(power.dbBoardCondition, 200),
        earthing: text(power.earthing, 200),
      },
      loads,
      loadNotes: text(source.loadNotes, 500),
      roof: {
        roofType: text(roof.roofType, 80),
        usableArea: text(roof.usableArea, 80),
        orientation: text(roof.orientation, 80),
        shading: text(roof.shading, 80),
        condition: text(roof.condition, 200),
        groundMount: tri(roof.groundMount),
        observations: text(roof.observations, 500),
      },
      equipment: {
        inverterLocation: text(equipment.inverterLocation, 200),
        batteryLocation: text(equipment.batteryLocation, 200),
        ventilation: text(equipment.ventilation, 200),
        weatherProtection: text(equipment.weatherProtection, 200),
        cableNotes: text(equipment.cableNotes, 500),
      },
      photos,
      outcome,
      outcomeNotes: text(source.outcomeNotes, 500),
    },
  };
}

export function solarAssessmentCompletionError(data: SolarAssessmentData, fallbackAddress: string | null): string | null {
  if (!data.site.address && !fallbackAddress) return "Add the installation address before completing the assessment.";
  if (!data.outcome) return "Choose an assessment outcome.";
  return null;
}

const OUTCOME_LABEL: Record<NonNullable<SolarAssessmentData["outcome"]>, string> = {
  suitable: "Suitable to proceed",
  technical_review: "Requires technical review",
  another_visit: "Requires another visit",
  site_issue: "Customer or site issue",
  other: "Other",
};

export function solarOutcomeLabel(outcome: SolarAssessmentData["outcome"]): string | null {
  return outcome ? OUTCOME_LABEL[outcome] : null;
}

export function solarLoadSummary(data: SolarAssessmentData): string | null {
  const essential = data.loads.filter((item) => item.essential);
  if (!essential.length) return null;
  const names = essential.map((item) => {
    const qty = item.quantity > 1 ? `${item.quantity}× ` : "";
    const notes = item.notes ? ` (${item.notes})` : "";
    return `${qty}${item.name}${notes}`;
  });
  return `Essential loads: ${names.join(", ")}`;
}

export function isTaskOverdue(task: { status: string; due_at: string | null }, now = new Date()): boolean {
  if (!task.due_at) return false;
  if (task.status === "COMPLETED" || task.status === "CANCELLED") return false;
  return new Date(task.due_at).getTime() < now.getTime();
}

export function isVisitOverdue(
  visit: { status: string; scheduled_end_at: string | null; scheduled_start_at: string | null },
  now = new Date()
): boolean {
  if (visit.status !== "SCHEDULED") return false;
  const end = visit.scheduled_end_at || visit.scheduled_start_at;
  if (!end) return false;
  return new Date(end).getTime() < now.getTime();
}

export function fieldAttention(input: {
  projectStatus: string;
  members: Array<{ role: string }>;
  tasks: Array<{ status: string; due_at: string | null }>;
  visits: Array<{ visit_type: string; status: string; scheduled_end_at: string | null; scheduled_start_at: string | null }>;
  assessmentCompleted: boolean;
}, now = new Date()): string[] {
  const lines: string[] = [];
  const overdueTasks = input.tasks.filter((task) => isTaskOverdue(task, now)).length;
  if (overdueTasks > 0) {
    lines.push(overdueTasks === 1 ? "1 project task overdue" : `${overdueTasks} project tasks overdue`);
  }
  const assessmentOverdue = input.visits.some(
    (visit) => visit.visit_type === "SITE_ASSESSMENT" && isVisitOverdue(visit, now)
  );
  if (assessmentOverdue) lines.push("Site assessment overdue");
  const hasFieldStaff = input.members.some((member) =>
    (WORK_PROJECT_FIELD_ROLES as readonly string[]).includes(member.role)
  );
  if (!hasFieldStaff) lines.push("No field staff assigned");
  if (input.assessmentCompleted && input.projectStatus === "SITE_ASSESSMENT") {
    lines.push("Site assessment completed but project still in Site Assessment");
  }
  return lines;
}

export function canMemberUpdateTask(input: {
  isManager: boolean;
  actorUserId: string;
  assignedToId: string | null;
  nextStatus: WorkProjectTaskStatus;
}): boolean {
  if (input.isManager) return true;
  if (input.assignedToId !== input.actorUserId) return false;
  return input.nextStatus === "IN_PROGRESS" || input.nextStatus === "BLOCKED" || input.nextStatus === "COMPLETED";
}

export function taskEventForStatus(status: WorkProjectTaskStatus): string | null {
  if (status === "IN_PROGRESS") return "TASK_STARTED";
  if (status === "COMPLETED") return "TASK_COMPLETED";
  if (status === "BLOCKED") return "TASK_BLOCKED";
  if (status === "CANCELLED") return "TASK_CANCELLED";
  return null;
}

export function closedVisit(status: WorkProjectVisitStatus | string): boolean {
  return status === "COMPLETED" || status === "CANCELLED" || status === "NO_ACCESS" || status === "RESCHEDULED";
}

export function isFieldRole(role: WorkProjectMemberRole | string): boolean {
  return (WORK_PROJECT_FIELD_ROLES as readonly string[]).includes(role);
}
