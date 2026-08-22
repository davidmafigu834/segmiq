"use client";

import type { ReactNode } from "react";
import { Fragment } from "react";
import {
  BarChart3,
  Leaf,
  Mail,
  MapPin,
  Phone,
  Sun,
  User,
  Globe,
  LayoutGrid,
  Zap,
  CreditCard,
  Shield,
  FileText,
} from "lucide-react";
import { formatMoneyCompact } from "@/lib/quotations/totals";
import type { QuoteDocumentModel } from "@/lib/quotations/layouts/types";
import { signatoryParts, splitHeroLines, termsNeedOwnPage } from "@/lib/quotations/layouts/map-fields";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

const METRIC_ICONS = {
  size: LayoutGrid,
  gen: Zap,
  pr: BarChart3,
  co2: Leaf,
} as const;

function Headline({
  text,
  accentWord,
  accent,
}: {
  text: string;
  accentWord: string | null;
  accent: string;
}) {
  const lines = splitHeroLines(text);
  const accentLc = (accentWord || "").trim().toLowerCase();
  return (
    <>
      {lines.map((line) => {
        const emphasised = Boolean(accentLc) && line.toLowerCase().includes(accentLc);
        return (
          <span key={line} className="block" style={emphasised ? { color: accent } : undefined}>
            {line}
          </span>
        );
      })}
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-[12px] leading-5">
      <span className="w-[38%] shrink-0 text-[#6B6B6B]">{label}</span>
      <span className="min-w-0 font-semibold">{value}</span>
    </div>
  );
}

