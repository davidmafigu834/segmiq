import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CommercialHealthSnapshot,
  CommercialLaunchMode,
  ReadinessStatus,
  ReleaseDeliveryStatus,
} from "./types";

type Db = ReturnType<typeof createAdminClient>;
type CountQuery = ReturnType<ReturnType<Db["from"]>["select"]>;

const READINESS_LABELS: Record<string, string> = {
  r2_end_to_end: "Plan amendments and grace flow",
  r3_signing_end_to_end: "Agreement signing journey",
  r4_shadow_reconciled: "AI shadow usage reconciliation",
  legacy_classified: "Legacy customer classification",
  invoice_idempotency: "Invoice idempotency",
  tenant_isolation: "Tenant isolation",
  private_documents: "Private document integrity",
  rollback_runbook: "Rollback runbook",
  support_owner: "Support and dispute owner",
};

async function countRows(
  db: Db,
  table: string,
  configure?: (query: CountQuery) => CountQuery,
): Promise<number | null> {
  let query = db.from(table).select("*", { count: "exact", head: true });
  if (configure) query = configure(query);
  const { count, error } = await query;
  return error ? null : (count ?? 0);
}

function envEnabled(name: string): boolean {
  return process.env[name] === "true";
}

export async function loadCommercialHealth(): Promise<CommercialHealthSnapshot> {
  const db = createAdminClient();
  const validSnapshot = {
    catalogueVersion: "2026-10-22",
    currency: "USD",
    crmSku: "crm_growth",
    aiSku: "agentic_business",
    purchasedSeats: 3,
    billingCycle: "monthly",
    seatUnitPriceUsdCents: 2900,
    crmMonthlyUsdCents: 8700,
    aiMonthlyUsdCents: 9900,
    recurringMonthlyUsdCents: 18600,
    recurringCycleUsdCents: 18600,
  };

  const [
    controlRes,
    evidenceRes,
    auditRes,
    reconciliationRes,
    r2Probe,
    legacySubscriptions,
    activeAccounts,
    draftAccounts,
    pendingQuotes,
    outstandingAgreements,
    usageRecords,
    overdueInvoices,
    activeGrace,
    unresolvedReconciliation,
    r3Table,
    r4Table,
  ] = await Promise.all([
    db
      .from("platform_commercial_release_controls")
      .select(
        "mode,version,pilot_client_ids,schema_version,deployed_revision,environment_label",
      )
      .eq("control_key", "commercial_v2")
      .maybeSingle(),
    db
      .from("platform_commercial_release_evidence")
      .select("check_key,status,evidence_ref,detail,observed_at,expires_at")
      .order("observed_at", { ascending: false })
      .limit(200),
    db
      .from("platform_commercial_audit_events")
      .select("id,event_type,subject_table,subject_id,recorded_at")
      .in("subject_table", [
        "platform_commercial_release_controls",
        "platform_plan_change_requests",
        "platform_grace_periods",
        "platform_customer_agreements",
        "platform_ai_topup_requests",
        "platform_invoice_lines",
      ])
      .order("recorded_at", { ascending: false })
      .limit(50),
    db
      .from("platform_commercial_reconciliation_findings")
      .select("id,status,finding_type,actionable_detail,created_at")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    db.rpc("platform_validate_price_snapshot", { p_snapshot: validSnapshot }),
    countRows(db, "subscriptions"),
    countRows(db, "platform_commercial_accounts", (q) =>
      q.eq("status", "active").not("agreement_ref", "is", null),
    ),
    countRows(db, "platform_commercial_accounts", (q) =>
      q.eq("status", "draft"),
    ),
    countRows(db, "platform_sales_quotes", (q) =>
      q.in("status", ["draft", "link_created", "sent", "viewed"]),
    ),
    countRows(db, "platform_customer_agreements", (q) =>
      q.in("status", [
        "issued",
        "viewed",
        "signed_by_customer",
        "awaiting_countersign",
      ]),
    ),
    countRows(db, "platform_ai_usage_ledger"),
    countRows(db, "invoices", (q) => q.eq("status", "overdue")),
    countRows(db, "platform_grace_periods", (q) =>
      q.is("ended_at", null).gt("ends_at", new Date().toISOString()),
    ),
    countRows(db, "platform_commercial_reconciliation_findings", (q) =>
      q.is("resolved_at", null).neq("status", "MATCHED"),
    ),
    countRows(db, "platform_sales_quotes"),
    countRows(db, "platform_ai_conversation_windows"),
  ]);

  const evidenceRows = evidenceRes.error ? [] : (evidenceRes.data ?? []);
  const latestEvidence = new Map<string, (typeof evidenceRows)[number]>();
  for (const row of evidenceRows) {
    if (!latestEvidence.has(row.check_key as string))
      latestEvidence.set(row.check_key as string, row);
  }
  const readiness = Object.entries(READINESS_LABELS).map(([key, label]) => {
    const row = latestEvidence.get(key);
    const expired =
      row?.expires_at && new Date(row.expires_at as string) <= new Date();
    return {
      key,
      label,
      status: (!row || expired ? "UNKNOWN" : row.status) as ReadinessStatus,
      detail: !row
        ? "No recorded evidence."
        : expired
          ? "The latest evidence has expired."
          : (row.detail as string),
      evidenceRef: (row?.evidence_ref as string | null) ?? null,
    };
  });
  const passing = new Set(
    readiness.filter((item) => item.status === "PASS").map((item) => item.key),
  );
  function statusFor(
    schemaPresent: boolean,
    check: string,
  ): ReleaseDeliveryStatus {
    if (passing.has(check)) return "END_TO_END_VERIFIED";
    return schemaPresent ? "SCHEMA_ONLY" : "CODE_ONLY";
  }

  const row = controlRes.error ? null : controlRes.data;
  const environmentLabel =
    (row?.environment_label as string | null) ??
    process.env.COMMERCIAL_ENVIRONMENT_LABEL ??
    process.env.VERCEL_ENV ??
    "UNKNOWN";
  const deployedRevision =
    (row?.deployed_revision as string | null) ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    null;
  const mode = (row?.mode as CommercialLaunchMode | null) ?? "OFF";

  return {
    observedAt: new Date().toISOString(),
    environmentLabel,
    deployedRevision,
    schemaVersion: (row?.schema_version as string | null) ?? null,
    control: {
      mode,
      version: Number(row?.version ?? 0),
      pilotClientIds: (row?.pilot_client_ids as string[] | null) ?? [],
      writesEnabled: envEnabled(
        "PLATFORM_COMMERCIAL_LAUNCH_CONTROL_WRITES_ENABLED",
      ),
    },
    releases: [
      {
        release: "R2",
        status: statusFor(!r2Probe.error, "r2_end_to_end"),
        schemaPresent: !r2Probe.error,
        evidence: ["20261023160000_platform_commercial_atomic_workflows.sql"],
        blocker: passing.has("r2_end_to_end")
          ? null
          : "No recorded end-to-end evidence.",
      },
      {
        release: "R3",
        status: statusFor(r3Table !== null, "r3_signing_end_to_end"),
        schemaPresent: r3Table !== null,
        evidence: [
          "20261023180000_platform_sales_quotes_and_agreement_foundation.sql",
        ],
        blocker: passing.has("r3_signing_end_to_end")
          ? null
          : "Approved signing flow is not evidenced.",
      },
      {
        release: "R4",
        status: statusFor(r4Table !== null, "r4_shadow_reconciled"),
        schemaPresent: r4Table !== null,
        evidence: [
          "20261023210000_platform_ai_usage_shadow_and_topup_foundation.sql",
        ],
        blocker: passing.has("r4_shadow_reconciled")
          ? null
          : "Shadow reconciliation is not evidenced.",
      },
      {
        release: "R5",
        status: controlRes.error ? "CODE_ONLY" : "SCHEMA_ONLY",
        schemaPresent: !controlRes.error,
        evidence: ["20261023230000_commercial_launch_controls.sql"],
        blocker: "Launch authorization remains a human decision.",
      },
    ],
    features: [
      ["catalogue_public", "PLATFORM_CATALOGUE_PUBLIC_ENABLED"],
      ["commercial_accounts", "PLATFORM_COMMERCIAL_WRITES_ENABLED"],
      ["manual_amendments", "PLATFORM_COMMERCIAL_WRITES_ENABLED"],
      ["grace_periods", "PLATFORM_COMMERCIAL_WRITES_ENABLED"],
      ["platform_sales_quotes", "PLATFORM_SALES_QUOTES_ENABLED"],
      [
        "contracts_required_for_new_signup",
        "PLATFORM_CUSTOMER_ACTIVATION_GATE_ENABLED",
      ],
      ["agentic_usage_shadow", "PLATFORM_AI_USAGE_SHADOW_ENABLED"],
      ["agentic_usage_enforced", "PLATFORM_AI_USAGE_ENFORCEMENT_ENABLED"],
      ["approved_topups", "PLATFORM_AI_TOPUPS_ENABLED"],
      ["commercial_invoice_lines", "PLATFORM_V2_INVOICE_LINES_ENABLED"],
    ].map(([key, env]) => ({
      key,
      active: envEnabled(env),
      detail: envEnabled(env)
        ? `Enabled by ${env}`
        : `Fail-closed: ${env} is not true`,
    })),
    readiness,
    counts: {
      legacySubscriptions,
      signedV2ActiveAccounts: activeAccounts,
      draftAccounts,
      pendingQuotations: pendingQuotes,
      outstandingAgreementSignatures: outstandingAgreements,
      usageBillingRecords: usageRecords,
      overdueInvoices,
      activeGraceAccounts: activeGrace,
      unresolvedUsageReconciliations: unresolvedReconciliation,
    },
    reconciliation: reconciliationRes.error
      ? []
      : (reconciliationRes.data ?? []).map((finding) => ({
          id: finding.id as string,
          status: finding.status as string,
          findingType: finding.finding_type as string,
          detail: finding.actionable_detail as string,
          createdAt: finding.created_at as string,
        })),
    audit: auditRes.error
      ? []
      : (auditRes.data ?? []).map((event) => ({
          id: String(event.id),
          eventType: event.event_type as string,
          subject: `${event.subject_table}:${event.subject_id}`,
          recordedAt: event.recorded_at as string,
        })),
  };
}
