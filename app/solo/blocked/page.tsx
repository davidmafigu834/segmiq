import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { ClientBillingView } from "@/components/billing/ClientBillingView";
import { getClientBillingData } from "@/lib/billing/client-billing-data";
import { formatMoney } from "@/lib/billing/format";

export const dynamic = "force-dynamic";

export default async function SoloBlockedPage() {
  const session = await getServerSession(authOptions);
  if (!session?.clientId) redirect("/login");
  if (session.role !== "SALESPERSON" || session.clientMode !== "solo") redirect("/login");

  const data = await getClientBillingData(session.clientId);

  if (data.subscription?.status !== "suspended") redirect("/solo/billing");

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <span
            className="text-xl font-semibold text-[var(--accent-fg)]"
            style={{ fontFamily: "var(--font-instrument-serif)" }}
          >
            Segmiq
          </span>
          <a
            href="/api/auth/signout?callbackUrl=/login"
            className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            Sign out
          </a>
        </div>

        <div className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-muted)] p-5 md:p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--warning)]" />
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)]">
                Your account is paused for billing
              </h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Access to your workspace is temporarily paused while there is an outstanding balance of{" "}
                <strong className="text-[var(--text-primary)]">
                  {formatMoney(data.outstanding, data.currency)}
                </strong>
                . Settle the invoice below and upload your proof of payment to restore access — your leads are
                still being captured in the meantime.
              </p>
            </div>
          </div>
        </div>

        <ClientBillingView
          subscription={data.subscription}
          invoices={data.invoices}
          outstanding={data.outstanding}
          currency={data.currency}
          settings={data.settings}
        />
      </div>
    </div>
  );
}
