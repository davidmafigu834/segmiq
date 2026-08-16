import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClientBilling } from "@/lib/billing/client-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tenant-scoped invoice/receipt PDF redirect. Never returns another company's URL.
 */
export async function GET(
  req: Request,
  { params }: { params: { invoiceId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, client_id, pdf_url")
    .eq("id", params.invoiceId)
    .maybeSingle();

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (session.role !== "SUPER_ADMIN") {
    const access = await canAccessClientBilling({
      userId: session.userId,
      role: session.role,
      clientId: session.clientId,
      clientMode: session.clientMode,
    });
    if (!access.ok || invoice.client_id !== access.clientId) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
  }

  const kind = new URL(req.url).searchParams.get("kind") === "receipt" ? "receipt" : "invoice";
  const clientId = invoice.client_id as string;

  if (kind === "invoice") {
    const url = invoice.pdf_url as string | null;
    if (!url) {
      return NextResponse.json({ error: "Invoice PDF is not available yet." }, { status: 404 });
    }
    return NextResponse.redirect(url);
  }

  const { data: payments } = await supabase
    .from("payments")
    .select("id")
    .eq("invoice_id", invoice.id)
    .eq("client_id", clientId)
    .eq("status", "confirmed");
  const paymentIds = (payments ?? []).map((p) => p.id as string);
  if (paymentIds.length === 0) {
    return NextResponse.json({ error: "Receipt is not available." }, { status: 404 });
  }
  const { data: receipt } = await supabase
    .from("receipts")
    .select("pdf_url")
    .eq("client_id", clientId)
    .in("payment_id", paymentIds)
    .not("pdf_url", "is", null)
    .limit(1)
    .maybeSingle();
  const url = receipt?.pdf_url as string | null;
  if (!url) {
    return NextResponse.json({ error: "Receipt is not available." }, { status: 404 });
  }
  return NextResponse.redirect(url);
}
