/**
 * Development-only Learning fixtures.
 * Never seed into production.
 */

export const DEMO_SOLAR_COMPANY_NAME = "Demo Solar Company";

export const DEMO_SALESPEOPLE = ["David", "Brian", "Tawanda", "Rumbi"] as const;

export const DEMO_LEARNING_SCENARIOS = [
  {
    id: "qualification-heavy-load",
    category: "QUALIFICATION",
    customer: "Hi, I need solar for my house. I need something for a borehole and freezer.",
    salespersonAsks: ["location", "pump/load details", "other appliances", "timeline"],
    expectedCandidateTitle: "Heavy-load Package qualification",
  },
  {
    id: "faq-installation",
    category: "FAQ",
    customer: "Does installation come with the Package?",
    salesperson: "Yes, installation is included.",
  },
  {
    id: "terminology-5-kilo",
    category: "CUSTOMER_LANGUAGE",
    customer: "I want a 5 kilo system",
    meaning: "5kVA",
  },
  {
    id: "one-off-discount",
    category: "COMMERCIAL_PATTERN",
    salesperson: "Bro I'll give you 20% discount 😂 just this once",
    expectCompanyWideDiscount: false,
  },
  {
    id: "credit-conflict",
    category: "COMMERCIAL_PATTERN",
    companyBrain: "Payment plans offered = No",
    salesperson: "You can pay over 3 months.",
    expectConflict: true,
  },
  {
    id: "warranty-conflict",
    category: "PRODUCT_EXPLANATION",
    productWarrantyYears: 5,
    salesperson: "The battery has a 10-year warranty.",
    expectLearnWarranty: false,
  },
] as const;

export function assertNotProductionSeed(): void {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("Demo Learning fixtures must not seed production");
  }
}
