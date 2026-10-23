import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { createAdminClient } from "@/lib/supabase/admin";
import { platformAiUsageFlags } from "@/lib/platform-ai-usage/flags";
import { formatUsd } from "@/lib/commercial/catalogue";
import { MessagesSquare } from "lucide-react";
import { CommercialEmptyState, CommercialStatus } from "@/components/commercial/CommercialPrimitives";

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
  return (
    <AgencyLayout breadcrumb="COMMERCIAL" pageTitle="AI Top-ups">
      <div className="space-y-4">
        {!platformAiUsageFlags.topups ? (
          <div className="rounded-xl border border-[var(--warning)] bg-[var(--bg-secondary)] p-4 text-sm text-[var(--text-secondary)]">
            Top-ups are disabled until approved v2 agreements and payment-linked
            activation are verified. No admin activation bypass is available.
          </div>
        ) : null}
        {rows.map((row) => {
          const client = row.clients as { name?: string } | null;
          return (
            <article
              key={row.id as string}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h2 className="font-medium">{client?.name ?? "Company"}</h2>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {Number(row.pack_quantity)} × 250 conversations
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p>{formatUsd(Number(row.total_price_usd_cents))}</p>
                  <div className="mt-1"><CommercialStatus value={String(row.status)} /></div>
                </div>
              </div>
            </article>
          );
        })}
        {!rows.length ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]"><CommercialEmptyState icon={MessagesSquare} title="No top-up requests" description={platformAiUsageFlags.topups ? "Customer-approved conversation packs will appear here after a valid request." : "Top-up records stay unavailable while the feature gate is off. No overage charge is created automatically."} /></div>
        ) : null}
      </div>
    </AgencyLayout>
  );
}
