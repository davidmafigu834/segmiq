import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, ShieldCheck, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

type ClientRow = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
};

type PackageRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tagline: string | null;
  currency: string;
  price_from: number | null;
  price_label: string | null;
  price_note: string | null;
  includes: string[] | null;
  is_featured: boolean;
  display_order: number;
};

function getMetadataBase(): URL {
  const raw = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "https://segmiq.com";
  const base = raw.startsWith("http") ? raw : `https://${raw}`;
  return new URL(base);
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function hasAbsoluteLogo(logoUrl: string | null | undefined): logoUrl is string {
  return typeof logoUrl === "string" && /^https?:\/\//.test(logoUrl);
}

function formatMainPrice(pkg: PackageRow): string | null {
  if (pkg.price_label) return pkg.price_label;
  if (pkg.price_from != null) {
    return `${pkg.currency} ${Number(pkg.price_from).toLocaleString()}`;
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const metadataBase = getMetadataBase();
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("client_profiles")
    .select("client_id, clients(name)")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!profile) return { title: "Segmiq", metadataBase };

  const client = profile.clients as unknown as { name: string } | null;
  if (!client) return { title: "Segmiq", metadataBase };

  const title = `Pricing — ${client.name}`;
  const description = "Browse our pricing packages and request a quote.";

  return {
    metadataBase,
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
  };
}

export default async function PublicPackagesPage({ params }: { params: { slug: string } }) {
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("client_profiles")
    .select("client_id, clients(id, name, logo_url, primary_color)")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!profile) notFound();

  const clientId = profile.client_id as string;
  const client = profile.clients as unknown as ClientRow | null;
  if (!client) notFound();

  const clientName = client.name;
  const brandColor = client.primary_color ?? "#0F7A4F";
  const showLogo = hasAbsoluteLogo(client.logo_url);

  const { data: packages } = await supabase
    .from("pricing_packages")
    .select(
      "id, slug, name, description, tagline, currency, price_from, price_label, price_note, includes, is_featured, display_order"
    )
    .eq("client_id", clientId)
    .eq("is_public", true)
    .eq("is_active", true)
    .not("slug", "is", null)
    .order("display_order", { ascending: true });

  const typedPackages = (packages ?? []) as PackageRow[];
  if (typedPackages.length === 0) notFound();

  const generalContactHref = `/p/${params.slug}#contact`;

  return (
    <div
      className="min-h-screen bg-[var(--fw-canvas)] [font-family:var(--fw-font-body)] text-[var(--fw-text-primary)]"
      style={{ ["--brand" as string]: brandColor }}
    >
      {/* Header */}
      <header className="border-b border-[var(--fw-border)] bg-[var(--fw-card)]">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-5 sm:px-8">
          {showLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.logo_url!}
              alt={clientName}
              className="h-12 w-12 shrink-0 rounded-xl object-contain"
            />
          ) : (
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--fw-soil)] text-sm font-bold text-[var(--fw-card)]"
              aria-hidden
            >
              {getInitials(clientName)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate [font-family:var(--fw-font-display)] text-xl leading-tight">
              {clientName}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--fw-text-tertiary)]">
              <ShieldCheck size={14} className="shrink-0 text-[var(--brand)]" aria-hidden />
              Verified business
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        {/* Hero */}
        <section className="mb-12">
          <div className="mb-4 flex items-center gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand)]">
              Pricing
            </p>
            <span className="h-px w-8 bg-[var(--brand)]" aria-hidden />
          </div>
          <h1 className="mb-3 [font-family:var(--fw-font-display)] text-[clamp(28px,5vw,42px)] leading-[1.1] tracking-[-0.01em]">
            Our packages
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-[var(--fw-text-tertiary)]">
            Compare what&apos;s included and choose the option that fits your project. Request a
            package and our team will follow up with everything you need.
          </p>
        </section>

        {/* Package list */}
        <section className="space-y-6">
          {typedPackages.map((pkg) => {
            const subline = (pkg.tagline ?? pkg.description)?.trim() || null;
            const includeItems = (pkg.includes ?? [])
              .filter((line) => line.trim() !== "")
              .slice(0, 6);
            const mainPrice = formatMainPrice(pkg);
            const requestHref = `/p/${params.slug}?pkg=${encodeURIComponent(pkg.slug)}#contact`;
            const detailHref = `/p/${params.slug}/p/${encodeURIComponent(pkg.slug)}`;
            const featured = pkg.is_featured;

            return (
              <article
                key={pkg.id}
                className={
                  featured
                    ? "relative overflow-hidden rounded-2xl border border-[var(--fw-border)] bg-[color-mix(in_srgb,var(--brand)_6%,var(--fw-card))] pl-4 shadow-sm"
                    : "overflow-hidden rounded-2xl border border-[var(--fw-border)] bg-[var(--fw-card)]"
                }
              >
                {featured && (
                  <span
                    className="absolute left-0 top-0 h-full w-1 bg-[var(--brand)]"
                    aria-hidden
                  />
                )}
                <div className="flex flex-col gap-8 p-6 sm:p-8 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 lg:max-w-[58%]">
                    {featured && (
                      <span className="mb-3 inline-block rounded-full bg-[var(--brand)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--fw-text-primary)]">
                        Most popular
                      </span>
                    )}
                    <h2 className="mb-2 [font-family:var(--fw-font-display)] text-2xl leading-tight sm:text-[28px]">
                      {pkg.name}
                    </h2>
                    {subline && (
                      <p className="mb-5 text-[15px] leading-relaxed text-[var(--fw-text-tertiary)]">
                        {subline}
                      </p>
                    )}
                    {includeItems.length > 0 && (
                      <ul className="space-y-2.5">
                        {includeItems.map((item) => (
                          <li key={item} className="flex items-start gap-2.5 text-sm leading-snug">
                            <Check
                              size={16}
                              className="mt-0.5 shrink-0 text-[var(--brand)]"
                              aria-hidden
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[min(100%,280px)] lg:items-stretch">
                    {mainPrice && (
                      <p className="[font-family:var(--fw-font-display)] text-3xl text-[var(--brand)] sm:text-4xl">
                        {mainPrice}
                      </p>
                    )}
                    {pkg.price_note && (
                      <p className="-mt-2 text-sm text-[var(--fw-text-tertiary)]">{pkg.price_note}</p>
                    )}
                    <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                      <Link
                        href={requestHref}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-bold text-[var(--fw-text-primary)] no-underline transition-opacity hover:opacity-90"
                      >
                        Request this package
                        <ArrowRight size={15} aria-hidden />
                      </Link>
                      <Link
                        href={detailHref}
                        className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--fw-border)] bg-transparent px-5 text-sm font-bold text-[var(--fw-text-primary)] no-underline transition-colors hover:border-[var(--fw-border-strong)]"
                      >
                        View details
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        {/* Final CTA */}
        <section className="relative mt-14 overflow-hidden rounded-2xl bg-[var(--fw-soil)] px-6 py-10 sm:px-10 sm:py-12">
          <span className="absolute left-0 top-0 h-full w-1 bg-[var(--brand)]" aria-hidden />
          <h2 className="mb-3 pl-4 [font-family:var(--fw-font-display)] text-[clamp(22px,4vw,30px)] leading-snug text-[var(--fw-card)]">
            Not sure which package is{" "}
            <span className="text-[var(--brand)]">right for you</span>?
          </h2>
          <p className="mb-8 max-w-lg pl-4 text-sm leading-relaxed text-[var(--fw-text-muted)]">
            Tell us about your project and we&apos;ll help you choose the best option.
          </p>
          <div className="pl-4">
            <Link
              href={generalContactHref}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-6 text-sm font-bold text-[var(--fw-text-primary)] no-underline transition-opacity hover:opacity-90"
            >
              Help me choose
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--fw-border)] bg-[var(--fw-card)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6 sm:px-8">
          <p className="text-sm text-[var(--fw-text-tertiary)]">{clientName}</p>
          <p className="flex items-center gap-2 text-xs text-[var(--fw-text-tertiary)]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--fw-lime)]" aria-hidden />
            Powered by{" "}
            <a
              href="https://leadstaq.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--fw-text-primary)] no-underline hover:underline"
            >
              Segmiq
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
