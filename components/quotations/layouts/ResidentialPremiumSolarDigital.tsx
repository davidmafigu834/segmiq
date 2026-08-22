"use client";

import type { ReactNode } from "react";
import {
  BatteryCharging,
  Leaf,
  Mail,
  MapPin,
  Phone,
  Sun,
  User,
  Globe,
  Home,
  Gauge,
} from "lucide-react";
import { formatMoney } from "@/lib/quotations/totals";
import type { QuoteDocumentModel } from "@/lib/quotations/layouts/types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

const METRIC_ICONS = {
  size: Sun,
  gen: BatteryCharging,
  pr: Gauge,
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
  if (!accentWord || !text.toLowerCase().includes(accentWord.toLowerCase())) {
    return <>{text}</>;
  }
  const idx = text.toLowerCase().indexOf(accentWord.toLowerCase());
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: accent }}>{text.slice(idx, idx + accentWord.length)}</span>
      {text.slice(idx + accentWord.length)}
    </>
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
  const logoSrc = model.company.logoUrl || model.company.logoDataUri;
  let running = 0;
  const selected = new Set(selectedOptional ?? []);

  return (
    <article className="overflow-hidden bg-white text-[#1A1A1A]">
      <header className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-7">
        <div className="min-w-0">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt={model.company.name} className="h-9 w-auto max-w-[160px] object-contain" />
          ) : (
            <p className="text-[22px] font-bold tracking-tight">{model.company.name}</p>
          )}
          {model.company.tagline ? (
            <p className="mt-1 text-[11px] text-[#6B6B6B]">{model.company.tagline}</p>
          ) : null}
          {logoSrc ? <p className="mt-1 text-[12px] text-[#6B6B6B]">{model.company.name}</p> : null}
        </div>
        <div className="sm:text-right">
          {model.badge ? (
            <span
              className="inline-block rounded px-2 py-0.5 text-[10px] font-bold tracking-[0.08em]"
              style={{ background: accent, color: "#1A1A1A" }}
            >
              {model.badge}
            </span>
          ) : null}
          <h1 className="mt-1 text-[26px] font-bold tracking-wide">QUOTATION</h1>
          <dl className="mt-1 space-y-0.5 text-[12px]">
            <div className="flex gap-3 sm:justify-end">
              <dt className="text-[#6B6B6B]">Quotation No.</dt>
              <dd className="font-semibold">{model.quote.number}</dd>
            </div>
            {model.quote.version > 1 ? (
              <div className="flex gap-3 sm:justify-end">
                <dt className="text-[#6B6B6B]">Version</dt>
                <dd className="font-semibold">{model.quote.version}</dd>
              </div>
            ) : null}
            <div className="flex gap-3 sm:justify-end">
              <dt className="text-[#6B6B6B]">Date</dt>
              <dd className="font-semibold">{formatDate(model.quote.issuedAt)}</dd>
            </div>
            <div className="flex gap-3 sm:justify-end">
              <dt className="text-[#6B6B6B]">Valid Until</dt>
              <dd className="font-semibold">{formatDate(model.quote.validUntil)}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="relative h-[180px] overflow-hidden sm:h-[220px]" aria-label="Project hero">
        {model.hero.imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={model.hero.imageSrc}
            alt="Residential solar installation"
            className="h-full w-full object-cover object-center"
          />
        ) : (
          <div className="h-full w-full bg-[#2B2B2B]" />
        )}
        <div className="absolute inset-y-0 left-0 flex w-[88%] max-w-md flex-col justify-center bg-gradient-to-r from-black/75 via-black/50 to-transparent px-5 sm:w-[58%] sm:px-7">
          <p className="text-[22px] font-bold leading-tight text-white sm:text-[28px]">
            <Headline text={model.hero.headline} accentWord={model.hero.accentWord} accent={accent} />
          </p>
          {model.hero.subcopy ? (
            <p className="mt-2 max-w-xs text-[12px] leading-5 text-white/85">{model.hero.subcopy}</p>
          ) : null}
        </div>
      </section>

      <div className="grid gap-2 px-4 py-4 sm:grid-cols-3 sm:px-7">
        <InfoCard accent={accent} icon={User} title="Customer Information">
          {model.customer.name ? <p className="font-semibold">{model.customer.name}</p> : null}
          {model.customer.phone ? <p>{model.customer.phone}</p> : null}
          {model.customer.email ? <p>{model.customer.email}</p> : null}
          {model.customer.address ? <p>{model.customer.address}</p> : null}
        </InfoCard>
        {model.site.length > 0 ? (
          <InfoCard accent={accent} icon={Home} title="Site / Property Information">
            {model.site.map((row) => (
              <p key={row.label}>
                <span className="text-[#6B6B6B]">{row.label}: </span>
                {row.value}
              </p>
            ))}
          </InfoCard>
        ) : null}
        {model.projectSummary ? (
          <InfoCard accent={accent} icon={Sun} title="Project Summary">
            <p>{model.projectSummary}</p>
          </InfoCard>
        ) : null}
      </div>

      {model.metrics.length > 0 ? (
        <div className="mx-4 mb-4 grid grid-cols-2 overflow-hidden rounded-[6px] border border-[#E4E4E4] sm:mx-7 sm:grid-cols-4">
          {model.metrics.map((m, i) => {
            const Icon = METRIC_ICONS[m.id as keyof typeof METRIC_ICONS] ?? Sun;
            return (
              <div
                key={m.id}
                className={`px-3 py-3 ${i > 0 ? "border-t border-[#E4E4E4] sm:border-l sm:border-t-0" : ""}`}
              >
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: accent }}>
                  <Icon className="h-3 w-3" aria-hidden />
                  {m.label}
                </p>
                <p className="mt-1 text-[16px] font-bold">{m.value}</p>
                {m.secondary ? <p className="text-[11px] text-[#6B6B6B]">{m.secondary}</p> : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <section className="px-4 sm:px-7" aria-labelledby="scope-heading">
        <div className="bg-[#2A2A2A] px-3 py-2">
          <h2 id="scope-heading" className="text-[12px] font-bold tracking-[0.08em] text-white">
            EQUIPMENT & SCOPE OF SUPPLY
          </h2>
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#E4E4E4] text-[10px] uppercase tracking-wide text-[#6B6B6B]">
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Description</th>
                <th className="px-2 py-2">Brand / Model</th>
                <th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2 text-right">Unit</th>
                <th className="px-2 py-2 text-right">Unit Price</th>
                <th className="px-2 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {model.sections.map((section) => (
                <tbody key={section.title || "main"}>
                  {section.title ? (
                    <tr key={`s-${section.title}`} className="bg-[#F6F6F6]">
                      <td colSpan={7} className="px-2 py-1.5 font-semibold">
                        {section.title}
                      </td>
                    </tr>
                  ) : null}
                  {section.items.map((it) => {
                    running += 1;
                    return (
                      <tr key={it.id ?? `${section.title}-${it.index}`} className="border-b border-[#E4E4E4] align-top">
                        <td className="px-2 py-2 text-[#6B6B6B]">{running}</td>
                        <td className="px-2 py-2">
                          <p className="font-semibold">{it.name}</p>
                          {it.description ? <p className="text-[#6B6B6B]">{it.description}</p> : null}
                        </td>
                        <td className="px-2 py-2 text-[#6B6B6B]">{it.brandModel || ""}</td>
                        <td className="px-2 py-2 text-right">{it.quantity}</td>
                        <td className="px-2 py-2 text-right text-[#6B6B6B]">{it.unit}</td>
                        <td className="px-2 py-2 text-right text-[#6B6B6B]">{formatMoney(it.unitPrice, currency)}</td>
                        <td className="px-2 py-2 text-right font-semibold">{formatMoney(it.amount, currency)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="divide-y divide-[#E4E4E4] sm:hidden">
          {model.sections.flatMap((section) =>
            section.items.map((it, idx) => (
              <li key={`${section.title}-${it.index}`} className="px-1 py-3">
                {section.title && idx === 0 ? (
                  <p className="mb-1 text-[11px] font-bold uppercase text-[#6B6B6B]">{section.title}</p>
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold">{it.name}</p>
                    {it.brandModel ? <p className="text-[12px] text-[#6B6B6B]">{it.brandModel}</p> : null}
                    <p className="text-[12px] text-[#6B6B6B]">
                      {it.quantity} {it.unit} · {formatMoney(it.unitPrice, currency)}
                    </p>
                  </div>
                  <p className="text-[13px] font-semibold">{formatMoney(it.amount, currency)}</p>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      {model.optionalItems.length > 0 ? (
        <section className="px-4 py-4 sm:px-7">
          <h2 className="text-[12px] font-bold tracking-[0.08em] text-[#6B6B6B]">OPTIONAL UPGRADES</h2>
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
                  <p className="text-[13px] font-semibold">+{formatMoney(it.amount, currency)}</p>
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

      <div className="grid gap-2 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4 sm:px-7">
        {model.paymentTerms.length > 0 ? (
          <InfoCard accent={accent} title="Payment Terms">
            {model.paymentTerms.map((p) => (
              <p key={p.label}>
                {p.label}
                {p.detail ? ` — ${p.detail}` : ""}
              </p>
            ))}
          </InfoCard>
        ) : null}
        {model.warranty.length > 0 ? (
          <InfoCard accent={accent} title="Warranty">
            {model.warranty.map((w) => (
              <p key={w.label}>
                {w.label}: {w.detail}
              </p>
            ))}
          </InfoCard>
        ) : null}
        <InfoCard accent={accent} title="Commercial Summary">
          <p>Subtotal {formatMoney(model.commercial.subtotal, currency)}</p>
          {model.commercial.discountTotal > 0 ? (
            <p>Discount {formatMoney(model.commercial.discountTotal, currency)}</p>
          ) : null}
          {model.commercial.taxRate > 0 || model.commercial.taxAmount > 0 ? (
            <p>
              Tax{model.commercial.taxRate ? ` (${model.commercial.taxRate}%)` : ""}{" "}
              {formatMoney(model.commercial.taxAmount, currency)}
            </p>
          ) : null}
        </InfoCard>
        <div className="rounded-[6px] border-[1.5px] p-3" style={{ borderColor: accent }}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#6B6B6B]">
            Total amount ({currency})
          </p>
          <p className="mt-1 break-words text-[22px] font-bold leading-tight" style={{ color: accent }}>
            {formatMoney(model.commercial.total, currency)}
          </p>
          {model.commercial.amountInWords ? (
            <p className="mt-1 text-[11px] text-[#6B6B6B]">{model.commercial.amountInWords}</p>
          ) : null}
        </div>
      </div>

      {model.showAcceptance && !hidePrintAcceptance ? (
        <div className="grid gap-6 px-4 pb-4 sm:grid-cols-2 sm:px-7">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: accent }}>
              Accepted by
            </p>
            <p className="mt-2 text-[12px] text-[#6B6B6B]">Use Accept quotation below to record your response.</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: accent }}>
              Authorised signatory
            </p>
            {model.company.signatureDataUri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={model.company.signatureDataUri} alt="" className="mt-2 h-10 w-auto object-contain" />
            ) : null}
            <p className="mt-2 text-[12px] text-[#6B6B6B]">
              {[model.company.signatoryName, model.company.signatoryRole, model.company.name].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      ) : null}

      {model.terms ? (
        <details className="px-4 pb-4 sm:px-7">
          <summary className="cursor-pointer text-[13px] font-semibold">Terms</summary>
          <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-6 text-[#3f3f46]">{model.terms}</p>
        </details>
      ) : null}

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#E4E4E4] px-4 py-3 text-[11px] text-[#6B6B6B] sm:px-7">
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
    <section className="rounded-[6px] border border-[#E4E4E4] p-3 text-[12px] leading-5">
      <h2 className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: accent }}>
        {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
        {title}
      </h2>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}
