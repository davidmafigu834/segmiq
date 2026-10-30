import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { canManageClientProfile } from "@/lib/auth/permissions";
import { permissionsForOrgRole } from "@/lib/auth/rbac/role-profiles";
import {
  resolveApiAuthDetailed,
  type ApiAuthFailureReason,
  type ApiAuthResolution,
} from "@/lib/auth/resolveApiAuth";
import { fetchMiddlewareCrmBillingAccessStatus } from "@/lib/supabase/middleware-admin";
import { getTerminology, type Terminology } from "@/lib/terminology";
import {
  CALLBACK_SCHEDULE_LABELS,
  CALLBACK_SCHEDULE_OPTIONS,
  CALL_RESULT_LABELS,
  DEAL_CALL_RESULTS,
  LEAD_CALL_RESULTS,
  REACH_OUTCOMES,
  REACH_OUTCOME_LABELS,
  getFollowUpHoldupReasons,
  getLostReasons,
  getNotQualifiedReasons,
} from "@/lib/call-log-constants";
import { DEAL_ACTIVE_STAGES, DEAL_CLOSED_STAGES, DEAL_STAGE_LABEL } from "@/lib/sales/deals/display";
import { SOLAR_SALES_STAGES } from "@/lib/sales/solar-workflow/types";
import { SOLAR_SALES_STAGE_LABEL } from "@/lib/sales/solar-workflow/labels";
import {
  RE_ACTIVE_STAGES,
  RE_BOARD_COLUMNS,
  RE_CLOSED_STAGES,
  RE_PIPELINE_STAGE_LABEL,
} from "@/lib/real-estate/pipeline";
import {
  SALES_NAV_SECTION_LABEL,
  resolveSalesNavItems,
  salesMobilePrimaryItems,
} from "@/lib/sales/navigation/sales-nav-config";
import { resolveSalesTimezone } from "@/lib/sales/intelligence/timezone";
import {
  mobileApiError,
  type MobileApiErrorCode,
} from "@/lib/mobile/sales-app/errors";
import {
  resolveSalesExperience,
  type ClientMode,
  type ResolvedSalesExperience,
  type SalesExperienceId,
  type SalesExperienceResolvedBy,
  type SalesHomeVariant,
  type WorkspaceMode,
} from "@/lib/mobile/sales-app/experience";
import type { BusinessType } from "@/lib/terminology";
import type { SalesWorkflowPreset } from "@/lib/sales/solar-workflow/types";
import type { Permission } from "@/lib/auth/rbac/permissions";

export const SALES_APP_BOOTSTRAP_SCHEMA_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Contract (schemaVersion 1)
// ---------------------------------------------------------------------------

export type SubscriptionStatusV1 = "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELLED" | "UNKNOWN";
export type SalesAccessV1 = "ALLOWED" | "BLOCKED";
export type LeadVisibilityV1 = "ORGANISATION" | "ASSIGNED_AND_UNASSIGNED" | "ASSIGNED_ONLY";
export type AssignmentModeV1 = "direct" | "pool" | "round_robin";

export type NavigationDestinationV1 = {
  /** Stable destination id, e.g. DASHBOARD, PIPELINE, WHATSAPP. */
  id: string;
  label: string;
  shortLabel: string | null;
  section: string;
  placement: "PRIMARY" | "MORE";
  /** Web equivalent for deep links / fallbacks only. Never use as an authority. */
  webPath: string;
};

export type PipelineStageV1 = { id: string; label: string; closed: boolean };

