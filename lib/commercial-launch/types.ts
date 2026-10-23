export type CommercialLaunchMode =
  | "OFF"
  | "INTERNAL_ONLY"
  | "PILOT_ALLOWLIST"
  | "GENERAL_AVAILABILITY";

export type ReleaseDeliveryStatus =
  | "NOT_STARTED"
  | "CODE_ONLY"
  | "SCHEMA_ONLY"
  | "TESTED_IN_ISOLATION"
  | "END_TO_END_VERIFIED"
  | "DEPLOYED_BUT_DISABLED"
  | "LIVE_VERIFIED"
  | "BLOCKED";

export type ReadinessStatus = "PASS" | "FAIL" | "BLOCKED" | "UNKNOWN";

export type CommercialReleaseAssessment = {
  release: "R2" | "R3" | "R4" | "R5";
  status: ReleaseDeliveryStatus;
  schemaPresent: boolean;
  evidence: string[];
  blocker: string | null;
};

export type CommercialHealthSnapshot = {
  observedAt: string;
  environmentLabel: string;
  deployedRevision: string | null;
  schemaVersion: string | null;
  control: {
    mode: CommercialLaunchMode;
    version: number;
    pilotClientIds: string[];
    writesEnabled: boolean;
  };
  releases: CommercialReleaseAssessment[];
  features: Array<{ key: string; active: boolean; detail: string }>;
  readiness: Array<{
    key: string;
    label: string;
    status: ReadinessStatus;
    detail: string;
    evidenceRef: string | null;
  }>;
  counts: Record<string, number | null>;
  reconciliation: Array<{
    id: string;
    status: string;
    findingType: string;
    detail: string;
    createdAt: string;
  }>;
  audit: Array<{
    id: string;
    eventType: string;
    subject: string;
    recordedAt: string;
  }>;
};
