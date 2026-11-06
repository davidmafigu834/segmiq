import Link from "next/link";

const STEPS = {
  sales: [
    { href: "/sales/acquisitions", title: "1. Mandate", detail: "Send the seller form. Approval opens one draft listing." },
    { href: "/sales/listings", title: "2. Viewing", detail: "Open a property and share the viewing form." },
    { href: "/sales/offers", title: "3. Offer", detail: "Create an offer link, then send the signed copy to the seller." },
    { href: "/sales/transactions", title: "4. Sold", detail: "Invite the lawyer from the transaction, then mark it sold." },
  ],
  client: [
    { href: "/client/acquisitions", title: "1. Mandate", detail: "Review the signed mandate and open one draft listing." },
    { href: "/client/listings", title: "2. Viewing", detail: "Open a property and share the viewing form." },
    { href: "/client/offers", title: "3. Offer", detail: "Create an offer link, then send the signed copy to the seller." },
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
