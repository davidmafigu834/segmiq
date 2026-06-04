import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, ShieldCheck, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

function getMetadataBase(): URL {
  const raw = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "https://segmiq.com";
  const base = raw.startsWith("http") ? raw : `https://${raw}`;
  return new URL(base);
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string; packageSlug: string };
}): Promise<Metadata> {
  const metadataBase = getMetadataBase();
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("client_profiles")
    .select("client_id, clients(name)")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!profile) return { title: "Segmiq", metadataBase };

  const clientId = profile.client_id as string;
  const client = profile.clients as unknown as { name: string } | null;
  if (!client) return { title: "Segmiq", metadataBase };

  const { data: pkg } = await supabase
    .from("pricing_packages")
    .select("name, tagline")
    .eq("client_id", clientId)
    .eq("slug", params.packageSlug)
    .eq("is_public", true)
    .maybeSingle();

  if (!pkg) return { title: "Segmiq", metadataBase };

  const title = `${pkg.name as string} — ${client.name}`;
  const description = (pkg.tagline as string | null) ?? "Pricing and what's included.";

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

type ClientRow = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
};

type PackageRow = {
  id: string;
  name: string;
  tagline: string | null;
  currency: string;
  price_from: number | null;
  price_label: string | null;
  price_note: string | null;
  includes: string[] | null;
};

type ProjectMedia = { public_url: string; display_order: number };
type Project = {
  id: string;
  title: string;
  project_media: ProjectMedia[];
};

type Testimonial = {
  id: string;
  author_name: string;
  author_role: string | null;
  content: string;
  rating: number | null;
};

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatMainPrice(pkg: PackageRow): string | null {
  if (pkg.price_label) return pkg.price_label;
  if (pkg.price_from != null) {
    return `${pkg.currency} ${Number(pkg.price_from).toLocaleString()}`;
  }
  return null;
}

