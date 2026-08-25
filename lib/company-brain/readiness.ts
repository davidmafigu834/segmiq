import type { CompanyBrainSnapshot } from "./types";

export type AreaReadinessStatus = "complete" | "needs_review" | "empty";

export type AreaReadiness = {
  id: string;
  label: string;
  status: AreaReadinessStatus;
  detail: string;
};

export type CapabilityStatus = "ready" | "needs_setup";

export type CapabilityReadiness = {
  id: string;
  label: string;
  status: CapabilityStatus;
  missing: string[];
};

export type BrainReadiness = {
  areas: AreaReadiness[];
  capabilities: CapabilityReadiness[];
  configuredAreaCount: number;
  totalAreaCount: number;
  summary: string;
  quotationAutomationBlocked: string[];
};

function filled(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

export function computeBrainReadiness(snapshot: CompanyBrainSnapshot): BrainReadiness {
  const s = snapshot.settings;
  const c = snapshot.canonical;
  const hasSettings = snapshot.exists;

  const profileComplete =
    filled(c.companyName) &&
    (filled(s.agentBusinessExplanation) || (filled(c.industry) && Boolean(s.businessKind)));
  const catalogueComplete = c.productCount + c.serviceCount > 0 || filled(s.primaryOffering);
  const voiceComplete = hasSettings;
  const customersComplete = snapshot.idealCustomers.some((x) => x.active);
  const qualificationComplete =
    snapshot.playbooks.some((p) => p.enabled && p.fields.length > 0) || c.hasQualificationFlow;
  const salesComplete = snapshot.stageGuidance.some((g) => filled(g.guidance));
  const areasComplete = snapshot.serviceAreas.some((a) => a.active);
  const hoursComplete = c.hasOperatingHoursRow || snapshot.appointmentTypes.some((t) => t.enabled);
  const pricingComplete = filled(c.paymentTerms) || filled(s.pricingGuidance) || filled(s.paymentGuidance);
  const supportComplete = s.supportOffered && Boolean(s.supportDestinationType);
  const faqsComplete = snapshot.faqs.some((f) => f.active);
  const rulesComplete = snapshot.rules.some((r) => r.enabled);
  const escalationComplete = snapshot.escalationRules.some((r) => r.enabled);
  const knowledgeComplete = snapshot.knowledgeDocuments.some((d) => d.status === "APPROVED");
  const examplesComplete = snapshot.examples.some((e) => e.active);

  const areas: AreaReadiness[] = [
    {
      id: "profile",
      label: "Company Profile",
      status: profileComplete ? "complete" : hasSettings ? "needs_review" : "empty",
      detail: profileComplete
        ? "Business identity is set"
        : "Add how SegmiQ should understand the business",
    },
    {
      id: "catalogue",
      label: "Products & Services",
      status: catalogueComplete ? "complete" : "empty",
      detail: catalogueComplete
        ? `${c.productCount + c.serviceCount} catalogue item${c.productCount + c.serviceCount === 1 ? "" : "s"}`
        : "Add catalogue items or a primary offering",
    },
    {
      id: "customers",
      label: "Ideal Customer",
      status: customersComplete ? "complete" : "empty",
      detail: customersComplete
        ? `${snapshot.idealCustomers.filter((x) => x.active).length} profile${snapshot.idealCustomers.filter((x) => x.active).length === 1 ? "" : "s"}`
        : "Optional — add customer profiles",
    },
    {
      id: "qualification",
      label: "Qualification",
      status: qualificationComplete ? "complete" : "empty",
      detail: qualificationComplete
        ? snapshot.playbooks.filter((p) => p.enabled).length
          ? `${snapshot.playbooks.filter((p) => p.enabled).length} playbook${snapshot.playbooks.filter((p) => p.enabled).length === 1 ? "" : "s"}`
          : "Using existing Instant Form / qualification questions"
        : "Create a qualification playbook",
    },
    {
      id: "sales-process",
      label: "Sales Process",
      status: salesComplete ? "complete" : "empty",
      detail: salesComplete ? "Stage guidance configured" : "Add AI guidance to deal stages",
    },
    {
      id: "service-areas",
      label: "Service Areas",
      status: areasComplete ? "complete" : "empty",
      detail: areasComplete
        ? `${snapshot.serviceAreas.filter((a) => a.active).length} area${snapshot.serviceAreas.filter((a) => a.active).length === 1 ? "" : "s"}`
        : "Not configured — Agent will not guess coverage",
    },
    {
      id: "pricing",
      label: "Pricing & Payments",
      status: pricingComplete ? "complete" : filled(c.paymentTerms) ? "needs_review" : "empty",
      detail: pricingComplete
        ? filled(c.paymentTerms)
          ? "Payment terms on file"
          : "Pricing guidance set"
        : "Needs payment terms or pricing guidance",
    },
    {
      id: "support",
      label: "Support",
      status: s.supportOffered ? (supportComplete ? "complete" : "needs_review") : "empty",
      detail: supportComplete
        ? "Support routing configured"
        : s.supportOffered
          ? "Needs a support destination"
          : "Support routing not enabled",
    },
    {
      id: "faqs",
      label: "FAQs",
      status: faqsComplete ? "complete" : "empty",
      detail: faqsComplete
        ? `${snapshot.faqs.filter((f) => f.active).length} approved`
        : "No approved answers yet",
    },
    {
      id: "escalation",
      label: "Escalation Rules",
      status: escalationComplete ? "complete" : "needs_review",
      detail: escalationComplete
        ? `${snapshot.escalationRules.filter((r) => r.enabled).length} rule${snapshot.escalationRules.filter((r) => r.enabled).length === 1 ? "" : "s"}`
        : "System escalations still apply; add company rules",
    },
    {
      id: "knowledge",
      label: "Knowledge Library",
      status: knowledgeComplete ? "complete" : "empty",
      detail: knowledgeComplete
        ? `${snapshot.knowledgeDocuments.filter((d) => d.status === "APPROVED").length} document${snapshot.knowledgeDocuments.filter((d) => d.status === "APPROVED").length === 1 ? "" : "s"}`
        : "No approved documents",
    },
    {
      id: "voice",
      label: "Agent Voice",
      status: voiceComplete ? "complete" : "empty",
      detail: voiceComplete ? `${s.voicePrimary} / ${s.responseLength}` : "Using system defaults until saved",
    },
    {
      id: "rules",
      label: "Agent Rules",
      status: rulesComplete ? "complete" : "empty",
      detail: rulesComplete
        ? `${snapshot.rules.filter((r) => r.enabled).length} active`
        : "No extra restrictions",
    },
    {
      id: "hours",
      label: "Business Hours",
      status: hoursComplete ? "complete" : "needs_review",
      detail: hoursComplete
        ? `${c.workStartTime}–${c.workEndTime}`
        : "Using company operating-hour defaults",
    },
    {
      id: "examples",
      label: "Response Examples",
      status: examplesComplete ? "complete" : "empty",
      detail: examplesComplete
        ? `${snapshot.examples.filter((e) => e.active).length} example${snapshot.examples.filter((e) => e.active).length === 1 ? "" : "s"}`
        : "Optional few-shot examples",
    },
  ];

  const configuredAreaCount = areas.filter((a) => a.status === "complete").length;

  const enquiryMissing: string[] = [];
  if (!profileComplete) enquiryMissing.push("business profile");
  if (!catalogueComplete) enquiryMissing.push("product/service context");
  if (!voiceComplete) enquiryMissing.push("brand voice");

  const qualificationMissing: string[] = [];
  if (!qualificationComplete) qualificationMissing.push("an enabled qualification playbook");

  const schedulingMissing: string[] = [];
  if (!c.hasOperatingHoursRow) schedulingMissing.push("working hours");
  const enabledTypes = snapshot.appointmentTypes.filter((t) => t.enabled);
  if (!enabledTypes.length) schedulingMissing.push("an appointment type");
  else if (!enabledTypes.some((t) => t.eligibleUserIds.length > 0) && c.teamUserCount < 1) {
    schedulingMissing.push("an eligible salesperson or team");
  }

  const quoteMissing: string[] = [];
  if (c.productCount + c.serviceCount < 1) quoteMissing.push("Products & Services");
  if (c.quoteTemplateCount < 1 && c.packageCount < 1) quoteMissing.push("a quotation template or package");
  if (!c.currency) quoteMissing.push("currency");
  if (!filled(c.paymentTerms)) quoteMissing.push("payment terms");

  const autoSendMissing = [...quoteMissing];
  if (c.allowQuotationDiscount == null && !c.priceEditPolicy) {
    autoSendMissing.push("commercial policy");
  }
  if (!c.agentAutonomyMode) {
    autoSendMissing.push("Agent autonomy settings");
  } else if (c.agentAutonomyMode !== "AUTOPILOT") {
    autoSendMissing.push("Autopilot autonomy mode");
  }
  if (c.quoteAutoSendLimit == null) {
    autoSendMissing.push("a quotation value limit");
  }

  const supportMissing: string[] = [];
  if (!s.supportOffered) supportMissing.push("support enabled");
  if (!s.supportDestinationType) supportMissing.push("a support team or destination");

  const capabilities: CapabilityReadiness[] = [
    {
      id: "enquiries",
      label: "Answer basic enquiries",
      status: enquiryMissing.length ? "needs_setup" : "ready",
      missing: enquiryMissing,
    },
    {
      id: "qualification",
      label: "Qualify sales leads",
      status: qualificationMissing.length ? "needs_setup" : "ready",
      missing: qualificationMissing,
    },
    {
      id: "scheduling",
      label: "Schedule appointments",
      status: schedulingMissing.length ? "needs_setup" : "ready",
      missing: schedulingMissing,
    },
    {
      id: "quotation",
      label: "Prepare quotations",
      status: quoteMissing.length ? "needs_setup" : "ready",
      missing: quoteMissing,
    },
    {
      id: "auto_quote",
      label: "Send quotations autonomously",
      status: autoSendMissing.length ? "needs_setup" : "ready",
      missing: autoSendMissing,
    },
    {
      id: "support",
      label: "Handle support routing",
      status: supportMissing.length ? "needs_setup" : "ready",
      missing: supportMissing,
    },
  ];

  const readyCount = capabilities.filter((cap) => cap.status === "ready").length;
  let summary = "SegmiQ does not yet have enough operating context. Configure Company Brain before trusting autonomous answers.";
  if (readyCount >= 4) {
    summary = "SegmiQ has enough information to handle core sales conversations. Review remaining gaps before enabling higher autonomy.";
  } else if (capabilities.find((cap) => cap.id === "enquiries")?.status === "ready") {
    summary = "SegmiQ has enough information to handle basic enquiries and qualification.";
  } else if (configuredAreaCount > 0) {
    summary = "Some Company Brain areas are configured. Complete the remaining required areas before relying on the Agent.";
  }

  const quotationAutomationBlocked = quoteMissing;

  return {
    areas,
    capabilities,
    configuredAreaCount,
    totalAreaCount: areas.length,
    summary,
    quotationAutomationBlocked,
  };
}

export function quotationAutomationBlockers(snapshot: CompanyBrainSnapshot): string[] {
  return computeBrainReadiness(snapshot).capabilities.find((c) => c.id === "quotation")?.missing ?? [];
}
