import { loadDemoDatasetForClient } from "@/lib/demo/provider";
import { isDemoWorkspaceId } from "@/lib/demo/mode";
import type { DemoDataset } from "@/lib/demo/types";
import type { DealRow, LeadRow, QuotationRow } from "@/types";

export type DemoLookup<T> =
  | { mode: "production" }
  | { mode: "demo"; row: T | null; dataset: DemoDataset | null };

async function datasetFor(clientId: string | null | undefined): Promise<DemoDataset | null | "production"> {
  if (!clientId) return "production";
  if (!(await isDemoWorkspaceId(clientId))) return "production";
  return loadDemoDatasetForClient(clientId);
}

/** Demo organisations never fall through to another tenant's CRM rows. */
export async function lookupDemoLead(clientId: string | null | undefined, leadId: string): Promise<DemoLookup<LeadRow>> {
  const dataset = await datasetFor(clientId);
  if (dataset === "production") return { mode: "production" };
  const lead = dataset?.leads.find((row) => row.id === leadId && row.client_id === clientId) ?? null;
  return { mode: "demo", row: lead, dataset };
}

export async function lookupDemoDeal(clientId: string | null | undefined, dealId: string): Promise<DemoLookup<DealRow>> {
  const dataset = await datasetFor(clientId);
  if (dataset === "production") return { mode: "production" };
  const deal = dataset?.deals.find((row) => row.id === dealId && row.client_id === clientId) ?? null;
  return { mode: "demo", row: deal, dataset };
}

export async function lookupDemoQuote(clientId: string | null | undefined, quoteId: string): Promise<DemoLookup<QuotationRow>> {
  const dataset = await datasetFor(clientId);
  if (dataset === "production") return { mode: "production" };
  const quote = dataset?.quotations.find((row) => row.id === quoteId && row.client_id === clientId) ?? null;
  return { mode: "demo", row: quote, dataset };
}
