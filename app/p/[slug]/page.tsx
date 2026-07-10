import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Star } from "lucide-react";
import { ConversationalForm, type ConversationalFormStep } from "@/components/profile/ConversationalForm";
import {
  getBudgetRangeOptions,
  injectOptionalBudgetQuestion,
} from "@/lib/budget-question-presets";

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function hasAbsoluteLogo(logoUrl: string | null | undefined): logoUrl is string {
  return typeof logoUrl === "string" && /^https?:\/\//.test(logoUrl);
}

function formatPackagePrice(pkg: PricingPackage): string {
  if (pkg.price_label) return pkg.price_label;
  if (pkg.price_from != null && pkg.price_to != null) {
    return `${pkg.currency} ${Number(pkg.price_from).toLocaleString()} – ${Number(pkg.price_to).toLocaleString()}`;
  }
  if (pkg.price_from != null) {
    return `From ${pkg.currency} ${Number(pkg.price_from).toLocaleString()}`;
  }
  return "Get a quote";
}

function getProjectCover(project: Project): string | null {
  const sorted = [...project.project_media].sort((a, b) => a.display_order - b.display_order);
  return sorted[0]?.public_url ?? null;
}

function getProjectMeta(project: Project): string | null {
  const parts = [project.location, project.category].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export const dynamic = "force-dynamic";

type ProjectMedia = { public_url: string; display_order: number };
type Project = {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  location: string | null;
  completion_date: string | null;
  description: string | null;
  project_media: ProjectMedia[];
};
type Testimonial = {
  id: string;
  author_name: string;
  author_role: string | null;
  content: string;
  rating: number | null;
  photo_url: string | null;
};
type FormFieldDef = {
  id: string;
  field_type: string;
  label: string;
  placeholder: string | null;
  options: string[] | null;
  is_required: boolean | null;
  maps_to: string | null;
  display_order: number | null;
};
type FormStepDef = { id: string; step_number: number; title: string; form_fields: FormFieldDef[] };
type PricingPackage = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  tagline: string | null;
  price_from: number | null;
  price_to: number | null;
  price_label: string | null;
  currency: string;
  includes: string[] | null;
  is_featured: boolean;
  is_public: boolean;
  valid_until: string | null;
};

