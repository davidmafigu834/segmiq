import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { createAdminClient } from "@/lib/supabase/admin";
import { platformAiUsageFlags } from "@/lib/platform-ai-usage/flags";
import { formatUsd } from "@/lib/commercial/catalogue";
import { EmptyNote, Fact, Panel, WorkRow } from "@/components/platform/workbench";

export const dynamic = "force-dynamic";

export default async function CommercialTopupsPage() {
  const session = await getServerSession(authOptions);
  if (
    !session?.userId ||
    session.role !== "SUPER_ADMIN" ||
    session.isImpersonating
  )
    redirect("/login");
  let rows: Array<Record<string, unknown>> = [];
  if (platformAiUsageFlags.topups) {
    const { data } = await createAdminClient()
      .from("platform_ai_topup_requests")
      .select(
        "id,status,pack_quantity,total_price_usd_cents,created_at,clients(name)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    rows = (data ?? []) as Array<Record<string, unknown>>;
  }
  const first = rows[0];
  const firstClient = first?.clients as { name?: string } | null;
  return (
    <AgencyLayout breadcrumb="COMMERCIAL" pageTitle="AI Top-ups">
      <div className="space-y-8">
        <p className="max-w-[62ch] text-[14px] text-[var(--text-secondary)]">A pack is a request. It does not charge until the customer approves it.</p>
        {!platformAiUsageFlags.topups ? (
          <Fact
            name="Top-ups are closed."
            detail="They stay closed until approved v2 agreements and payment-linked activation are verified. There is no admin bypass."
            action="Open agreements"
            href="/dashboard/commercial-sales/agreements"
          />
        ) : (
          <Fact
            name={first ? `${firstClient?.name ?? "A company"} requested a pack.` : "No pack is waiting."}
            detail={first ? `${Number(first.pack_quantity)} × 250 conversations · ${formatUsd(Number(first.total_price_usd_cents))}` : "Customer-approved packs appear here. Nothing is charged automatically."}
            action="Open usage"
            href="/dashboard/commercial-ai-usage"
          />
        )}
        <Panel title="Requests" count={rows.length}>
          {rows.length === 0 ? (
            <EmptyNote title="No requests" detail={platformAiUsageFlags.topups ? "Approved packs will appear here." : "The gate is off, so no overage charge is created."} />
          ) : (
            <ul>
              {rows.map((row) => {
                const client = row.clients as { name?: string } | null;
                return (
                  <WorkRow
                    key={row.id as string}
                    name={client?.name ?? "Company"}
                    meta={String(row.status)}
                    detail={`${Number(row.pack_quantity)} × 250 conversations · ${formatUsd(Number(row.total_price_usd_cents))}`}
                    action="Open usage"
                    href="/dashboard/commercial-ai-usage"
                  />
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </AgencyLayout>
  );
}