export type SalesAppBootstrapV1 = {
  schemaVersion: 1;
  generatedAt: string;
  session: {
    sessionId: string | null;
    sessionType: string | null;
    expiresAt: string | null;
    refreshSupported: false;
  };
  user: {
    id: string;
    displayName: string;
    role: "SALESPERSON" | "CLIENT_MANAGER";
    alsoSells: boolean;
    avatarUrl: string | null;
  };
  organisation: {
    id: string;
    name: string;
    logoUrl: string | null;
    businessType: BusinessType;
    salesWorkflowPreset: SalesWorkflowPreset;
    clientMode: ClientMode;
    workspaceMode: WorkspaceMode;
    assignmentMode: AssignmentModeV1;
    country: string | null;
    dialCode: string | null;
    responseTimeLimitHours: number | null;
  };
  subscription: {
    product: "crm";
    status: SubscriptionStatusV1;
    salesAccess: SalesAccessV1;
  };
  experience: {
    id: SalesExperienceId;
    resolvedBy: SalesExperienceResolvedBy;
    homeVariant: SalesHomeVariant;
  };
  capabilities: {
    modules: string[];
    permissions: Permission[];
    featureFlags: {
      realEstateWorkflow: boolean;
      realEstatePropertiesRead: boolean;
      realEstateBuyerSearchRead: boolean;
      privateListingImageDelivery: boolean;
      solarWorkflow: boolean;
      demoWorkspace: boolean;
    };
    restrictions: {
      salesOperations: SalesAccessV1;
      leadVisibility: LeadVisibilityV1;
      leadModification: "ASSIGNED_ONLY";
      canManageCompanyProfile: boolean;
      quotationMarginVisibleToSalespeople: boolean | null;
      quotationCostVisibleToSalespeople: boolean | null;
    };
  };
  navigation: {
    home: string | null;
    primary: string[];
    sections: { id: string; label: string }[];
    destinations: NavigationDestinationV1[];
  };
  salesConfiguration: {
    terminology: Terminology;
    pipeline: {
      model: "DEAL_STAGE" | "SOLAR_SALES_STAGE" | "REAL_ESTATE_STAGE";
      configurable: false;
      stages: PipelineStageV1[];
      boardColumns: { id: string; label: string; stages: string[] }[] | null;
    };
    callOutcomes: {
      configurable: false;
      reachOutcomes: { id: string; label: string }[];
      leadResults: { id: string; label: string }[];
      dealResults: { id: string; label: string }[];
      followUpReasons: string[];
      lostReasons: string[];
      notQualifiedReasons: string[];
      callbackOptions: { id: string; label: string }[];
    };
    timeZone: {
      /** Organisation setting (client_marketing_settings.timezone); null when never set. */
      configured: string | null;
      /** Zone the server uses for this organisation's sales day boundaries. */
      effective: string;
      source: "ORGANISATION" | "PLATFORM_DEFAULT";
    };
    currency: {
      /** quotation_settings.default_currency; null when the organisation has no quotation settings. */
      quotationDefault: string | null;
      supported: string[];
      source: "QUOTATION_SETTINGS" | "NOT_CONFIGURED";
    };
  };
};

// ---------------------------------------------------------------------------
// Source data (loaded strictly from the authenticated session's ids)
// ---------------------------------------------------------------------------

export type BootstrapActor = {
  userId: string;
  role: "SALESPERSON" | "CLIENT_MANAGER";
  clientId: string;
  alsoSells: boolean;
  sessionId: string | null;
  tokenExpiresAt: number | null;
};

export type BootstrapSource = {
  user: {
    id: string;
    name: string | null;
    role: string;
    alsoSells: boolean;
    avatarUrl: string | null;
    clientId: string | null;
    isActive: boolean;
  } | null;
  organisation: {
    id: string;
    name: string | null;
    logoUrl: string | null;
    businessType: string | null;
    salesWorkflowPreset: string | null;
    mode: string | null;
    workspaceMode: string | null;
    assignmentMode: string | null;
    country: string | null;
    dialCode: string | null;
    responseTimeLimitHours: number | null;
  } | null;
  session: { sessionType: string | null; expiresAt: string | null } | null;
  /** Raw result of the shared CRM billing decision; null = no subscription row or unreadable. */
  billingStatus: string | null;
  configuredTimeZone: string | null;
  platformDefaultTimeZone: string | null;
  quotationSettings: {
    defaultCurrency: string | null;
    supportedCurrencies: string[];
    salespersonCanSeeMargin: boolean | null;
    salespersonCanSeeCost: boolean | null;
  } | null;
};

