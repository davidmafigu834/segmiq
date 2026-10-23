import { Bot, Check, MessageSquare, Users } from "lucide-react";
import { formatUsd, type PricingPresentation } from "@/lib/commercial/presentation";

export function PricingCatalogue({ presentation, admin = false }: { presentation: PricingPresentation; admin?: boolean }) {
  return <div className="space-y-8">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {presentation.packages.map((pkg) => {
        const agentic = pkg.organisationFeeUsdCents > 0;
        return <article key={pkg.id} className={`flex min-h-full flex-col rounded-xl border p-5 ${agentic ? "border-[var(--accent)]/50" : "border-[var(--border)]"} bg-[var(--bg-secondary)]`}>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{pkg.label}</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{pkg.name}</h2>
          <p className="mt-2 min-h-10 text-sm leading-5 text-[var(--text-secondary)]">{pkg.description}</p>
          <div className="mt-5 border-t border-[var(--border)] pt-5">
            <p className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">{formatUsd(pkg.seatPriceUsdCents)}<span className="text-sm font-normal text-[var(--text-tertiary)]"> / user / month</span></p>
            <p className={`mt-1 text-sm ${agentic ? "font-medium text-[var(--accent)]" : "text-[var(--text-tertiary)]"}`}>{agentic ? `+ ${formatUsd(pkg.organisationFeeUsdCents)} / organisation / month` : "No organisation fee"}</p>
          </div>
          <ul className="mt-5 space-y-3 text-sm text-[var(--text-secondary)]">
            <li className="flex gap-2"><Users className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />Active internal users count once</li>
            {pkg.features.map((feature, index) => <li key={feature} className="flex gap-2">{agentic && index < 2 ? <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" /> : agentic && index === 2 ? <Bot className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" /> : <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />}{feature}</li>)}
          </ul>
        </article>;
      })}
    </div>
    <section className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 md:grid-cols-[1fr_auto] md:items-center">
      <div><h2 className="text-base font-semibold text-[var(--text-primary)]">Additional AI usage</h2><p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{presentation.topUpConversations} additional customer AI conversations for {formatUsd(presentation.topUpPriceUsdCents)}. Customer approval is required; excess usage is never charged automatically.</p><p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">{presentation.conversationDefinition}</p></div>
      <div className="rounded-lg bg-[var(--accent)] px-4 py-3 text-center text-[var(--accent-foreground)]"><p className="text-2xl font-semibold">{formatUsd(presentation.topUpPriceUsdCents)}</p><p className="text-xs font-medium">per approved {presentation.topUpConversations}</p></div>
    </section>
    {admin ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-xs text-[var(--text-tertiary)]"><span>Catalogue version {presentation.version}</span><span>Effective {presentation.effectiveFrom} · Published versions are immutable</span></div> : null}
  </div>;
}
