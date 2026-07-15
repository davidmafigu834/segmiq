import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

type ClientRow = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  industry: string | null;
  country: string | null;
};

type ProjectMedia = { public_url: string; display_order: number };

type ProjectRow = {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  location: string | null;
  completion_date: string | null;
  description: string | null;
  is_featured: boolean;
  project_media: ProjectMedia[];
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

function getProjectCover(project: ProjectRow): string | null {
  const sorted = [...project.project_media].sort((a, b) => a.display_order - b.display_order);
  return sorted[0]?.public_url ?? null;
}

function getProjectMeta(project: ProjectRow): string | null {
  const parts = [project.location, project.category].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
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

  const title = `Projects — ${client.name}`;
  const description = "Browse completed projects and case studies.";

  return {
    metadataBase,
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}

export default async function PublicProjectsPage({ params }: { params: { slug: string } }) {
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("client_profiles")
    .select("client_id, is_published, clients(id, name, logo_url, primary_color, industry, country)")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!profile || !profile.is_published) notFound();

  const clientId = profile.client_id as string;
  const client = profile.clients as unknown as ClientRow | null;
  if (!client) notFound();

  const clientName = client.name;
  const brandColor = client.primary_color ?? "#0F7A4F";
  const showLogo = hasAbsoluteLogo(client.logo_url);
  const profileHref = `/p/${params.slug}`;

  const { data: projects } = await supabase
    .from("projects")
    .select(
      "id, slug, title, category, location, completion_date, description, is_featured, project_media!project_media_project_id_fkey(public_url, display_order)"
    )
    .eq("client_id", clientId)
    .eq("is_public", true)
    .order("is_featured", { ascending: false })
    .order("display_order", { ascending: true })
    .order("updated_at", { ascending: false });

  const typedProjects = (projects ?? []) as unknown as ProjectRow[];
  const projectsWithPhotos = typedProjects
    .map((project) => ({ project, coverUrl: getProjectCover(project) }))
    .filter((entry): entry is { project: ProjectRow; coverUrl: string } => Boolean(entry.coverUrl));

  if (projectsWithPhotos.length === 0) notFound();

  const featuredProjects = projectsWithPhotos.filter(({ project }) => project.is_featured);
  const otherProjects = projectsWithPhotos.filter(({ project }) => !project.is_featured);

  return (
    <div
      className="min-h-screen bg-[var(--fw-canvas)] [font-family:var(--fw-font-body)] text-[var(--fw-text-primary)]"
      style={{ ["--brand" as string]: brandColor }}
    >
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
          <Link
            href={profileHref}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[var(--brand)] no-underline"
          >
            <ArrowLeft size={15} aria-hidden />
            Profile
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="mb-12">
          <div className="mb-4 flex items-center gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand)]">
              Portfolio
            </p>
            <span className="h-px w-8 bg-[var(--brand)]" aria-hidden />
          </div>
          <h1 className="mb-3 [font-family:var(--fw-font-display)] text-[clamp(28px,5vw,42px)] leading-[1.1] tracking-[-0.01em]">
            All projects
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-[var(--fw-text-tertiary)]">
            Explore {projectsWithPhotos.length} completed project{projectsWithPhotos.length === 1 ? "" : "s"} from{" "}
            {clientName}. Featured work appears first.
          </p>
        </section>

        {featuredProjects.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fw-text-tertiary)]">
              Featured
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredProjects.map(({ project, coverUrl }) => {
                const meta = getProjectMeta(project);
                return (
                  <ProjectCard
                    key={project.id}
                    href={`/p/${params.slug}/projects/${project.id}`}
                    title={project.title}
                    meta={meta}
                    coverUrl={coverUrl}
                    description={project.description}
                    featured
                  />
                );
              })}
            </div>
          </section>
        )}

        {otherProjects.length > 0 && (
          <section>
            {featuredProjects.length > 0 && (
              <h2 className="mb-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fw-text-tertiary)]">
                More projects
              </h2>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {otherProjects.map(({ project, coverUrl }) => {
                const meta = getProjectMeta(project);
                return (
                  <ProjectCard
                    key={project.id}
                    href={`/p/${params.slug}/projects/${project.id}`}
                    title={project.title}
                    meta={meta}
                    coverUrl={coverUrl}
                    description={project.description}
                  />
                );
              })}
            </div>
          </section>
        )}

        <section className="relative mt-14 overflow-hidden rounded-2xl bg-[var(--fw-soil)] px-6 py-10 sm:px-10 sm:py-12">
          <span className="absolute left-0 top-0 h-full w-1 bg-[var(--brand)]" aria-hidden />
          <h2 className="mb-3 pl-4 [font-family:var(--fw-font-display)] text-[clamp(22px,4vw,30px)] leading-snug text-[var(--fw-card)]">
            Ready to start your <span className="text-[var(--brand)]">next project</span>?
          </h2>
          <p className="mb-8 max-w-lg pl-4 text-sm leading-relaxed text-[var(--fw-text-muted)]">
            Tell us what you need and our team will get back to you with a tailored quote.
          </p>
          <div className="pl-4">
            <Link
              href={`${profileHref}#contact`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-6 text-sm font-bold text-[var(--fw-text-primary)] no-underline transition-opacity hover:opacity-90"
            >
              Get a quote
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </section>
      </main>

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

function ProjectCard({
  href,
  title,
  meta,
  coverUrl,
  description,
  featured = false,
}: {
  href: string;
  title: string;
  meta: string | null;
  coverUrl: string;
  description?: string | null;
  featured?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-[var(--fw-border)] bg-[var(--fw-card)] transition-transform duration-200 hover:-translate-y-0.5"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--fw-sunken)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverUrl}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {featured && (
          <span className="absolute left-3 top-3 rounded-full bg-[var(--brand)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--fw-text-primary)]">
            Featured
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="[font-family:var(--fw-font-display)] text-lg leading-tight">{title}</p>
        {meta && <p className="mt-1 text-sm text-[var(--fw-text-tertiary)]">{meta}</p>}
        {description?.trim() && (
          <p className="mt-2 line-clamp-2 text-sm leading-snug text-[var(--fw-text-secondary)]">
            {description.trim()}
          </p>
        )}
      </div>
    </Link>
  );
}