type LoaderDeps = {
  supabase?: SupabaseClient;
  fetchBillingStatus?: (clientId: string) => Promise<string | null>;
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function bool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function currencies(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

/**
 * Every query is keyed by the validated session's userId / clientId.
 * Caller-supplied organisation or user ids are never accepted.
 * Required reads (user, organisation) throw on database errors; optional
 * configuration degrades to null.
 */
export async function loadSalesAppBootstrapSource(
  actor: Pick<BootstrapActor, "userId" | "clientId" | "sessionId">,
  deps: LoaderDeps = {}
): Promise<BootstrapSource> {
  const supabase = deps.supabase ?? createAdminClient();
  const fetchBillingStatus =
    deps.fetchBillingStatus ?? ((clientId: string) => fetchMiddlewareCrmBillingAccessStatus(clientId));

  const [userRes, clientRes, sessionRes, marketingRes, platformRes, quoteRes, billingStatus] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, name, role, also_sells, avatar_url, client_id, is_active")
        .eq("id", actor.userId)
        .eq("client_id", actor.clientId)
        .maybeSingle(),
      // `*` tolerates optional columns that may lag behind migrations; only
      // whitelisted fields leave this function.
      supabase.from("clients").select("*").eq("id", actor.clientId).maybeSingle(),
      actor.sessionId
        ? supabase
            .from("user_sessions")
            .select("id, session_type, expires_at")
            .eq("id", actor.sessionId)
            .eq("user_id", actor.userId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("client_marketing_settings")
        .select("timezone")
        .eq("client_id", actor.clientId)
        .maybeSingle(),
      supabase.from("agency_settings").select("default_timezone").eq("id", "singleton").maybeSingle(),
      supabase
        .from("quotation_settings")
        .select("default_currency, supported_currencies, salesperson_can_see_margin, salesperson_can_see_cost")
        .eq("client_id", actor.clientId)
        .maybeSingle(),
      fetchBillingStatus(actor.clientId),
    ]);

  if (userRes.error) throw new Error(`Bootstrap user lookup unavailable: ${userRes.error.message}`);
  if (clientRes.error) throw new Error(`Bootstrap organisation lookup unavailable: ${clientRes.error.message}`);

  const u = userRes.data as Record<string, unknown> | null;
  const c = clientRes.data as Record<string, unknown> | null;
  const s = sessionRes.error ? null : (sessionRes.data as Record<string, unknown> | null);
  const m = marketingRes.error ? null : (marketingRes.data as Record<string, unknown> | null);
  const p = platformRes.error ? null : (platformRes.data as Record<string, unknown> | null);
  const q = quoteRes.error ? null : (quoteRes.data as Record<string, unknown> | null);

  return {
    user: u
      ? {
          id: String(u.id),
          name: str(u.name),
          role: String(u.role ?? ""),
          alsoSells: Boolean(u.also_sells),
          avatarUrl: str(u.avatar_url),
          clientId: str(u.client_id),
          isActive: u.is_active !== false,
        }
      : null,
    organisation:
      c && c.id === actor.clientId
        ? {
            id: String(c.id),
            name: str(c.name),
            logoUrl: str(c.logo_url),
            businessType: str(c.business_type),
            salesWorkflowPreset: str(c.sales_workflow_preset),
            mode: str(c.mode),
            workspaceMode: str(c.workspace_mode),
            assignmentMode: str(c.assignment_mode),
            country: str(c.country),
            dialCode: str(c.dial_code),
            responseTimeLimitHours:
              typeof c.response_time_limit_hours === "number" ? c.response_time_limit_hours : null,
          }
        : null,
    session: s ? { sessionType: str(s.session_type), expiresAt: str(s.expires_at) } : null,
    billingStatus,
    configuredTimeZone: m ? str(m.timezone) : null,
    platformDefaultTimeZone: p ? str(p.default_timezone) : null,
    quotationSettings: q
      ? {
          defaultCurrency: str(q.default_currency),
          supportedCurrencies: currencies(q.supported_currencies),
          salespersonCanSeeMargin: bool(q.salesperson_can_see_margin),
          salespersonCanSeeCost: bool(q.salesperson_can_see_cost),
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Pure builder
// ---------------------------------------------------------------------------

export function destinationId(webId: string): string {
  return webId.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}

export function subscriptionStatusV1(raw: string | null): SubscriptionStatusV1 {
  switch (raw) {
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "suspended":
      return "SUSPENDED";
    case "cancelled":
      return "CANCELLED";
    default:
      return "UNKNOWN";
  }
}

function normalizeAssignmentMode(value: string | null): AssignmentModeV1 {
  return value === "pool" || value === "round_robin" ? value : "direct";
}

/** Mirrors evaluateLeadReadAccess. */
export function leadVisibilityFor(
  role: "SALESPERSON" | "CLIENT_MANAGER",
  assignmentMode: AssignmentModeV1
): LeadVisibilityV1 {
  if (role === "CLIENT_MANAGER") return "ORGANISATION";
  return assignmentMode === "pool" || assignmentMode === "direct" ? "ASSIGNED_AND_UNASSIGNED" : "ASSIGNED_ONLY";
}

function pipelineFor(experience: SalesExperienceId): SalesAppBootstrapV1["salesConfiguration"]["pipeline"] {
  if (experience === "REAL_ESTATE") {
    return {
      model: "REAL_ESTATE_STAGE",
      configurable: false,
      stages: [
        ...RE_ACTIVE_STAGES.map((id) => ({ id, label: RE_PIPELINE_STAGE_LABEL[id], closed: false })),
        ...RE_CLOSED_STAGES.map((id) => ({ id, label: RE_PIPELINE_STAGE_LABEL[id], closed: true })),
      ],
      boardColumns: RE_BOARD_COLUMNS.map((col) => ({ id: col.id, label: col.label, stages: [...col.stages] })),
    };
  }
  if (experience === "SOLAR") {
    return {
      model: "SOLAR_SALES_STAGE",
      configurable: false,
      stages: SOLAR_SALES_STAGES.map((id) => ({
        id,
        label: SOLAR_SALES_STAGE_LABEL[id],
        closed: id === "WON" || id === "LOST",
      })),
      boardColumns: null,
    };
  }
  return {
    model: "DEAL_STAGE",
    configurable: false,
    stages: [
      ...DEAL_ACTIVE_STAGES.map((id) => ({ id, label: DEAL_STAGE_LABEL[id], closed: false })),
      ...DEAL_CLOSED_STAGES.map((id) => ({ id, label: DEAL_STAGE_LABEL[id], closed: true })),
    ],
    boardColumns: null,
  };
}

function callOutcomesFor(businessType: BusinessType): SalesAppBootstrapV1["salesConfiguration"]["callOutcomes"] {
  return {
    configurable: false,
    reachOutcomes: REACH_OUTCOMES.map((id) => ({ id, label: REACH_OUTCOME_LABELS[id] })),
    leadResults: LEAD_CALL_RESULTS.map((id) => ({ id, label: CALL_RESULT_LABELS[id] })),
    dealResults: DEAL_CALL_RESULTS.map((id) => ({ id, label: CALL_RESULT_LABELS[id] })),
    followUpReasons: [...getFollowUpHoldupReasons(businessType)],
    lostReasons: [...getLostReasons(businessType)],
    notQualifiedReasons: [...getNotQualifiedReasons(businessType)],
    callbackOptions: CALLBACK_SCHEDULE_OPTIONS.map((id) => ({ id, label: CALLBACK_SCHEDULE_LABELS[id] })),
  };
}

function navigationFor(
  experience: ResolvedSalesExperience,
  salesAccess: SalesAccessV1
): SalesAppBootstrapV1["navigation"] {
  const solarWorkflow = experience.id === "SOLAR";
  const items = resolveSalesNavItems(experience.homeVariant === "SOLO", experience.businessType, {
    solarWorkflow,
  });
  const sectionOrder = [...new Set(items.map((item) => item.section))];
  const sections = sectionOrder.map((id) => ({ id, label: SALES_NAV_SECTION_LABEL[id] ?? id }));
  if (salesAccess === "BLOCKED") {
    return { home: null, primary: [], sections, destinations: [] };
  }
  const primaryIds = new Set(salesMobilePrimaryItems(items, experience.businessType).map((i) => i.id));
  const destinations = items.map((item) => ({
    id: destinationId(item.id),
    label: item.label,
    shortLabel: item.mobileLabel ?? null,
    section: item.section,
    placement: primaryIds.has(item.id) ? ("PRIMARY" as const) : ("MORE" as const),
    webPath: item.href,
  }));
  const primary = salesMobilePrimaryItems(items, experience.businessType).map((i) => destinationId(i.id));
  return { home: destinationId("dashboard"), primary, sections, destinations };
}

function minIso(a: string | null, bMs: number | null): string | null {
  const aMs = a ? Date.parse(a) : NaN;
  const candidates = [Number.isFinite(aMs) ? aMs : null, bMs].filter((v): v is number => v !== null);
  if (candidates.length === 0) return null;
  return new Date(Math.min(...candidates)).toISOString();
}

export function buildSalesAppBootstrap(
  actor: BootstrapActor,
  source: BootstrapSource & {
    user: NonNullable<BootstrapSource["user"]>;
    organisation: NonNullable<BootstrapSource["organisation"]>;
  },
  now: Date = new Date()
): SalesAppBootstrapV1 {
  const org = source.organisation;
  const experience = resolveSalesExperience({
    role: actor.role,
    clientMode: org.mode,
    businessType: org.businessType,
    salesWorkflowPreset: org.salesWorkflowPreset,
    workspaceMode: org.workspaceMode,
  });
  const subscriptionStatus = subscriptionStatusV1(source.billingStatus);
  const salesAccess: SalesAccessV1 = subscriptionStatus === "SUSPENDED" ? "BLOCKED" : "ALLOWED";
  const navigation = navigationFor(experience, salesAccess);
  const assignmentMode = normalizeAssignmentMode(org.assignmentMode);
  const effectiveTimeZone = resolveSalesTimezone(source.configuredTimeZone ?? source.platformDefaultTimeZone);
  const quote = source.quotationSettings;

  return {
    schemaVersion: SALES_APP_BOOTSTRAP_SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    session: {
      sessionId: actor.sessionId,
      sessionType: source.session?.sessionType ?? null,
      expiresAt: minIso(source.session?.expiresAt ?? null, actor.tokenExpiresAt),
      refreshSupported: false,
    },
    user: {
      id: actor.userId,
      displayName: source.user.name ?? "",
      role: actor.role,
      alsoSells: actor.alsoSells,
      avatarUrl: source.user.avatarUrl,
    },
    organisation: {
      id: org.id,
      name: org.name ?? "",
      logoUrl: org.logoUrl,
      businessType: experience.businessType,
      salesWorkflowPreset: experience.salesWorkflowPreset,
      clientMode: experience.clientMode,
      workspaceMode: experience.workspaceMode,
      assignmentMode,
      country: org.country,
      dialCode: org.dialCode,
      responseTimeLimitHours: org.responseTimeLimitHours,
    },
    subscription: { product: "crm", status: subscriptionStatus, salesAccess },
    experience: {
      id: experience.id,
      resolvedBy: experience.resolvedBy,
      homeVariant: experience.homeVariant,
    },
    capabilities: {
      modules: navigation.destinations.map((d) => d.id),
      permissions: [...permissionsForOrgRole(actor.role, { alsoSells: actor.alsoSells })].sort(),
      featureFlags: {
        realEstateWorkflow: experience.id === "REAL_ESTATE",
        realEstatePropertiesRead: experience.id === "REAL_ESTATE" && salesAccess === "ALLOWED",
        realEstateBuyerSearchRead: experience.id === "REAL_ESTATE" && salesAccess === "ALLOWED",
        privateListingImageDelivery: experience.id === "REAL_ESTATE" && salesAccess === "ALLOWED" && Boolean(process.env.CLOUDFLARE_R2_PRIVATE_LISTING_BUCKET_NAME) && process.env.CLOUDFLARE_R2_PRIVATE_LISTING_BUCKET_NAME !== process.env.CLOUDFLARE_R2_BUCKET_NAME,
        solarWorkflow: experience.id === "SOLAR",
        demoWorkspace: experience.workspaceMode === "demo",
      },
      restrictions: {
        salesOperations: salesAccess,
        leadVisibility: leadVisibilityFor(actor.role, assignmentMode),
        leadModification: "ASSIGNED_ONLY",
        canManageCompanyProfile: canManageClientProfile(actor.role),
        quotationMarginVisibleToSalespeople: quote?.salespersonCanSeeMargin ?? null,
        quotationCostVisibleToSalespeople: quote?.salespersonCanSeeCost ?? null,
      },
    },
    navigation,
    salesConfiguration: {
      terminology: getTerminology(experience.businessType),
      pipeline: pipelineFor(experience.id),
      callOutcomes: callOutcomesFor(experience.businessType),
      timeZone: {
        configured: source.configuredTimeZone,
        effective: effectiveTimeZone,
        source: source.configuredTimeZone ? "ORGANISATION" : "PLATFORM_DEFAULT",
      },
      currency: quote?.defaultCurrency
        ? {
            quotationDefault: quote.defaultCurrency,
            supported: quote.supportedCurrencies.length ? quote.supportedCurrencies : [quote.defaultCurrency],
            source: "QUOTATION_SETTINGS",
          }
        : { quotationDefault: null, supported: [], source: "NOT_CONFIGURED" },
    },
  };
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

export function authFailureToMobileError(reason: ApiAuthFailureReason): MobileApiErrorCode {
  switch (reason) {
    case "token_expired":
      return "TOKEN_EXPIRED";
    case "session_expired":
    case "session_idle":
      return "SESSION_EXPIRED";
    case "missing_session_id":
    case "session_missing":
    case "session_user_mismatch":
    case "session_revoked":
    case "session_version_mismatch":
    case "target_mismatch":
    case "real_missing":
    case "real_inactive":
    case "real_not_super_admin":
      return "SESSION_REVOKED";
    case "target_missing":
    case "target_inactive":
      return "ACCOUNT_DISABLED";
    case "client_inactive":
    case "client_security_suspended":
      return "ORGANISATION_SUSPENDED";
    case "mfa_required":
      return "MFA_REQUIRED";
    case "mfa_enrolment_required":
      return "MFA_ENROLMENT_REQUIRED";
    case "auth_unavailable":
      return "SERVICE_UNAVAILABLE";
    case "server_misconfigured":
      return "SERVER_MISCONFIGURED";
    default:
      return "TOKEN_INVALID";
  }
}

export type BootstrapHandlerDeps = {
  resolveAuth: (req: Request) => Promise<ApiAuthResolution>;
  loadSource: (actor: Pick<BootstrapActor, "userId" | "clientId" | "sessionId">) => Promise<BootstrapSource>;
  now?: () => Date;
};

const defaultDeps: BootstrapHandlerDeps = {
  resolveAuth: resolveApiAuthDetailed,
  loadSource: (actor) => loadSalesAppBootstrapSource(actor),
};

export async function handleSalesAppBootstrap(
  req: Request,
  deps: BootstrapHandlerDeps = defaultDeps
): Promise<NextResponse> {
  let resolution: ApiAuthResolution;
  try {
    resolution = await deps.resolveAuth(req);
  } catch (error) {
    console.error("[sales/app/bootstrap] auth resolution failed", error);
    return mobileApiError("SERVICE_UNAVAILABLE");
  }
  if (!resolution.ok) {
    const code = authFailureToMobileError(resolution.reason);
    return mobileApiError(code, { error: code === "TOKEN_INVALID" ? "Unauthorized" : code });
  }

  const auth = resolution.auth;
  if (auth.demoGuest || auth.isImpersonating) return mobileApiError("UNSUPPORTED_SESSION");
  if (!canActAsSalesperson(auth) || (auth.role !== "SALESPERSON" && auth.role !== "CLIENT_MANAGER")) {
    return mobileApiError("INSUFFICIENT_ROLE");
  }
  if (!auth.clientId) return mobileApiError("NO_ORGANISATION");

  const actor: BootstrapActor = {
    userId: auth.userId,
    role: auth.role,
    clientId: auth.clientId,
    alsoSells: Boolean(auth.alsoSells),
    sessionId: auth.sessionId ?? null,
    tokenExpiresAt: resolution.tokenExpiresAt ?? null,
  };

  let source: BootstrapSource;
  try {
    source = await deps.loadSource({
      userId: actor.userId,
      clientId: actor.clientId,
      sessionId: actor.sessionId,
    });
  } catch (error) {
    console.error("[sales/app/bootstrap] source load failed", error);
    return mobileApiError("SERVICE_UNAVAILABLE");
  }

  const { user, organisation } = source;
  if (!user || !user.isActive) return mobileApiError("ACCOUNT_DISABLED");
  if (user.clientId !== actor.clientId || user.role !== actor.role) return mobileApiError("SESSION_REVOKED");
  if (!organisation) return mobileApiError("ORGANISATION_SUSPENDED");

  const body = buildSalesAppBootstrap(actor, { ...source, user, organisation }, deps.now?.() ?? new Date());
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