export default async function PublicPackagePage({
  params,
}: {
  params: { slug: string; packageSlug: string };
}) {
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
  const contactHref = `/p/${params.slug}?pkg=${encodeURIComponent(params.packageSlug)}#contact`;

  const { data: pkg } = await supabase
    .from("pricing_packages")
    .select("id, name, tagline, currency, price_from, price_label, price_note, includes")
    .eq("client_id", clientId)
    .eq("slug", params.packageSlug)
    .eq("is_public", true)
    .maybeSingle();

  if (!pkg) notFound();

  const typedPkg = pkg as PackageRow;
  const mainPrice = formatMainPrice(typedPkg);
  const includeItems = (typedPkg.includes ?? []).filter((line) => line.trim() !== "");

  const [{ data: projects }, { data: testimonials }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, project_media(public_url, display_order)")
      .eq("client_id", clientId)
      .eq("is_featured", true)
      .eq("is_public", true)
      .order("display_order", { ascending: true })
      .limit(3),
    supabase
      .from("testimonials")
      .select("id, author_name, author_role, content, rating")
      .eq("client_id", clientId)
      .order("display_order", { ascending: true })
      .limit(1),
  ]);

  const galleryProjects = ((projects ?? []) as unknown as Project[]).map((project) => {
    const sorted = [...(project.project_media ?? [])].sort((a, b) => a.display_order - b.display_order);
    return { id: project.id, title: project.title, thumbnail: sorted[0]?.public_url ?? null };
  });

  const testimonial = ((testimonials ?? []) as unknown as Testimonial[])[0] ?? null;

  return (
    <div
      className="min-h-screen bg-[var(--fw-canvas)] [font-family:var(--fw-font-body)] text-[var(--fw-text-primary)]"
      style={{ ["--brand" as string]: brandColor }}
    >
      {/* Header */}
      <header className="border-b border-[var(--fw-border)] bg-[var(--fw-card)]">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-5 py-5 sm:px-8">
          {client.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.logo_url}
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

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        {/* Hero */}
        <section className="mb-12">
          <div className="mb-4 flex items-center gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand)]">
              Pricing package
            </p>
            <span className="h-px w-8 bg-[var(--brand)]" aria-hidden />
          </div>
          <h1 className="mb-3 [font-family:var(--fw-font-display)] text-[clamp(28px,6vw,40px)] leading-[1.1] tracking-[-0.01em]">
            {typedPkg.name}
          </h1>
          {typedPkg.tagline && (
            <p className="mb-8 max-w-xl text-base leading-relaxed text-[var(--fw-text-tertiary)]">
              {typedPkg.tagline}
            </p>
          )}
          {mainPrice && (
            <p className="mb-1 [font-family:var(--fw-font-display)] text-4xl text-[var(--brand)]">
              {mainPrice}
            </p>
          )}
          {typedPkg.price_note && (
            <p className="mb-8 text-sm text-[var(--fw-text-tertiary)]">{typedPkg.price_note}</p>
          )}
          {!typedPkg.price_note && mainPrice && <div className="mb-8" />}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={contactHref}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-6 text-sm font-bold text-[var(--fw-text-primary)] no-underline transition-opacity hover:opacity-90"
            >
              Request this package
              <ArrowRight size={16} aria-hidden />
            </Link>
            {/* TODO Increment 3: pre-fill package context + notify rep + lead event */}
            <Link
              href={contactHref}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[var(--fw-border)] bg-[var(--fw-card)] px-6 text-sm font-bold text-[var(--fw-text-primary)] no-underline transition-colors hover:border-[var(--fw-border-strong)]"
            >
              Request this package
            </Link>
          </div>
        </section>

        {/* What's included */}
        {includeItems.length > 0 && (
          <section className="mb-12 rounded-2xl border border-[var(--fw-border)] bg-[var(--fw-card)] p-6 sm:p-8">
            <h2 className="mb-6 [font-family:var(--fw-font-display)] text-2xl">What&apos;s included</h2>
            <ul className="space-y-4">
              {includeItems.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[15px] leading-snug">
                  <Check size={18} className="mt-0.5 shrink-0 text-[var(--brand)]" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Recent installations */}
        {galleryProjects.length > 0 && (
          <section className="mb-12">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--fw-text-tertiary)]">
              Recent installations
            </p>
            <h2 className="mb-6 [font-family:var(--fw-font-display)] text-2xl">Projects we&apos;re proud of</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {galleryProjects.map((project) => (
                <div
                  key={project.id}
                  className="overflow-hidden rounded-2xl border border-[var(--fw-border)] bg-[var(--fw-card)]"
                >
                  <div className="aspect-[4/3] bg-[var(--fw-sunken)]">
                    {project.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={project.thumbnail}
                        alt={project.title}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <p className="px-4 py-3 text-sm font-semibold">{project.title}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Testimonial */}
        {testimonial && (
          <section className="mb-12 rounded-2xl border border-[var(--fw-border)] bg-[var(--fw-card)] p-6 sm:p-8">
            {testimonial.rating != null && testimonial.rating > 0 && (
              <p className="mb-3 text-sm text-[var(--fw-text-tertiary)]" aria-label={`${testimonial.rating} out of 5 stars`}>
                {"★".repeat(testimonial.rating)}
              </p>
            )}
            <blockquote className="mb-6 text-[15px] italic leading-relaxed">
              &ldquo;{testimonial.content}&rdquo;
            </blockquote>
            <footer>
              <p className="text-sm font-semibold">{testimonial.author_name}</p>
              {testimonial.author_role && (
                <p className="text-xs text-[var(--fw-text-tertiary)]">{testimonial.author_role}</p>
              )}
            </footer>
          </section>
        )}

        {/* Final CTA */}
        <section className="relative overflow-hidden rounded-2xl bg-[var(--fw-soil)] px-6 py-10 sm:px-10 sm:py-12">
          <span
            className="absolute left-0 top-0 h-full w-1 bg-[var(--brand)]"
            aria-hidden
          />
          <h2 className="mb-3 pl-4 [font-family:var(--fw-font-display)] text-[clamp(22px,4vw,30px)] leading-snug text-[var(--fw-card)]">
            Ready to move forward with{" "}
            <span className="text-[var(--brand)]">{typedPkg.name}</span>?
          </h2>
          <p className="mb-8 max-w-md pl-4 text-sm leading-relaxed text-[var(--fw-text-muted)]">
            Tell us about your project and our team will follow up with everything you need.
          </p>
          <div className="pl-4">
            <Link
              href={contactHref}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-6 text-sm font-bold text-[var(--fw-text-primary)] no-underline transition-opacity hover:opacity-90"
            >
              Request this package
              <ArrowRight size={16} aria-hidden />
            </Link>
            {/* TODO Increment 3: pre-fill package context + notify rep + lead event */}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--fw-border)] bg-[var(--fw-card)]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-6 sm:px-8">
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
