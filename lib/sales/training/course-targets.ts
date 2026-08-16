/**
 * Stable spotlight target IDs for Guided Learning.
 * Convention: data-course-target="<id>"
 * Prefer semantic product names — never CSS nth-child selectors.
 */

export const COURSE_TARGETS = {
  // Desktop sidebar
  "sales-nav-dashboard": "sales-nav-dashboard",
  "sales-nav-pipeline": "sales-nav-pipeline",
  "sales-nav-leads": "sales-nav-leads",
  "sales-nav-whatsapp": "sales-nav-whatsapp",
  "sales-nav-tasks": "sales-nav-tasks",
  "sales-nav-quotes": "sales-nav-quotes",
  "sales-nav-goals": "sales-nav-goals",
  "sales-nav-training": "sales-nav-training",
  // Mobile
  "sales-mobile-nav-dashboard": "sales-mobile-nav-dashboard",
  "sales-mobile-nav-pipeline": "sales-mobile-nav-pipeline",
  "sales-mobile-nav-whatsapp": "sales-mobile-nav-whatsapp",
  "sales-mobile-nav-tasks": "sales-mobile-nav-tasks",
  "sales-mobile-nav-more": "sales-mobile-nav-more",
  "sales-mobile-more-leads": "sales-mobile-more-leads",
  "sales-mobile-more-quotes": "sales-mobile-more-quotes",
  "sales-mobile-more-goals": "sales-mobile-more-goals",
  "sales-mobile-more-tasks": "sales-mobile-more-tasks",
  "sales-mobile-more-training": "sales-mobile-more-training",
  // Dashboard
  "dashboard-kpi-new-enquiries": "dashboard-kpi-new-enquiries",
  "dashboard-kpi-active-deals": "dashboard-kpi-active-deals",
  "dashboard-kpi-pipeline": "dashboard-kpi-pipeline",
  "dashboard-todays-focus": "dashboard-todays-focus",
  "dashboard-sales-plan": "dashboard-sales-plan",
  "dashboard-quick-actions": "dashboard-quick-actions",
  "dashboard-course-card": "dashboard-course-card",
  // My Pipeline (live product)
  "pipeline-board": "pipeline-board",
  "pipeline-stage-qualified": "pipeline-stage-qualified",
  "pipeline-stage-scoping": "pipeline-stage-scoping",
  "pipeline-stage-proposal-sent": "pipeline-stage-proposal-sent",
  "pipeline-stage-negotiating": "pipeline-stage-negotiating",
  "pipeline-deal-card": "pipeline-deal-card",
  "pipeline-deal-value": "pipeline-deal-value",
  "pipeline-next-action": "pipeline-next-action",
  "pipeline-deal-drawer": "pipeline-deal-drawer",
  "pipeline-stage-progress": "pipeline-stage-progress",
  "pipeline-create-quote": "pipeline-create-quote",
  // Create Deal modal (live product)
  "create-deal-modal": "create-deal-modal",
  "create-deal-name": "create-deal-name",
  "create-deal-value": "create-deal-value",
  "create-deal-next-action": "create-deal-next-action",
  "create-deal-submit": "create-deal-submit",
  "deal-readiness": "deal-readiness",
  // Practice host
  "practice-lead-row": "practice-lead-row",
  "practice-lead-discovery": "practice-lead-discovery",
  "practice-deal-readiness": "practice-deal-readiness",
  "practice-create-deal": "practice-create-deal",
  "practice-deal-card": "practice-deal-card",
  "practice-deal-stage-scoping": "practice-deal-stage-scoping",
  "practice-next-action": "practice-next-action",
  "practice-complete-followup": "practice-complete-followup",
  "practice-create-quote": "practice-create-quote",
  "practice-whatsapp-quick-reply": "practice-whatsapp-quick-reply",
  "practice-goals-revenue": "practice-goals-revenue",
  "practice-goals-coverage": "practice-goals-coverage",
  "practice-goals-commitments": "practice-goals-commitments",
  // Company Quotations
  "company-quotations-kpis": "company-quotations-kpis",
  "company-quotations-tabs": "company-quotations-tabs",
  "company-quotations-table": "company-quotations-table",
  "company-quotation-row": "company-quotation-row",
  "company-quotation-detail": "company-quotation-detail",
  "quotation-view-pdf": "quotation-view-pdf",
  "quotation-send": "quotation-send",
  "quotation-amount-summary": "quotation-amount-summary",
  "quotation-items": "quotation-items",
  "quotation-create": "quotation-create",
  // Company Billing
  "billing-current-plan": "billing-current-plan",
  "billing-manage-plan": "billing-manage-plan",
  "billing-usage": "billing-usage",
  "billing-invoices": "billing-invoices",
  "billing-summary": "billing-summary",
  "billing-payment-method": "billing-payment-method",
  "billing-history": "billing-history",
} as const;

export type CourseTargetId = (typeof COURSE_TARGETS)[keyof typeof COURSE_TARGETS];

export function courseTargetSelector(id: string): string {
  return `[data-course-target="${id}"]`;
}

export function findCourseTarget(id: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector(courseTargetSelector(id));
}
