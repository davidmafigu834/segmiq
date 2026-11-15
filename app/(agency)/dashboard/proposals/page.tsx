import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { ProposalsManager } from "@/components/proposals/ProposalsManager";
import { RecordFrame } from "@/components/platform/workbench";
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
      <RecordFrame
        detail="A proposal is a sales record. Settings hold the number sequence."
        fact={{
          name: data?.length ? `${data.length} proposals are on the register.` : "No proposal is on the register.",
          detail: "Open settings when the number sequence needs a change.",
          action: "Open settings",
          href: "/dashboard/proposals/settings",
        }}
      >
        <ProposalsManager initialProposals={(data ?? []) as ProposalRow[]} openId={searchParams.open} />
      </RecordFrame>
    </AgencyLayout>
  );
}
