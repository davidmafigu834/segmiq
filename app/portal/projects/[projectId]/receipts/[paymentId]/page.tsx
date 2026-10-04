import { notFound } from "next/navigation";
import { money, shortDate } from "@/components/portal/format";
import { requirePortal } from "@/lib/portal/page";
import { getPortalProject } from "@/lib/portal/service";

export const dynamic = "force-dynamic";

export default async function PortalReceiptPage({ params }: { params: { projectId: string; paymentId: string } }) {
  const identity = await requirePortal();
  const project = await getPortalProject(identity.clientId, identity.contactId, params.projectId, identity.settings);
  if (!project || !project.financials || !("history" in project.financials)) notFound();
  const payment = (project.financials.history ?? []).find((row) => row.id === params.paymentId);
  if (!payment) notFound();
  return (
    <main className="mx-auto max-w-lg bg-white px-6 py-10 text-[#1a1f1c]">
      <p className="text-sm text-[#5c665f]">{identity.companyName}</p>
      <h1 className="mt-2 text-3xl font-semibold">Payment receipt</h1>
      <p className="mt-1 text-sm text-[#5c665f]">This is a receipt for money received. It is not a tax invoice.</p>
      <dl className="mt-8 space-y-3 text-sm">
        <div className="flex justify-between gap-4"><dt>Customer</dt><dd>{identity.name}</dd></div>
        <div className="flex justify-between gap-4"><dt>Project</dt><dd>{project.title}</dd></div>
        <div className="flex justify-between gap-4"><dt>Project number</dt><dd>{project.number}</dd></div>
        <div className="flex justify-between gap-4"><dt>Amount received</dt><dd>{money(payment.amount, project.financials.currency)}</dd></div>
        <div className="flex justify-between gap-4"><dt>Payment date</dt><dd>{shortDate(payment.paidAt)}</dd></div>
        <div className="flex justify-between gap-4"><dt>Method</dt><dd>{payment.method}</dd></div>
        {payment.reference ? <div className="flex justify-between gap-4"><dt>Reference</dt><dd>{payment.reference}</dd></div> : null}
        <div className="flex justify-between gap-4"><dt>Remaining balance</dt><dd>{money(project.financials.outstanding, project.financials.currency)}</dd></div>
      </dl>
      <p className="mt-10 text-[11px] text-[#8a918c]">Powered by SegmiQ</p>
    </main>
  );
}
