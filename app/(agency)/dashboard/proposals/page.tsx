import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { ProposalsManager } from "@/components/proposals/ProposalsManager";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProposalRow } from "@/types";

export const dynamic = "force-dynamic";

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: { open?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agency_proposals")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <AgencyLayout
      breadcrumb="PLATFORM / PROPOSALS"
      pageTitle="Sales proposals"
      actions={
        <Link
          href="/dashboard/proposals/settings"
          className="rounded-xl border border-[var(--border)] px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-primary)]"
        >
          Settings
        </Link>
      }
    >
      <ProposalsManager initialProposals={(data ?? []) as ProposalRow[]} openId={searchParams.open} />
    </AgencyLayout>
  );
}
