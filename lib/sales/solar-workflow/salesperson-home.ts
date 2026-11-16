import { redirect } from "next/navigation";
import { companyUsesSolarWorkflow } from "@/lib/sales/solar-workflow/service";

/** Old salesperson destinations send a solar company back to Today or Leads. */
export async function redirectSolarSalesperson(clientId: string | null | undefined, href: string) {
  if (clientId && (await companyUsesSolarWorkflow(clientId))) redirect(href);
}
