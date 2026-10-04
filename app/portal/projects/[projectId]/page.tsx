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
      <p className="text-sm text-[#5c665f]">{project.number}</p>
      <h1 className="mt-1 text-4xl font-semibold tracking-tight">{project.title}</h1>
      <p className="mt-4 text-2xl font-semibold text-[#0f6b4c]">{project.stage}</p>
      <p className="mt-2 text-base leading-7">{project.nextStep}</p>
      {project.site ? <p className="mt-2 text-sm text-[#5c665f]">{project.site}</p> : null}

      <section className="mt-8">
        <ol className="space-y-3">
          {project.timeline.map((step) => (
            <li key={step.key} className="flex items-center gap-3 text-sm">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step.state === "upcoming" ? "bg-[#e7e1d6] text-[#5c665f]" : "bg-[#0f6b4c] text-white"}`}>
                {step.state === "done" ? "✓" : step.state === "current" ? "→" : ""}
              </span>
              <span className={step.state === "upcoming" ? "text-[#8a918c]" : "font-medium"}>{step.label}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8 rounded-3xl bg-white p-5">
        <h2 className="text-lg font-semibold">Installation</h2>
        {project.installation.scheduleLabel ? (
          <p className="mt-2 text-base">{project.installation.scheduleLabel}</p>
        ) : (
          <p className="mt-2 text-sm text-[#5c665f]">Installation date is being confirmed.</p>
        )}
        {project.installation.started ? <p className="mt-2 text-sm">Installation in progress{project.installation.startedLabel ? ` · started ${project.installation.startedLabel}` : ""}</p> : null}
        {project.commissioning ? <p className="mt-3 text-sm">Testing and commissioning completed{shortDate(project.commissioning.at) ? ` · ${shortDate(project.commissioning.at)}` : ""}. {project.commissioning.summary}</p> : null}
        {project.handover ? (
          <div className="mt-3 text-sm">
            <p>Handover complete{shortDate(project.handover.at) ? ` · ${shortDate(project.handover.at)}` : ""}</p>
            {project.handover.customerNotes ? <p className="mt-1 text-[#5c665f]">{project.handover.customerNotes}</p> : null}
          </div>
        ) : null}
      </section>

      {project.visits.length ? (
        <section className="mt-4 rounded-3xl bg-white p-5">
          <h2 className="text-lg font-semibold">Visits</h2>
          <ul className="mt-3 space-y-3">
            {project.visits.map((visit) => (
              <li key={visit.id}>
                <p className="font-medium">{visit.title}</p>
                <p className="text-sm text-[#5c665f]">{visit.when || "Time to be confirmed"} · {visit.status}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {financials ? (
        <section className="mt-4 rounded-3xl bg-white p-5">
          <h2 className="text-lg font-semibold">Payments</h2>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div><dt className="text-[#5c665f]">Project value</dt><dd className="mt-1 font-semibold">{money(financials.projectValue, financials.currency)}</dd></div>
            <div><dt className="text-[#5c665f]">Paid</dt><dd className="mt-1 font-semibold">{money(financials.paid, financials.currency)}</dd></div>
            <div><dt className="text-[#5c665f]">Outstanding</dt><dd className="mt-1 font-semibold">{money(financials.outstanding, financials.currency)}</dd></div>
          </dl>
          <ul className="mt-4 space-y-2 text-sm">
            {(financials.terms ?? []).map((term) => (
              <li key={term.id} className="flex justify-between gap-3">
                <span>{term.label}</span>
                <span>{term.state} · {money(term.amount, financials.currency)}</span>
              </li>
            ))}
          </ul>
          <ul className="mt-4 space-y-2 text-sm text-[#5c665f]">
            {(financials.history ?? []).map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3">
                <span>{shortDate(payment.paidAt)} · {payment.method}{payment.reference ? ` · ${payment.reference}` : ""}</span>
                <Link href={`/portal/projects/${project.id}/receipts/${payment.id}`} className="font-medium text-[#0f6b4c]">{money(payment.amount, financials.currency)}</Link>
              </li>
            ))}
          </ul>
          {(financials.awaitingReview ?? []).length ? <p className="mt-3 text-sm">A payment proof is waiting for the company to confirm.</p> : null}
          {project.allowProof ? <div className="mt-4"><ProofForm projectId={project.id as string} currency={financials.currency} /></div> : null}
        </section>
      ) : project.financials && "paymentReceived" in project.financials ? (
        <section className="mt-4 rounded-3xl bg-white p-5"><p className="font-medium">Payment received</p></section>
      ) : null}

      {project.quotation ? (
        <section className="mt-4 rounded-3xl bg-white p-5">
          <h2 className="text-lg font-semibold">Quotation {project.quotation.number}</h2>
          <p className="mt-1 text-sm text-[#5c665f]">{project.quotation.status}{project.quotation.total != null ? ` · ${money(Number(project.quotation.total), project.quotation.currency || "USD")}` : ""}</p>
          {project.quotation.href ? <Link href={project.quotation.href} className="mt-3 inline-block text-sm font-medium text-[#0f6b4c]">View quotation</Link> : null}
        </section>
      ) : null}

      {completed && projectAssets.length ? (
        <section className="mt-4 rounded-3xl bg-white p-5">
          <h2 className="text-lg font-semibold">My system</h2>
          <ul className="mt-3 space-y-2">
            {projectAssets.map((asset) => (
              <li key={asset.id}><Link href={`/portal/assets/${asset.id}`} className="font-medium text-[#0f6b4c]">{asset.name}</Link></li>
            ))}
          </ul>
        </section>
      ) : null}

      {identity.settings.portalAiEnabled ? <div className="mt-4"><AskSegmiq portal projectId={project.id as string} /></div> : null}

      {identity.settings.allowSupport ? (
        <section className="mt-4 rounded-3xl bg-white p-5">
          <h2 className="text-lg font-semibold">Get support</h2>
          <div className="mt-3"><SupportForm projectId={project.id as string} assets={assets.map((asset) => ({ id: asset.id as string, name: asset.name as string }))} /></div>
          {identity.whatsappHref ? <a href={identity.whatsappHref} className="mt-3 inline-block text-sm font-medium text-[#0f6b4c]">Continue on WhatsApp</a> : null}
        </section>
      ) : null}

      {identity.settings.allowUpgradeRequests ? (
        <section className="mt-4 rounded-3xl bg-white p-5">
          <h2 className="text-lg font-semibold">Request an upgrade</h2>
          <div className="mt-3"><UpgradeForm projectId={project.id as string} /></div>
        </section>
      ) : null}
    </PortalFrame>
  );
}
