import { redirect } from "next/navigation";
import { getOperationalSession } from "@/lib/auth/operational-session";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";
import { readSalesWorkflowPreset } from "@/lib/sales/solar-workflow/service";

export async function loadSolarSalesPage() {
  const session = await getOperationalSession();
  if (!session?.userId || !canActAsSalesperson(session)) redirect("/login");
  if (!session.clientId || (await readSalesWorkflowPreset(session.clientId)) !== "SOLAR_INSTALLATION") {
    redirect("/sales/dashboard");
  }
  const shell = await loadSalesShellProps(session);
  return { session, shell, clientId: session.clientId };
}
