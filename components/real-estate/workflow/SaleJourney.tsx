import Link from "next/link";

const STEPS = {
  sales: [
    { href: "/sales/listings/mandate", title: "1. Mandate", detail: "Choose a sole or open mandate, then send the seller the link." },
    { href: "/sales/listings", title: "2. Viewing", detail: "Share the viewing form from the property. A signed form opens the buyer and books the calendar." },
    { href: "/sales/offers", title: "3. Offer", detail: "Generate the offer from the buyer, then send it to the seller to review." },
    { href: "/sales/transactions", title: "4. Sold", detail: "Invite the lawyer from the transaction, then mark it sold." },
  ],
  client: [
    { href: "/client/listings/mandate", title: "1. Mandate", detail: "Choose a sole or open mandate, then send the seller the link." },
    { href: "/client/listings", title: "2. Viewing", detail: "Share the viewing form from the property. A signed form opens the buyer and books the calendar." },
    { href: "/client/offers", title: "3. Offer", detail: "Generate the offer from the buyer, then send it to the seller to review." },
    { href: "/client/transactions", title: "4. Sold", detail: "Invite the lawyer from the transaction, then mark it sold." },
  ],
} as const;

export function SaleJourney({ surface }: { surface: "sales" | "client" }) {
  const steps = STEPS[surface];
  return (
    <section aria-label="Sale workflow" className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-3">
      <h2 className="text-[15px] font-semibold text-sales-text-primary">Sale workflow</h2>
      <p className="mt-1 text-[13px] text-sales-text-secondary">Mandate, viewing, offer, then sold. Each step opens the page where that work is done.</p>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2 layout:grid-cols-4">
        {steps.map((step) => (
          <li key={step.href + step.title}>
            <Link
              href={step.href}
              className="flex h-full min-h-11 flex-col justify-center rounded-[10px] border border-sales-border px-3 py-2 hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
            >
              <span className="text-[13px] font-semibold text-sales-text-primary">{step.title}</span>
              <span className="mt-1 text-[12px] leading-snug text-sales-text-secondary">{step.detail}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