const HERO_SCRIM =
  "linear-gradient(to top, rgba(10,9,7,0.86) 0%, rgba(10,9,7,0.45) 42%, rgba(10,9,7,0.12) 72%, rgba(10,9,7,0.30) 100%), linear-gradient(105deg, rgba(10,9,7,0.55) 0%, rgba(10,9,7,0.10) 55%, transparent 80%)";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("client_profiles")
    .select("headline, subheadline, hero_image_url, is_published, clients(name)")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!profile) return { title: "Segmiq" };
  const isPublished = (profile.is_published as boolean | null) ?? false;
  if (!isPublished) {
    return {
      title: "Segmiq",
      robots: { index: false, follow: false },
    };
  }
  const clientName = (profile.clients as { name?: string } | null)?.name ?? "Company";
  const title = (profile.headline as string | null) ?? clientName;
  const description = (profile.subheadline as string | null) ?? undefined;
  const heroImg = profile.hero_image_url as string | null;
  const baseUrl = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "https://leadstaq.tech";
  const pageUrl = `${baseUrl}/p/${params.slug}`;
  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "Segmiq",
      type: "website",
      locale: "en_US",
      images: heroImg ? [{ url: heroImg, alt: title }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: heroImg ? [heroImg] : [],
    },
  };
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { pkg?: string };
}) {
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("client_profiles")
    .select("*, clients(id, name, slug, logo_url, primary_color, industry, country)")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!profile) notFound();

  if (!profile.is_published) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-gray-500">This page is not published yet.</p>
      </div>
    );
  }

  const clientId = profile.client_id as string;
  const client = profile.clients as {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    primary_color: string | null;
    industry: string;
    country: string | null;
  } | null;
  const clientName = client?.name ?? "Company";
  const brandColor = client?.primary_color ?? "#0F7A4F";
  const showLogo = hasAbsoluteLogo(client?.logo_url);
  const headerSubtitle = [client?.industry, client?.country].filter(Boolean).join(" · ");
  const eyebrowText = headerSubtitle;

  const pkgSlug = typeof searchParams.pkg === "string" ? searchParams.pkg.trim() : "";
  let requestedPackage: { id: string; slug: string; name: string } | undefined;
  if (pkgSlug) {
    const { data: pkgRow } = await supabase
      .from("pricing_packages")
      .select("id, slug, name")
      .eq("client_id", clientId)
      .eq("slug", pkgSlug)
      .eq("is_public", true)
      .maybeSingle();
    if (pkgRow?.id && pkgRow.slug && pkgRow.name) {
      requestedPackage = {
        id: pkgRow.id as string,
        slug: pkgRow.slug as string,
        name: pkgRow.name as string,
      };
    }
  }

  const [
    { data: projects },
    { data: testimonials },
    { data: formSteps },
    { data: formSchema },
    { data: packages },
    { data: campaignQualifiers },
    { count: projectCount },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, slug, title, category, location, completion_date, description, project_media(public_url, display_order)")
      .eq("client_id", clientId)
      .eq("is_featured", true)
      .eq("is_public", true)
      .order("display_order", { ascending: true })
      .limit(6),
    supabase
      .from("testimonials")
      .select("id, author_name, author_role, content, rating, photo_url")
      .eq("client_id", clientId)
      .order("display_order", { ascending: true }),
    supabase
      .from("form_steps")
      .select("id, step_number, title, form_fields(id, field_type, label, placeholder, options, is_required, maps_to, display_order)")
      .eq("client_id", clientId)
      .order("step_number", { ascending: true }),
    supabase
      .from("form_schemas")
      .select("form_title, opening_message, budget_question_enabled")
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("pricing_packages")
      .select("*")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("campaign_qualifiers")
      .select("budget_min, budget_max")
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("is_public", true),
  ]);

  const typedProjects = (projects ?? []) as unknown as Project[];
  const typedTestimonials = (testimonials ?? []) as unknown as Testimonial[];
  const typedFormSteps = (formSteps ?? []) as unknown as FormStepDef[];
  const typedPackages = (packages ?? []) as unknown as PricingPackage[];

  const conversationalFormTitle =
    (formSchema?.form_title as string | null) ??
    (profile.form_title as string | null) ??
    "Tell us about your project";
  const conversationalOpeningMessage =
    (formSchema?.opening_message as string | null) ??
    "Hello! Thank you for considering us. We would love to learn more about what you are looking for so that our team can reach out to you with exactly the right information.";

  let conversationalSteps: ConversationalFormStep[] = typedFormSteps.length > 0
    ? typedFormSteps.map((step) => ({
        id: step.id,
        title: step.title,
        fields: [...(step.form_fields ?? [])]
          .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
          .map((f) => ({
            id: f.id,
            field_type: f.field_type as ConversationalFormStep["fields"][number]["field_type"],
            label: f.label,
            placeholder: f.placeholder ?? undefined,
            options: f.options ?? undefined,
            is_required: f.is_required ?? false,
            maps_to: f.maps_to ?? undefined,
          })),
      }))
    : [
        {
          id: "default",
          title: "Contact details",
          fields: [
            { id: "name", field_type: "text" as const, label: "What is your full name?", placeholder: "Your full name", is_required: true, maps_to: "name" },
            { id: "phone", field_type: "phone" as const, label: "Best phone number to reach you?", placeholder: "+1 555 000 0000", is_required: true, maps_to: "phone" },
            { id: "email", field_type: "email" as const, label: "Your email address?", placeholder: "you@example.com", is_required: false, maps_to: "email" },
            { id: "notes", field_type: "textarea" as const, label: "Anything you would like us to know?", placeholder: "Tell us about your project…", is_required: false, maps_to: "notes" },
          ],
        },
      ];

  if (formSchema?.budget_question_enabled === true) {
    conversationalSteps = injectOptionalBudgetQuestion(
      conversationalSteps,
      getBudgetRangeOptions({
        budgetMin: (campaignQualifiers?.budget_min as number | null) ?? null,
        budgetMax: (campaignQualifiers?.budget_max as number | null) ?? null,
      })
    );
  }

  const portfolioUrl = (profile.is_published as boolean) && (profile.slug as string)
    ? `${process.env.NEXT_PUBLIC_APP_DOMAIN ?? "https://leadstaq.tech"}/p/${profile.slug as string}`
    : undefined;

  const heroImageUrl = (profile.hero_image_url as string | null)?.trim() || null;
  const hasHeroPhoto = Boolean(heroImageUrl);

  const projectsWithPhotos = typedProjects
    .map((project) => ({ project, coverUrl: getProjectCover(project) }))
    .filter((entry): entry is { project: Project; coverUrl: string } => Boolean(entry.coverUrl));

  const publicPackages = typedPackages.filter((pkg) => pkg.is_public && pkg.slug);
  const featuredPublic = publicPackages.find((pkg) => pkg.is_featured);
  const packageTeaser: PricingPackage[] = [];
  if (featuredPublic) packageTeaser.push(featuredPublic);
  const secondPublic = publicPackages.find((pkg) => pkg.id !== featuredPublic?.id);
  if (secondPublic && packageTeaser.length < 2) packageTeaser.push(secondPublic);

  const installCount = projectCount ?? 0;
  const packagesListHref = `/p/${params.slug}/packages`;

  return (
    <div
      className="min-h-screen bg-white [font-family:var(--fw-font-body)] text-[var(--fw-text-primary)]"
      style={{ ["--brand" as string]: brandColor }}
    >
      {/* Hero */}
      <section
        className={`relative isolate flex min-h-[78vh] flex-col lg:min-h-[84vh] ${hasHeroPhoto ? "bg-cover bg-center" : "bg-[var(--brand)]"}`}
        style={hasHeroPhoto ? { backgroundImage: `url(${heroImageUrl})` } : undefined}
      >
        {hasHeroPhoto && (
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{ background: HERO_SCRIM }}
            aria-hidden
          />
        )}

        {/* Header pill */}
        <header className="relative z-[2] mx-auto mt-3.5 flex w-[calc(100%-28px)] max-w-[1040px] items-center justify-between gap-2.5 rounded-2xl border border-white/70 bg-white/95 px-3 py-2.5 shadow-[0_12px_36px_rgba(10,9,7,0.22)] backdrop-blur-md sm:mt-[18px] sm:w-[calc(100%-44px)] sm:gap-3 sm:px-3.5 sm:py-[11px] sm:pl-[18px] sm:pr-3.5 max-[560px]:px-2.5 max-[560px]:pl-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={client!.logo_url!}
                alt={clientName}
                className="h-[34px] w-[34px] shrink-0 rounded-[9px] object-contain sm:h-[38px] sm:w-[38px]"
              />
            ) : (
              <div
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[var(--brand)] text-base font-bold text-white [font-family:var(--fw-font-display)] sm:h-[38px] sm:w-[38px] sm:text-xl"
                aria-hidden
              >
                {getInitials(clientName).slice(0, 1)}
              </div>
            )}
            <div className="min-w-0 overflow-hidden">
              <p className="truncate text-base font-bold tracking-tight [font-family:var(--fw-font-display)] sm:text-xl">
                {clientName}
              </p>
              {headerSubtitle && (
                <p className="truncate text-[11px] tracking-wide text-[var(--fw-text-tertiary)] max-[560px]:hidden">
                  {headerSubtitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2.5 sm:gap-[18px]">
            <a
              href="#work"
              className="hidden text-[13px] text-[var(--fw-text-tertiary)] no-underline transition-colors hover:text-[var(--fw-text-primary)] min-[821px]:inline"
            >
              Work
            </a>
            <a
              href="#packages"
              className="hidden text-[13px] text-[var(--fw-text-tertiary)] no-underline transition-colors hover:text-[var(--fw-text-primary)] min-[821px]:inline"
            >
              Packages
            </a>
            <a
              href="#contact"
              className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[11px] bg-[var(--brand)] px-[18px] py-2.5 text-[13px] font-semibold text-white no-underline transition-opacity hover:opacity-90"
            >
              Get a quote
            </a>
          </div>
        </header>

        {/* Hero copy */}
        <div className="relative z-[2] mx-auto mt-auto w-full max-w-[1040px] px-5 pb-[52px] sm:px-7 sm:pb-[72px]">
          {eyebrowText && (
            <p className="mb-5 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white">
              <span className="inline-block h-0.5 w-[26px] bg-[var(--brand)]" aria-hidden />
              {eyebrowText}
            </p>
          )}
          <h1 className="max-w-[18ch] text-[clamp(40px,6vw,68px)] leading-[1.02] tracking-[-0.02em] text-white [font-family:var(--fw-font-display)] [text-shadow:0_2px_30px_rgba(0,0,0,0.25)]">
            {(profile.headline as string | null) ?? clientName}
          </h1>
          {profile.subheadline && (
            <p className="mt-[22px] max-w-[50ch] text-lg leading-relaxed text-white/80">
              {profile.subheadline as string}
            </p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#contact"
              className="inline-flex items-center justify-center gap-2 rounded-[11px] bg-[var(--brand)] px-[26px] py-3.5 text-sm font-semibold text-white no-underline transition-opacity hover:opacity-90"
            >
              Request a free quote
              <ArrowRight size={15} aria-hidden />
            </a>
            {projectsWithPhotos.length > 0 && (
              <a
                href="#work"
                className="inline-flex items-center justify-center rounded-[11px] border border-white/30 bg-white/[0.08] px-[26px] py-3.5 text-sm font-semibold text-white no-underline backdrop-blur-sm transition-colors hover:border-white hover:bg-white/[0.14]"
              >
                See our work
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1040px] px-5 sm:px-7">
        {/* Stats */}
        {installCount > 0 && (
          <div className="grid grid-cols-1 border-b border-[var(--fw-border)]">
            <div className="px-2 py-[30px] text-center">
              <p className="text-[clamp(30px,4vw,42px)] font-bold tracking-[-0.02em] text-[var(--brand)] [font-family:var(--fw-font-display)]">
                {installCount}+
              </p>
              <p className="mt-1 text-[13px] tracking-wide text-[var(--fw-text-tertiary)]">
                Projects completed
              </p>
            </div>
          </div>
        )}

        {/* Work */}
        {projectsWithPhotos.length > 0 && (
          <section id="work" className="border-t border-[var(--fw-border)] py-16 first:border-t-0">
            <div className="mb-[34px] flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--fw-text-tertiary)]">
                  Recent work
                </p>
                <h2 className="mt-2.5 text-[clamp(28px,3.6vw,40px)] leading-[1.08] tracking-[-0.02em] [font-family:var(--fw-font-display)]">
                  Projects we&apos;re proud of
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {projectsWithPhotos.map(({ project, coverUrl }, index) => {
                const meta = getProjectMeta(project);
                const isFeatured = index === 0;
                return (
                  <Link
                    key={project.id}
                    href={`/cloud/share/${project.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group relative overflow-hidden rounded-2xl border border-[var(--fw-border)] bg-gradient-to-br from-[#e9e3d8] to-[#d9d0c1] transition-transform hover:-translate-y-0.5 ${
                      isFeatured
                        ? "col-span-2 aspect-[16/10] lg:col-span-2 lg:row-span-2 lg:aspect-auto lg:min-h-[320px]"
                        : "aspect-square"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverUrl}
                      alt={project.title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div
                      className="absolute inset-0 bg-gradient-to-br from-[color-mix(in_srgb,var(--brand)_22%,transparent)] to-transparent"
                      aria-hidden
                    />
                    <div className="absolute bottom-3.5 left-4 text-[var(--fw-text-primary)]">
                      <p className="text-base font-bold [font-family:var(--fw-font-display)]">{project.title}</p>
                      {meta && <p className="text-xs text-[var(--fw-text-tertiary)]">{meta}</p>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Packages teaser */}
        {packageTeaser.length > 0 && (
          <section id="packages" className="border-t border-[var(--fw-border)] py-16">
            <div className="mb-[34px] flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--fw-text-tertiary)]">
                  Pricing
                </p>
                <h2 className="mt-2.5 text-[clamp(28px,3.6vw,40px)] leading-[1.08] tracking-[-0.02em] [font-family:var(--fw-font-display)]">
                  Our packages
                </h2>
              </div>
              <Link
                href={packagesListHref}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] no-underline"
              >
                View all packages
                <ArrowRight size={15} aria-hidden />
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {packageTeaser.map((pkg) => {
                const featured = pkg.is_featured;
                const requestHref = `/p/${params.slug}?pkg=${pkg.slug}#contact`;
                const subline = pkg.tagline ?? pkg.description;
                return (
                  <article
                    key={pkg.id}
                    className={`flex flex-col rounded-[18px] border p-7 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[rgba(28,20,16,0.2)] ${
                      featured
                        ? "border-[color-mix(in_srgb,var(--brand)_35%,var(--fw-border))] bg-[color-mix(in_srgb,var(--brand)_6%,#FFFFFF)]"
                        : "border-[var(--fw-border)] bg-[var(--fw-card)]"
                    }`}
                  >
                    {featured && (
                      <span className="mb-3.5 inline-flex self-start rounded-full bg-[var(--brand)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                        Most popular
                      </span>
                    )}
                    <h3 className="text-2xl tracking-[-0.01em] [font-family:var(--fw-font-display)]">{pkg.name}</h3>
                    {subline && (
                      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[var(--fw-text-tertiary)]">{subline}</p>
                    )}
                    <p className="my-4 text-[32px] font-bold tracking-[-0.02em] text-[var(--brand)] [font-family:var(--fw-font-display)]">
                      {formatPackagePrice(pkg)}
                    </p>
                    {pkg.includes && pkg.includes.length > 0 && (
                      <ul className="mb-5 space-y-2">
                        {pkg.includes.slice(0, 3).map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm leading-snug">
                            <Check size={15} className="mt-0.5 shrink-0 text-[var(--brand)]" aria-hidden />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <a
                      href={requestHref}
                      className={`mt-auto inline-flex h-11 items-center justify-center rounded-[11px] px-5 text-sm font-semibold no-underline transition-opacity hover:opacity-90 ${
                        featured
                          ? "bg-[var(--brand)] text-white"
                          : "border border-[var(--fw-border)] bg-transparent text-[var(--fw-text-primary)]"
                      }`}
                    >
                      Request this package
                    </a>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* Testimonials */}
        {typedTestimonials.length > 0 && (
          <section className="border-t border-[var(--fw-border)] py-16">
            <div className="mb-[34px]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--fw-text-tertiary)]">
                From customers
              </p>
              <h2 className="mt-2.5 text-[clamp(28px,3.6vw,40px)] leading-[1.08] tracking-[-0.02em] [font-family:var(--fw-font-display)]">
                What clients say
              </h2>
            </div>
            <div className="grid gap-[18px] md:grid-cols-2">
              {typedTestimonials.map((t) => (
                <article
                  key={t.id}
                  className="rounded-[18px] border border-[var(--fw-border)] bg-[var(--fw-card)] px-8 py-[30px]"
                >
                  {t.rating != null && (
                    <div className="mb-4 flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={15}
                          className={
                            i < t.rating!
                              ? "fill-[var(--brand)] text-[var(--brand)]"
                              : "fill-none text-[var(--fw-border-strong)]"
                          }
                          aria-hidden
                        />
                      ))}
                    </div>
                  )}
                  <blockquote className="text-xl leading-[1.45] tracking-[-0.01em] [font-family:var(--fw-font-display)]">
                    &ldquo;{t.content}&rdquo;
                  </blockquote>
                  <p className="mt-[18px] text-[13px] tracking-wide text-[var(--fw-text-tertiary)]">
                    — {t.author_name}
                    {t.author_role ? `, ${t.author_role}` : ""}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Contact */}
        <section id="contact" className="border-t border-[var(--fw-border)] py-16">
          <div className="relative grid gap-7 overflow-hidden rounded-[22px] bg-[var(--fw-soil)] p-8 text-[#F7F4EF] sm:grid-cols-2 sm:gap-11 sm:p-12">
            <span className="absolute bottom-0 left-0 top-0 w-[5px] bg-[var(--brand)]" aria-hidden />
            <div className="pl-1 sm:pl-2">
              <h2 className="text-[clamp(26px,3.4vw,38px)] leading-[1.08] tracking-tight [font-family:var(--fw-font-display)]">
                {conversationalFormTitle}
              </h2>
              <p className="mt-3.5 max-w-md text-[15px] leading-relaxed text-[#F7F4EF]/60">
                Answer a few quick questions and someone from {clientName} will reach out with the
                right information.
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[#F7F4EF]/10 bg-[#F7F4EF]/[0.06]">
              <ConversationalForm
                clientId={clientId}
                clientName={clientName}
                clientLogo={client?.logo_url ?? undefined}
                formTitle={conversationalFormTitle}
                openingMessage={conversationalOpeningMessage}
                steps={conversationalSteps}
                portfolioUrl={portfolioUrl}
                requestedPackage={requestedPackage}
              />
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-[18px] border-t border-[var(--fw-border)] py-10 pb-[60px]">
          <p className="text-[13px] leading-relaxed text-[var(--fw-text-tertiary)]">
            <span className="font-semibold text-[var(--fw-text-primary)]">{clientName}</span>
            {client?.country ? ` · ${client.country}` : ""}
          </p>
          <p className="flex items-center gap-[7px] text-[11px] tracking-wide text-[var(--fw-text-tertiary)]">
            <span className="h-[7px] w-[7px] shrink-0 rounded-[2px] bg-[#D4FF4F]" aria-hidden />
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
        </footer>
      </div>
    </div>
  );
}
