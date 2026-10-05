import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { ProofForm, SupportForm, UpgradeForm } from "@/components/portal/PortalActions";
import { AskSegmiq } from "@/components/intelligence/AskSegmiq";
import { money, shortDate } from "@/components/portal/format";
import { requirePortal } from "@/lib/portal/page";
import { getPortalProject, listPortalAssets } from "@/lib/portal/service";

export const dynamic = "force-dynamic";

export default async function PortalProjectPage({ params }: { params: { projectId: string } }) {
  const identity = await requirePortal();
  const project = await getPortalProject(identity.clientId, identity.contactId, params.projectId, identity.settings);
  if (!project) notFound();
  const assets = identity.settings.showAssets
    ? await listPortalAssets(identity.clientId, identity.contactId, identity.settings)
    : [];
  const projectAssets = assets.filter((asset) => !asset.parentAssetId);
  const completed = project.stageKey === "COMPLETED";
  const financials = project.financials && "paid" in project.financials ? project.financials : null;

  return (
    <PortalFrame companyName={identity.companyName} logoUrl={identity.logoUrl} active="projects">
      <p className="text-[13px] text-sales-text-secondary">{project.number}</p>
      <h1 className="mt-1 text-[2rem] font-semibold leading-tight">{project.title}</h1>
      <p className="mt-4 text-[1.5rem] font-semibold">{project.stage}</p>
      <p className="mt-2 text-[16px] leading-7">{project.nextStep}</p>
      {project.site ? <p className="mt-2 text-[15px] text-sales-text-secondary">{project.site}</p> : null}

      <section className="mt-8">
        <ol className="space-y-3">
          {project.timeline.map((step) => (
            <li key={step.key} className="flex items-center gap-3 text-[15px]">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold ${step.state === "current" ? "bg-segmiq-lime text-sales-text-primary" : step.state === "done" ? "bg-sales-text-primary text-white" : "border border-sales-border text-sales-text-muted"}`}>
                {step.state === "done" ? "✓" : step.state === "current" ? "●" : ""}
              </span>
              <span className={step.state === "upcoming" ? "text-sales-text-muted" : "font-medium"}>{step.label}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8 border-t border-sales-border pt-6">
        <h2 className="text-[1.15rem] font-semibold">Installation</h2>
        {project.installation.scheduleLabel ? (
          <p className="mt-2 text-base">{project.installation.scheduleLabel}</p>
        ) : (
          <p className="mt-2 text-[15px] text-sales-text-secondary">Installation date is being confirmed.</p>
        )}
        {project.installation.started ? <p className="mt-2 text-[15px]">Installation in progress{project.installation.startedLabel ? ` · started ${project.installation.startedLabel}` : ""}</p> : null}
        {project.commissioning ? <p className="mt-3 text-[15px]">Testing and commissioning completed{shortDate(project.commissioning.at) ? ` · ${shortDate(project.commissioning.at)}` : ""}. {project.commissioning.summary}</p> : null}
        {project.handover ? (
          <div className="mt-3 text-[15px]">
            <p>Handover complete{shortDate(project.handover.at) ? ` · ${shortDate(project.handover.at)}` : ""}</p>
            {project.handover.customerNotes ? <p className="mt-1 text-sales-text-secondary">{project.handover.customerNotes}</p> : null}
          </div>
        ) : null}
      </section>

      {project.visits.length ? (
        <section className="mt-8 border-t border-sales-border pt-6">
          <h2 className="text-[1.15rem] font-semibold">Visits</h2>
          <ul className="mt-3 divide-y divide-sales-border">
            {project.visits.map((visit) => (
              <li key={visit.id} className="py-3">
                <p className="text-[16px] font-semibold">{visit.title}</p>
                <p className="text-[14px] text-sales-text-secondary">{visit.when || "Time to be confirmed"} · {visit.status}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {financials ? (
        <section className="mt-8 border-t border-sales-border pt-6">
          <h2 className="text-[1.15rem] font-semibold">Payments</h2>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            <div><dt className="text-[13px] text-sales-text-secondary">Project value</dt><dd className="mt-1 text-[1.15rem] font-semibold tabular-nums">{money(financials.projectValue, financials.currency)}</dd></div>
            <div><dt className="text-[13px] text-sales-text-secondary">Paid</dt><dd className="mt-1 text-[1.15rem] font-semibold tabular-nums">{money(financials.paid, financials.currency)}</dd></div>
            <div><dt className="text-[13px] text-sales-text-secondary">Balance</dt><dd className="mt-1 text-[1.15rem] font-semibold tabular-nums">{money(financials.outstanding, financials.currency)}</dd></div>
          </dl>
          <ul className="mt-4 space-y-2 text-sm">
            {(financials.terms ?? []).map((term) => (
              <li key={term.id} className="flex justify-between gap-3">
                <span>{term.label}</span>
                <span>{term.state} · {money(term.amount, financials.currency)}</span>
              </li>
            ))}
          </ul>
          <ul className="mt-4 space-y-2 text-[14px] text-sales-text-secondary">
            {(financials.history ?? []).map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3">
                <span>{shortDate(payment.paidAt)} · {payment.method}{payment.reference ? ` · ${payment.reference}` : ""}</span>
                <Link href={`/portal/projects/${project.id}/receipts/${payment.id}`} className="font-medium text-sales-text-primary">{money(payment.amount, financials.currency)}</Link>
              </li>
            ))}
          </ul>
          {(financials.awaitingReview ?? []).length ? <p className="mt-3 text-sm">A payment proof is waiting for the company to confirm.</p> : null}
          {project.allowProof ? <div className="mt-4"><ProofForm projectId={project.id as string} currency={financials.currency || "USD"} /></div> : null}
        </section>
      ) : project.financials && "paymentReceived" in project.financials ? (
        <section className="mt-8 border-t border-sales-border pt-6"><p className="text-[16px] font-semibold">Payment received</p></section>
      ) : null}

      {project.quotation ? (
        <section className="mt-8 border-t border-sales-border pt-6">
          <h2 className="text-[1.15rem] font-semibold">Quotation {project.quotation.number}</h2>
          <p className="mt-1 text-[15px] text-sales-text-secondary">{project.quotation.status}{project.quotation.total != null ? ` · ${money(Number(project.quotation.total), project.quotation.currency || "USD")}` : ""}</p>
          {project.quotation.href ? <Link href={project.quotation.href} className="mt-3 inline-flex min-h-11 items-center text-[15px] font-semibold">View quotation</Link> : null}
        </section>
      ) : null}

      {completed && projectAssets.length ? (
        <section className="mt-8 border-t border-sales-border pt-6">
          <h2 className="text-[1.15rem] font-semibold">My system</h2>
          <ul className="mt-3 divide-y divide-sales-border">
            {projectAssets.map((asset) => (
              <li key={asset.id} className="py-3"><Link href={`/portal/assets/${asset.id}`} className="text-[16px] font-semibold">{asset.name}</Link></li>
            ))}
          </ul>
        </section>
      ) : null}

      {identity.settings.portalAiEnabled ? <div className="mt-4"><AskSegmiq portal projectId={project.id as string} /></div> : null}

      {identity.settings.allowSupport ? (
        <section className="mt-8 border-t border-sales-border pt-6">
          <h2 className="text-[1.15rem] font-semibold">Get support</h2>
          <div className="mt-3"><SupportForm projectId={project.id as string} assets={assets.map((asset) => ({ id: asset.id as string, name: asset.name as string }))} /></div>
          {identity.whatsappHref ? <a href={identity.whatsappHref} className="mt-3 inline-flex min-h-11 items-center text-[15px] font-semibold">Continue on WhatsApp</a> : null}
        </section>
      ) : null}

      {identity.settings.allowUpgradeRequests ? (
        <section className="mt-8 border-t border-sales-border pt-6">
          <h2 className="text-[1.15rem] font-semibold">Need more capacity?</h2>
          <div className="mt-3"><UpgradeForm projectId={project.id as string} /></div>
        </section>
      ) : null}
    </PortalFrame>
  );
}