export function ResidentialPremiumSolarDigital({
  model,
  interactiveOptional,
  selectedOptional,
  onToggleOptional,
  hidePrintAcceptance,
}: {
  model: QuoteDocumentModel;
  interactiveOptional?: boolean;
  selectedOptional?: string[];
  onToggleOptional?: (key: string) => void;
  hidePrintAcceptance?: boolean;
}) {
  const accent = model.accent;
  const currency = model.quote.currency;
  const money = (n: number) => formatMoneyCompact(n, currency);
  const logoSrc = model.company.logoUrl || model.company.logoDataUri;
  const signatory = signatoryParts(model.company);
  const longTerms = termsNeedOwnPage(model.terms);
  let running = 0;
  const selected = new Set(selectedOptional ?? []);
  const hasCustomer = Boolean(
    model.customer.name || model.customer.phone || model.customer.email || model.customer.address
  );
  const infoCount = [hasCustomer, model.site.length > 0, Boolean(model.projectSummary)].filter(Boolean).length;
  const infoGrid =
    infoCount === 3 ? "sm:grid-cols-3" : infoCount === 2 ? "sm:grid-cols-2" : "sm:grid-cols-1";
  const emptyScope = model.sections.length === 0 || model.sections.every((s) => s.items.length === 0);

  return (
    <article className="overflow-hidden bg-white text-[#1A1A1A]">
      <header className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:px-7">
        <div className="min-w-0 sm:w-1/2">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt={model.company.name} className="h-8 w-auto max-w-[160px] object-contain object-left" />
          ) : (
            <div>
              <p className="text-[20px] font-bold tracking-wide">{model.company.name}</p>
              <span className="mt-1 block h-[2px] w-7" style={{ background: accent }} />
            </div>
          )}
          {model.company.tagline ? (
            <p className="mt-1 text-[11px] text-[#6B6B6B]">{model.company.tagline}</p>
          ) : null}
        </div>
        <div className="hidden pt-3 text-center sm:block sm:w-1/4">
          <h1 className="text-[20px] font-bold tracking-[0.08em]">QUOTATION</h1>
        </div>
        <div className="sm:w-1/4 sm:text-right">
          {model.badge ? (
            <span
              className="inline-block rounded-[2px] px-1.5 py-0.5 text-[9px] font-bold tracking-[0.08em]"
              style={{ background: accent, color: "#1A1A1A" }}
            >
              {model.badge}
            </span>
          ) : null}
          <h1 className="mt-1 text-[20px] font-bold tracking-[0.08em] sm:hidden">QUOTATION</h1>
          <dl className="mt-1 space-y-0.5 text-[11px]">
            <div className="flex gap-2 sm:justify-end">
              <dt className="text-[#6B6B6B]">Quotation No.</dt>
              <dd className="font-semibold">{model.quote.number}</dd>
            </div>
            {model.quote.version > 1 ? (
              <div className="flex gap-2 sm:justify-end">
                <dt className="text-[#6B6B6B]">Version</dt>
                <dd className="font-semibold">{model.quote.version}</dd>
              </div>
            ) : null}
            <div className="flex gap-2 sm:justify-end">
              <dt className="text-[#6B6B6B]">Date</dt>
              <dd className="font-semibold">{formatDate(model.quote.issuedAt)}</dd>
            </div>
            <div className="flex gap-2 sm:justify-end">
              <dt className="text-[#6B6B6B]">Valid Until</dt>
              <dd className="font-semibold">{formatDate(model.quote.validUntil)}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="relative h-[168px] overflow-hidden sm:h-[200px]" aria-label="Project hero">
        {model.hero.imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={model.hero.imageSrc}
            alt="Residential solar installation"
            className="h-full w-full object-cover object-[78%_42%]"
          />
        ) : (
          <div className="h-full w-full bg-[#2B2B2B]" />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 38%, rgba(0,0,0,0.08) 72%, rgba(0,0,0,0) 100%)",
          }}
        />
        <div className="absolute inset-y-0 left-0 flex w-[70%] max-w-md flex-col justify-center px-5 sm:w-[48%] sm:px-7">
          <p className="text-[22px] font-bold leading-[1.15] text-white sm:text-[26px]">
            <Headline text={model.hero.headline} accentWord={model.hero.accentWord} accent={accent} />
          </p>
          <span className="mt-2 block h-[2px] w-8" style={{ background: accent }} />
          {model.hero.subcopy ? (
            <p className="mt-2 max-w-[220px] text-[11px] leading-4 text-white/90">{model.hero.subcopy}</p>
          ) : null}
        </div>
      </section>

      {infoCount > 0 ? (
        <div className={`grid gap-2 px-4 py-3 sm:px-7 ${infoGrid}`}>
          {hasCustomer ? (
            <InfoCard accent={accent} icon={User} title="Customer Information">
              {model.customer.name ? <Field label="Name" value={model.customer.name} /> : null}
              {model.customer.phone ? <Field label="Phone" value={model.customer.phone} /> : null}
              {model.customer.email ? <Field label="Email" value={model.customer.email} /> : null}
              {model.customer.address ? <Field label="Address" value={model.customer.address} /> : null}
            </InfoCard>
          ) : null}
          {model.site.length > 0 ? (
            <InfoCard accent={accent} icon={MapPin} title="Site / Property Information">
              {model.site.slice(0, 8).map((row) => (
                <Field key={row.label} label={row.label} value={row.value} />
              ))}
            </InfoCard>
          ) : null}
          {model.projectSummary ? (
            <InfoCard accent={accent} icon={Sun} title="Project Summary">
              <p>{model.projectSummary}</p>
            </InfoCard>
          ) : null}
        </div>
      ) : null}

      {model.metrics.length > 0 ? (
        <div
          className={`mx-4 mb-3 grid grid-cols-2 border-y border-[#E4E4E4] sm:mx-7 ${
            model.metrics.length >= 4
              ? "sm:grid-cols-4"
              : model.metrics.length === 3
                ? "sm:grid-cols-3"
                : "sm:grid-cols-2"
          }`}
        >
          {model.metrics.map((m, i) => {
            const Icon = METRIC_ICONS[m.id as keyof typeof METRIC_ICONS] ?? Sun;
            return (
              <div key={m.id} className={`px-3 py-2.5 ${i > 0 ? "border-l border-[#E4E4E4]" : ""}`}>
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: accent }}>
                  <Icon className="h-3 w-3" aria-hidden />
                  {m.label}
                </p>
                <p className="mt-0.5 text-[15px] font-bold">{m.value}</p>
                {m.secondary ? <p className="text-[11px] text-[#6B6B6B]">{m.secondary}</p> : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <section className="px-4 sm:px-7" aria-labelledby="scope-heading">
        <div className="bg-[#2A2A2A] px-3 py-1.5">
          <h2 id="scope-heading" className="text-[11px] font-bold tracking-[0.1em] text-white">
            EQUIPMENT & SCOPE OF SUPPLY
          </h2>
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full table-fixed text-left text-[12px]">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[26%]" />
              <col className="w-[20%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[16%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-[#E4E4E4] text-[10px] uppercase tracking-wide text-[#6B6B6B]">
                <th className="px-2 py-1.5">#</th>
                <th className="px-2 py-1.5">Description</th>
                <th className="px-2 py-1.5">Brand / Model</th>
                <th className="px-2 py-1.5 text-right">Qty</th>
                <th className="px-2 py-1.5 text-right">Unit</th>
                <th className="px-2 py-1.5 text-right">Unit Price</th>
                <th className="px-2 py-1.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {emptyScope ? (
                <tr>
                  <td colSpan={7} className="px-2 py-3 text-[#6B6B6B]">
                    No equipment listed yet.
                  </td>
                </tr>
              ) : (
                model.sections.map((section) => (
                  <Fragment key={section.title || "main"}>
                    {section.title ? (
                      <tr className="bg-[#F4F4F4]">
                        <td colSpan={7} className="px-2 py-1 text-[11px] font-semibold uppercase">
                          {section.title}
                        </td>
                      </tr>
                    ) : null}
                    {section.items.map((it) => {
                      running += 1;
                      return (
                        <tr key={it.id ?? `${section.title}-${it.index}`} className="border-b border-[#E4E4E4] align-top">
                          <td className="px-2 py-1.5 text-[#6B6B6B]">{running}</td>
                          <td className="px-2 py-1.5">
                            <p className="font-semibold">{it.name}</p>
                            {it.description ? <p className="text-[11px] text-[#6B6B6B]">{it.description}</p> : null}
                          </td>
                          <td className="px-2 py-1.5 text-[#6B6B6B]">{it.brandModel || ""}</td>
                          <td className="px-2 py-1.5 text-right">{it.quantity}</td>
                          <td className="px-2 py-1.5 text-right text-[#6B6B6B]">{it.unit}</td>
                          <td className="px-2 py-1.5 text-right text-[#6B6B6B]">{money(it.unitPrice)}</td>
                          <td className="px-2 py-1.5 text-right font-semibold">{money(it.amount)}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
        <ul className="divide-y divide-[#E4E4E4] sm:hidden">
          {emptyScope ? <li className="px-1 py-3 text-[12px] text-[#6B6B6B]">No equipment listed yet.</li> : null}
          {model.sections.flatMap((section) =>
            section.items.map((it, idx) => (
              <li key={`${section.title}-${it.index}`} className="px-1 py-2.5">
                {section.title && idx === 0 ? (
                  <p className="mb-1 text-[11px] font-bold uppercase text-[#6B6B6B]">{section.title}</p>
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold">{it.name}</p>
                    {it.brandModel ? <p className="text-[12px] text-[#6B6B6B]">{it.brandModel}</p> : null}
                    <p className="text-[12px] text-[#6B6B6B]">
                      {it.quantity} {it.unit} · {money(it.unitPrice)}
                    </p>
                  </div>
                  <p className="text-[13px] font-semibold">{money(it.amount)}</p>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      {model.optionalItems.length > 0 ? (
        <section className="px-4 py-3 sm:px-7">
          <h2 className="text-[11px] font-bold tracking-[0.08em] text-[#6B6B6B]">OPTIONAL UPGRADES</h2>
          <ul className="mt-2 space-y-2">
            {model.optionalItems.map((it) => {
              const key = it.id ?? `${it.index}-${it.name}`;
              const on = selected.has(key);
              const inner = (
                <div className="flex items-start justify-between gap-3 rounded-[6px] border border-[#E4E4E4] px-3 py-2">
                  <div>
                    <p className="text-[13px] font-semibold">{it.name}</p>
                    <p className="text-[12px] text-[#6B6B6B]">Optional</p>
                  </div>
                  <p className="text-[13px] font-semibold">+{money(it.amount)}</p>
                </div>
              );
              if (!interactiveOptional || !onToggleOptional) return <li key={key}>{inner}</li>;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => onToggleOptional(key)}
                    className={`w-full text-left ${on ? "ring-1 ring-[#1A1A1A]" : ""}`}
                  >
                    {inner}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div
        className={`grid gap-2 px-4 py-3 sm:px-7 ${
          model.paymentTerms.length > 0 && model.warranty.length > 0
            ? "sm:grid-cols-2 lg:grid-cols-[23fr_23fr_23fr_31fr]"
            : "sm:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {model.paymentTerms.length > 0 ? (
          <InfoCard accent={accent} icon={CreditCard} title="Payment Terms">
            {model.paymentTerms.map((p) => (
              <div key={p.label} className="flex justify-between gap-2">
                <span className="font-semibold">
                  {p.label}
                  {p.amountLabel ? ` (${p.amountLabel})` : ""}
                </span>
                <span className="text-[#6B6B6B]">{p.detail || ""}</span>
              </div>
            ))}
          </InfoCard>
        ) : null}
        {model.warranty.length > 0 ? (
          <InfoCard accent={accent} icon={Shield} title="Warranty">
            {model.warranty.map((w) => (
              <div key={w.label} className="flex justify-between gap-2">
                <span className="text-[#6B6B6B]">{w.label}</span>
                <span className="font-semibold">{w.detail}</span>
              </div>
            ))}
          </InfoCard>
        ) : null}
        <InfoCard accent={accent} icon={FileText} title="Commercial Summary">
          <div className="flex justify-between">
            <span className="text-[#6B6B6B]">Subtotal</span>
            <span className="font-semibold">{money(model.commercial.subtotal)}</span>
          </div>
          {model.commercial.discountTotal > 0 ? (
            <div className="flex justify-between">
              <span className="text-[#6B6B6B]">Discount</span>
              <span className="font-semibold">{money(model.commercial.discountTotal)}</span>
            </div>
          ) : null}
          {model.commercial.taxRate > 0 || model.commercial.taxAmount > 0 ? (
            <div className="flex justify-between">
              <span className="text-[#6B6B6B]">
                Tax{model.commercial.taxRate ? ` (${model.commercial.taxRate}%)` : ""}
              </span>
              <span className="font-semibold">{money(model.commercial.taxAmount)}</span>
            </div>
          ) : null}
        </InfoCard>
        <div className="rounded-[6px] border-[1.5px] px-3 py-2.5" style={{ borderColor: accent }}>
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: accent }}>
            Total amount ({currency})
          </p>
          <p className="mt-1 break-words text-[22px] font-bold leading-tight tabular-nums" style={{ color: accent }}>
            {money(model.commercial.total)}
          </p>
          {model.commercial.amountInWords ? (
            <p className="mt-1 text-[11px] text-[#6B6B6B]">({model.commercial.amountInWords})</p>
          ) : null}
        </div>
      </div>

      {model.showAcceptance && !hidePrintAcceptance ? (
        <div className="grid gap-6 px-4 pb-3 sm:grid-cols-2 sm:px-7">
          <div>
            <p className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: accent }}>
              <User className="h-3 w-3" aria-hidden />
              Accepted by
            </p>
            <AcceptanceLine label="Name" />
            <AcceptanceLine label="Designation" />
            <AcceptanceLine label="Date" />
            <p className="mt-2 text-[11px] text-[#6B6B6B]">Signature & Seal</p>
            <div className="mt-1 h-9 rounded-[3px] border border-[#E4E4E4]" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: accent }}>
              Authorised signatory
            </p>
            {model.company.signatureDataUri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={model.company.signatureDataUri} alt="" className="mt-2 h-10 w-auto object-contain" />
            ) : (
              <div className="mt-6 border-b border-[#E4E4E4]" />
            )}
            <p className="mt-2 text-[12px] font-semibold">{signatory.name}</p>
            {signatory.role ? <p className="text-[12px] text-[#6B6B6B]">{signatory.role}</p> : null}
            <p className="text-[12px] text-[#6B6B6B]">{signatory.company}</p>
          </div>
        </div>
      ) : null}

      {model.terms ? (
        longTerms ? (
          <section className="border-t border-[#E4E4E4] px-4 py-4 sm:px-7">
            <h2 className="text-[11px] font-bold uppercase tracking-wide" style={{ color: accent }}>
              Terms &amp; conditions
            </h2>
            <div className="mt-2 space-y-2 whitespace-pre-wrap text-[12.5px] leading-6 text-[#3f3f46]">
              {model.terms}
            </div>
          </section>
        ) : (
          <section className="mx-4 mb-3 rounded-[6px] border border-[#E4E4E4] p-3 sm:mx-7">
            <h2 className="text-[10px] font-bold uppercase tracking-wide" style={{ color: accent }}>
              Terms
            </h2>
            <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-5 text-[#3f3f46]">{model.terms}</p>
          </section>
        )
      ) : null}

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#E4E4E4] px-4 py-2.5 text-[11px] text-[#6B6B6B] sm:px-7">
        {model.footerContacts.map((c) => (
          <span key={`${c.kind}-${c.value}`} className="inline-flex items-center gap-1">
            {c.kind === "phone" ? <Phone className="h-3 w-3" aria-hidden /> : null}
            {c.kind === "email" ? <Mail className="h-3 w-3" aria-hidden /> : null}
            {c.kind === "web" ? <Globe className="h-3 w-3" aria-hidden /> : null}
            {c.kind === "address" ? <MapPin className="h-3 w-3" aria-hidden /> : null}
            {c.value}
          </span>
        ))}
        {model.showPoweredBy ? <span className="ml-auto">Powered by SegmiQ</span> : null}
      </footer>
    </article>
  );
}

function AcceptanceLine({ label }: { label: string }) {
  return (
    <div className="mt-1.5 flex items-end gap-2">
      <span className="w-20 text-[11px] text-[#6B6B6B]">{label}</span>
      <span className="h-4 flex-1 border-b border-[#E4E4E4]" />
    </div>
  );
}

function InfoCard({
  accent,
  title,
  icon: Icon,
  children,
}: {
  accent: string;
  title: string;
  icon?: typeof User;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[6px] border border-[#E4E4E4] p-2.5 text-[12px] leading-5">
      <h2 className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: accent }}>
        {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
        {title}
      </h2>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}
