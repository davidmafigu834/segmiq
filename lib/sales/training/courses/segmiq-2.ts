/**
 * SegmiQ 2.0 Guided Learning curriculum.
 * Content is configuration-driven — update copy here, not in UI components.
 */

import type { GuidedCourseDefinition } from "../types";

export const SEGMIQ_2_COURSE: GuidedCourseDefinition = {
  id: "segmiq-2",
  version: "2.0",
  title: "SegmiQ 2.0 Sales Course",
  lessons: [
    {
      id: "getting-started",
      title: "Getting Started",
      summary: "Understand the Dashboard and where to go next.",
      order: 1,
      steps: [
        {
          id: "gs-welcome",
          lessonId: "getting-started",
          type: "INTRO",
          title: "Welcome to SegmiQ 2.0",
          description:
            "Learn how to capture opportunities, turn Leads into Deals, keep follow-ups moving, and work toward your sales Goals — by using SegmiQ itself.",
          allowManualNext: true,
          route: "/sales/dashboard",
        },
        {
          id: "gs-dashboard",
          lessonId: "getting-started",
          type: "EXPLANATION",
          title: "This is your Dashboard",
          description:
            "Your Dashboard shows new enquiries, active Deals, Pipeline Value, and what deserves attention today. Sales work starts here.",
          allowManualNext: true,
          route: "/sales/dashboard",
        },
        {
          id: "gs-new-enquiries",
          lessonId: "getting-started",
          type: "SPOTLIGHT",
          label: "NEW ENQUIRIES",
          title: "Fresh enquiries land here",
          description:
            "New enquiries are Leads — people who may have an opportunity. They are not Deals yet.",
          target: "dashboard-kpi-new-enquiries",
          placement: "bottom",
          allowManualNext: true,
          route: "/sales/dashboard",
        },
        {
          id: "gs-active-deals",
          lessonId: "getting-started",
          type: "SPOTLIGHT",
          label: "ACTIVE DEALS",
          title: "Deals you're trying to win",
          description:
            "Active Deals are confirmed commercial opportunities already in your Pipeline.",
          target: "dashboard-kpi-active-deals",
          placement: "bottom",
          allowManualNext: true,
        },
        {
          id: "gs-pipeline-value",
          lessonId: "getting-started",
          type: "SPOTLIGHT",
          label: "PIPELINE VALUE",
          title: "What your Pipeline is worth",
          description:
            "Pipeline Value is the recorded value of active Deals you're currently trying to win. Pending estimates are never treated as zero.",
          target: "dashboard-kpi-pipeline",
          placement: "bottom",
          allowManualNext: true,
        },
        {
          id: "gs-todays-focus",
          lessonId: "getting-started",
          type: "SPOTLIGHT",
          label: "TODAY'S FOCUS",
          title: "What deserves attention next",
          description:
            "SegmiQ highlights BUILD, MOVE, or CLOSE focus based on your Pipeline and Goals — so you know where to spend energy today.",
          target: "dashboard-todays-focus",
          placement: "bottom",
          allowManualNext: true,
        },
        {
          id: "gs-sales-plan",
          lessonId: "getting-started",
          type: "SPOTLIGHT",
          label: "DAILY SALES PLAN",
          title: "Your controllable daily work",
          description:
            "Calls, follow-ups, and prospecting update your Daily Sales Plan as you work. Activity doesn't guarantee revenue — it keeps opportunities moving.",
          target: "dashboard-sales-plan",
          placement: "top",
          allowManualNext: true,
        },
        {
          id: "gs-open-pipeline",
          lessonId: "getting-started",
          type: "NAVIGATION",
          label: "MY PIPELINE",
          title: "This is where your Deals live",
          description:
            "Only qualified commercial opportunities belong in your Pipeline.",
          target: "sales-nav-pipeline",
          mobileTarget: "sales-mobile-nav-pipeline",
          placement: "right",
          requiredAction: {
            event: "NAVIGATED_TO_PIPELINE",
            cue: "Open My Pipeline to continue",
          },
        },
        {
          id: "gs-back-dashboard",
          lessonId: "getting-started",
          type: "NAVIGATION",
          label: "DASHBOARD",
          title: "Return to your Dashboard",
          description:
            "You'll always come back here to see enquiries, Deals, and today's focus.",
          target: "sales-nav-dashboard",
          mobileTarget: "sales-mobile-nav-dashboard",
          placement: "right",
          requiredAction: {
            event: "NAVIGATED_TO_DASHBOARD",
            cue: "Open Dashboard to continue",
          },
        },
        {
          id: "gs-complete",
          lessonId: "getting-started",
          type: "COMPLETE",
          title: "Getting Started complete",
          description:
            "You know what the Dashboard shows and where My Pipeline lives. Next you'll learn how a Lead becomes a Deal.",
          allowManualNext: true,
        },
      ],
    },
    {
      id: "lead-to-deal",
      title: "From Lead to Deal",
      summary: "Qualify an enquiry and create a Deal — safely in Practice Mode.",
      order: 2,
      steps: [
        {
          id: "ltd-concept",
          lessonId: "lead-to-deal",
          type: "INTRO",
          title: "Leads and Deals are different",
          description:
            "A Lead is someone who may have an opportunity. A Deal is a real commercial opportunity you are actively trying to win.",
          allowManualNext: true,
        },
        {
          id: "ltd-open-leads",
          lessonId: "lead-to-deal",
          type: "NAVIGATION",
          label: "LEADS",
          title: "Open Leads",
          description:
            "Leads contains every enquiry and prospect entering your sales process.",
          target: "sales-nav-leads",
          mobileTarget: "sales-mobile-more-leads",
          placement: "right",
          requiredAction: {
            event: "NAVIGATED_TO_LEADS",
            cue: "Open Leads to continue",
          },
        },
        {
          id: "ltd-practice-start",
          lessonId: "lead-to-deal",
          type: "PRACTICE",
          title: "Practice scenario",
          description:
            "You'll work a practice Lead. Actions here don't affect your real sales data.",
          practiceScenario: "lead-to-deal",
          allowManualNext: true,
        },
        {
          id: "ltd-open-lead",
          lessonId: "lead-to-deal",
          type: "ACTION",
          label: "PRACTICE",
          title: "Open the practice Lead",
          description:
            "Before an enquiry becomes a Deal, understand what the customer is trying to buy.",
          target: "practice-lead-row",
          placement: "bottom",
          practiceScenario: "lead-to-deal",
          requiredAction: {
            event: "OPENED_PRACTICE_LEAD",
            cue: "Open Tariro Moyo to continue",
          },
        },
        {
          id: "ltd-discovery",
          lessonId: "lead-to-deal",
          type: "ACTION",
          label: "DISCOVERY",
          title: "Capture discovery",
          description:
            "Confirm interest and intent so SegmiQ can judge Deal readiness.",
          target: "practice-lead-discovery",
          placement: "left",
          practiceScenario: "lead-to-deal",
          requiredAction: {
            event: "PRACTICE_QUALIFICATION_UPDATED",
            cue: "Save discovery details to continue",
          },
        },
        {
          id: "ltd-readiness",
          lessonId: "lead-to-deal",
          type: "SPOTLIGHT",
          label: "DEAL READINESS",
          title: "Confirm a real opportunity",
          description:
            "SegmiQ helps you confirm there is a genuine commercial opportunity before adding it to your Pipeline.",
          target: "practice-deal-readiness",
          placement: "left",
          practiceScenario: "lead-to-deal",
          allowManualNext: true,
        },
        {
          id: "ltd-create-deal",
          lessonId: "lead-to-deal",
          type: "ACTION",
          label: "CREATE DEAL",
          title: "Create the Deal",
          description:
            "When readiness looks solid, create the Deal. This is the moment an enquiry becomes a commercial opportunity.",
          target: "practice-create-deal",
          placement: "top",
          practiceScenario: "lead-to-deal",
          requiredAction: {
            event: "PRACTICE_DEAL_CREATED",
            cue: "Create Deal to continue",
          },
        },
        {
          id: "ltd-reinforce",
          lessonId: "lead-to-deal",
          type: "EXPLANATION",
          title: "You've turned an enquiry into a Deal",
          description:
            "Leads begin as enquiries. Deals are confirmed opportunities that you actively work toward winning — and they belong in your Pipeline.",
          allowManualNext: true,
          practiceScenario: "lead-to-deal",
        },
        {
          id: "ltd-complete",
          lessonId: "lead-to-deal",
          type: "COMPLETE",
          title: "Lead to Deal complete",
          description:
            "You know how to qualify an enquiry and turn it into a Deal. Next: work it through your Pipeline.",
          allowManualNext: true,
        },
      ],
    },
    {
      id: "pipeline",
      title: "Working Your Pipeline",
      summary: "Move Deals through commercial stages.",
      order: 3,
      steps: [
        {
          id: "pipe-intro",
          lessonId: "pipeline",
          type: "INTRO",
          title: "Your Pipeline contains Deals",
          description:
            "Qualified opportunities move through stages until they're Won or Lost. Leads do not live on the Pipeline board.",
          allowManualNext: true,
        },
        {
          id: "pipe-nav",
          lessonId: "pipeline",
          type: "NAVIGATION",
          label: "MY PIPELINE",
          title: "Open My Pipeline",
          description: "This is where active Deals live.",
          target: "sales-nav-pipeline",
          mobileTarget: "sales-mobile-nav-pipeline",
          placement: "right",
          requiredAction: {
            event: "NAVIGATED_TO_PIPELINE",
            cue: "Open My Pipeline to continue",
          },
        },
        {
          id: "pipe-stages",
          lessonId: "pipeline",
          type: "EXPLANATION",
          title: "Deal stages mean progress",
          description:
            "Qualified confirms opportunity. Scoping develops requirements. Proposal sent means a commercial offer is out. Negotiating means the customer is moving toward a decision.",
          allowManualNext: true,
        },
        {
          id: "pipe-practice",
          lessonId: "pipeline",
          type: "PRACTICE",
          title: "Practice Pipeline",
          description:
            "Move a practice Deal from Qualified to Scoping. Nothing here affects real Pipeline Value or Goals.",
          practiceScenario: "pipeline-stage",
          allowManualNext: true,
        },
        {
          id: "pipe-open-deal",
          lessonId: "pipeline",
          type: "ACTION",
          title: "Open the practice Deal",
          description: "Review estimated value and the next action before you move stage.",
          target: "practice-deal-card",
          placement: "bottom",
          practiceScenario: "pipeline-stage",
          requiredAction: {
            event: "PRACTICE_DEAL_OPENED",
            cue: "Open the practice Deal",
          },
        },
        {
          id: "pipe-move",
          lessonId: "pipeline",
          type: "ACTION",
          title: "Move to Scoping",
          description:
            "Scoping means requirements, assessment, or project details are being developed.",
          target: "practice-deal-stage-scoping",
          placement: "bottom",
          practiceScenario: "pipeline-stage",
          requiredAction: {
            event: "PRACTICE_DEAL_STAGE_CHANGED",
            cue: "Move the practice Deal to Scoping",
          },
        },
        {
          id: "pipe-complete",
          lessonId: "pipeline",
          type: "COMPLETE",
          title: "Pipeline lesson complete",
          description:
            "You can progress Deals through commercial stages. Next: keep follow-ups moving with Tasks.",
          allowManualNext: true,
        },
      ],
    },
    {
      id: "tasks",
      title: "Following Up & Using Tasks",
      summary: "Use Today's Focus and complete follow-ups.",
      order: 4,
      steps: [
        {
          id: "tasks-intro",
          lessonId: "tasks",
          type: "INTRO",
          title: "SegmiQ helps you decide what deserves attention next",
          description:
            "Fresh high-intent Leads, overdue follow-ups, and Deals at risk rise to the top. When your Deal queue is clear, SegmiQ helps you build more Pipeline.",
          allowManualNext: true,
        },
        {
          id: "tasks-nav",
          lessonId: "tasks",
          type: "NAVIGATION",
          label: "TASKS",
          title: "Open Tasks",
          description: "Your Daily Sales Plan and priority queue live here.",
          target: "sales-nav-tasks",
          mobileTarget: "sales-mobile-nav-tasks",
          placement: "right",
          requiredAction: {
            event: "NAVIGATED_TO_TASKS",
            cue: "Open Tasks to continue",
          },
        },
        {
          id: "tasks-practice",
          lessonId: "tasks",
          type: "PRACTICE",
          title: "Practice a follow-up",
          description:
            "Complete a practice follow-up and watch Daily Plan progress update. Real commitments stay untouched.",
          practiceScenario: "daily-plan-followup",
          allowManualNext: true,
        },
        {
          id: "tasks-complete-fu",
          lessonId: "tasks",
          type: "ACTION",
          title: "Complete the follow-up",
          description:
            "An active Deal should always have a clear next action. Completing work updates your Daily Sales Plan.",
          target: "practice-complete-followup",
          placement: "top",
          practiceScenario: "daily-plan-followup",
          requiredAction: {
            event: "PRACTICE_FOLLOWUP_COMPLETED",
            cue: "Complete follow-up to continue",
          },
        },
        {
          id: "tasks-build",
          lessonId: "tasks",
          type: "EXPLANATION",
          title: "When there are no Deals to work",
          description:
            "If your priority Deal queue is clear and you still need more Pipeline, SegmiQ shifts focus toward prospecting — BUILD PIPELINE.",
          allowManualNext: true,
        },
        {
          id: "tasks-complete",
          lessonId: "tasks",
          type: "COMPLETE",
          title: "Tasks lesson complete",
          description:
            "You know how today's actions feed the Daily Sales Plan. Next: quotations on Deals.",
          allowManualNext: true,
        },
      ],
    },
    {
      id: "quotations",
      title: "Quotations",
      summary: "Quotes belong to Deals — practice creating one safely.",
      order: 5,
      steps: [
        {
          id: "quote-intro",
          lessonId: "quotations",
          type: "INTRO",
          title: "Quotes belong to Deals",
          description:
            "A quotation is a commercial offer attached to an active Deal — not a free-floating document.",
          allowManualNext: true,
          requiresCapability: "quotes",
        },
        {
          id: "quote-nav",
          lessonId: "quotations",
          type: "NAVIGATION",
          label: "QUOTATIONS",
          title: "Open Quotations",
          description: "See quotes you've issued and start new ones from Deals.",
          target: "sales-nav-quotes",
          mobileTarget: "sales-mobile-more-quotes",
          placement: "right",
          requiredAction: {
            event: "NAVIGATED_TO_QUOTES",
            cue: "Open Quotations to continue",
          },
          requiresCapability: "quotes",
        },
        {
          id: "quote-practice",
          lessonId: "quotations",
          type: "PRACTICE",
          title: "Practice quotation",
          description:
            "Create a practice quote. No real quote number, PDF, or customer message is generated.",
          practiceScenario: "quotation",
          allowManualNext: true,
          requiresCapability: "quotes",
        },
        {
          id: "quote-create",
          lessonId: "quotations",
          type: "ACTION",
          title: "Create a practice quote",
          description:
            "After a quote, Deals often move to Proposal sent — then schedule a follow-up.",
          target: "practice-create-quote",
          placement: "top",
          practiceScenario: "quotation",
          requiredAction: {
            event: "PRACTICE_QUOTE_CREATED",
            cue: "Create practice quote to continue",
          },
          requiresCapability: "quotes",
        },
        {
          id: "quote-complete",
          lessonId: "quotations",
          type: "COMPLETE",
          title: "Quotations lesson complete",
          description: "Quotes sit on Deals and support Proposal sent. Next: WhatsApp Sales Hub.",
          allowManualNext: true,
        },
      ],
    },
    {
      id: "whatsapp",
      title: "WhatsApp Sales Hub",
      summary: "Find conversations and use sales context — without sending live messages.",
      order: 6,
      steps: [
        {
          id: "wa-intro",
          lessonId: "whatsapp",
          type: "INTRO",
          title: "WhatsApp is part of the sales workflow",
          description:
            "The Sales Hub shows conversations alongside Lead/Deal intelligence, quick replies, and next actions.",
          allowManualNext: true,
          requiresCapability: "whatsapp",
        },
        {
          id: "wa-nav",
          lessonId: "whatsapp",
          type: "NAVIGATION",
          label: "WHATSAPP",
          title: "Open WhatsApp Sales Hub",
          description: "Your conversation list and chat live here.",
          target: "sales-nav-whatsapp",
          mobileTarget: "sales-mobile-nav-whatsapp",
          placement: "right",
          requiredAction: {
            event: "NAVIGATED_TO_WHATSAPP",
            cue: "Open WhatsApp Sales Hub to continue",
          },
          requiresCapability: "whatsapp",
        },
        {
          id: "wa-practice",
          lessonId: "whatsapp",
          type: "PRACTICE",
          title: "Practice conversation",
          description:
            "Reply in Practice Mode only. Nothing is sent via WhatsApp.",
          practiceScenario: "whatsapp-hub",
          allowManualNext: true,
          requiresCapability: "whatsapp",
        },
        {
          id: "wa-reply",
          lessonId: "whatsapp",
          type: "ACTION",
          title: "Choose a quick reply",
          description:
            "Quick replies help you respond consistently while staying close to Deal context.",
          target: "practice-whatsapp-quick-reply",
          placement: "top",
          practiceScenario: "whatsapp-hub",
          requiredAction: {
            event: "PRACTICE_WHATSAPP_REPLY_SELECTED",
            cue: "Select a practice quick reply",
          },
          requiresCapability: "whatsapp",
        },
        {
          id: "wa-complete",
          lessonId: "whatsapp",
          type: "COMPLETE",
          title: "WhatsApp lesson complete",
          description: "You can navigate the Hub and use context without sending live messages.",
          allowManualNext: true,
        },
      ],
    },
    {
      id: "goals",
      title: "Goals & Your Daily Sales Plan",
      summary: "Connect today's work to the result you're aiming for.",
      order: 7,
      steps: [
        {
          id: "goals-intro",
          lessonId: "goals",
          type: "INTRO",
          title: "Goals connect today's work to the result",
          description:
            "Your revenue Goal shows the outcome. Your Daily Sales Plan helps you focus on activities that can move you toward it — without guaranteeing sales.",
          allowManualNext: true,
          requiresCapability: "goals",
        },
        {
          id: "goals-nav",
          lessonId: "goals",
          type: "NAVIGATION",
          label: "GOALS",
          title: "Open Goals",
          description: "See remaining target, Pipeline Coverage, and daily commitments.",
          target: "sales-nav-goals",
          mobileTarget: "sales-mobile-more-goals",
          placement: "right",
          requiredAction: {
            event: "NAVIGATED_TO_GOALS",
            cue: "Open Goals to continue",
          },
          requiresCapability: "goals",
        },
        {
          id: "goals-practice",
          lessonId: "goals",
          type: "PRACTICE",
          title: "Understand Goal → Plan",
          description:
            "Review a practice Goal view. Real Goals and Reports stay unchanged.",
          practiceScenario: "goals-overview",
          allowManualNext: true,
          requiresCapability: "goals",
        },
        {
          id: "goals-revenue",
          lessonId: "goals",
          type: "SPOTLIGHT",
          title: "Revenue Goal",
          description: "This is the result you're trying to achieve this period.",
          target: "practice-goals-revenue",
          placement: "bottom",
          practiceScenario: "goals-overview",
          allowManualNext: true,
          requiresCapability: "goals",
        },
        {
          id: "goals-coverage",
          lessonId: "goals",
          type: "SPOTLIGHT",
          title: "Pipeline Coverage",
          description:
            "Coverage compares Pipeline Value to your remaining target so you know if you need to BUILD, MOVE, or CLOSE.",
          target: "practice-goals-coverage",
          placement: "bottom",
          practiceScenario: "goals-overview",
          allowManualNext: true,
          requiresCapability: "goals",
        },
        {
          id: "goals-commitments",
          lessonId: "goals",
          type: "SPOTLIGHT",
          title: "Daily Commitments",
          description:
            "Calls, follow-ups, prospecting, and quotations are the work you control day to day.",
          target: "practice-goals-commitments",
          placement: "top",
          practiceScenario: "goals-overview",
          allowManualNext: true,
          requiresCapability: "goals",
        },
        {
          id: "goals-complete",
          lessonId: "goals",
          type: "COMPLETE",
          title: "You're ready to work in SegmiQ 2.0",
          description:
            "You've learned how to turn enquiries into Deals, manage your Pipeline, follow up consistently, and use your Daily Sales Plan.",
          allowManualNext: true,
        },
      ],
    },
  ],
};

export function getSegmiq2Lesson(lessonId: string) {
  return SEGMIQ_2_COURSE.lessons.find((l) => l.id === lessonId) ?? null;
}

export function getSegmiq2Step(lessonId: string, stepId: string) {
  const lesson = getSegmiq2Lesson(lessonId);
  return lesson?.steps.find((s) => s.id === stepId) ?? null;
}

export function orderedSegmiq2Lessons() {
  return [...SEGMIQ_2_COURSE.lessons].sort((a, b) => a.order - b.order);
}
