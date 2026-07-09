import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SalesQuotesClient, type SalesQuoteListItem } from "./SalesQuotesClient";
import type { QuotationRow } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type DbQuoteRow = QuotationRow & {
  leads: { name: string | null; phone: string | null } | null;
};

function mapQuote(row: DbQuoteRow): SalesQuoteListItem {
  return {
    ...row,
    lead_name: row.leads?.name ?? row.customer_name,
    lead_phone: row.leads?.phone ?? row.customer_phone,
  };
}

export default async function SalesQuotesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  const supabase = createAdminClient();
  const { data: leads } = await supabase
    .from("leads")
    .select("id")
    .eq("assigned_to_id", session.userId);

  const leadIds = (leads ?? []).map((l) => l.id as string);
  let quotes: SalesQuoteListItem[] = [];

  if (leadIds.length > 0) {
    const { data, error } = await supabase
      .from("quotations")
      .select("*, leads(name, phone)")
      .in("lead_id", leadIds)
      .order("updated_at", { ascending: false });

    if (!error && data) {
      quotes = (data as DbQuoteRow[]).map(mapQuote);
    }
  }

  return (
    <SalesLayout breadcrumb="SALES / QUOTES" pageTitle="My quotes">
      <SalesQuotesClient initialQuotes={quotes} />
    </SalesLayout>
  );
}
