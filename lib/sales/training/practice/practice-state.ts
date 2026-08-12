/**
 * Ephemeral Practice Mode state — never written to CRM tables.
 * All training customers / deals / quotes live only in memory (or course session).
 */

export type PracticeLead = {
  id: string;
  name: string;
  source: string;
  intent: "Hot" | "Warm" | "Cold";
  interest: string;
  discoveryNotes: string;
  discoverySaved: boolean;
  readinessScore: number;
  dealCreated: boolean;
  dealId: string | null;
};

export type PracticeDealStage = "QUALIFIED" | "SCOPING" | "PROPOSAL_SENT" | "NEGOTIATING";

export type PracticeDeal = {
  id: string;
  name: string;
  stage: PracticeDealStage;
  estimatedValue: number | null;
  nextActionLabel: string;
  nextActionDue: string;
  followUpCompleted: boolean;
  quoteCreated: boolean;
};

export type PracticeWhatsAppMessage = {
  id: string;
  from: "customer" | "you";
  text: string;
};

export type PracticeScenarioState = {
  lead: PracticeLead;
  deal: PracticeDeal;
  planCompleted: number;
  planTarget: number;
  whatsappMessages: PracticeWhatsAppMessage[];
  selectedQuickReply: string | null;
  goalTarget: number;
  goalAchieved: number;
  coverageRatio: number;
};

export function createPracticeSeed(): PracticeScenarioState {
  return {
    lead: {
      id: "practice-lead-tariro",
      name: "Tariro Moyo",
      source: "Facebook Form",
      intent: "Hot",
      interest: "Solar installation",
      discoveryNotes: "",
      discoverySaved: false,
      readinessScore: 35,
      dealCreated: false,
      dealId: null,
    },
    deal: {
      id: "practice-deal-tariro",
      name: "Tariro Moyo — Solar",
      stage: "QUALIFIED",
      estimatedValue: 4800,
      nextActionLabel: "Follow up on site visit",
      nextActionDue: "Today",
      followUpCompleted: false,
      quoteCreated: false,
    },
    planCompleted: 2,
    planTarget: 5,
    whatsappMessages: [
      {
        id: "m1",
        from: "customer",
        text: "Hi, I received your quote. Can you explain the warranty?",
      },
    ],
    selectedQuickReply: null,
    goalTarget: 25000,
    goalAchieved: 8200,
    coverageRatio: 1.6,
  };
}
