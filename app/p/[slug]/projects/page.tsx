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
  const projectsWithCovers = typedProjects.map((project) => ({
    project,
    coverUrl: getProjectCover(project),
  }));

  if (projectsWithCovers.length === 0) notFound();

  const featuredProjects = projectsWithCovers.filter(({ project }) => project.is_featured);
  const otherProjects = projectsWithCovers.filter(({ project }) => !project.is_featured);

  return (
    <div
      className="min-h-screen bg-white [font-family:var(--fw-font-body)] text-[var(--fw-text-primary)]"
      style={{ ["--brand" as string]: brandColor }}
    >
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0f0e0c]/88 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-4 sm:px-8">
          {showLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.logo_url!}
              alt={clientName}
              className="h-10 w-10 shrink-0 rounded-[10px] object-contain bg-white/95 p-0.5"
            />
          ) : (
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--brand)] text-sm font-bold text-white"
              aria-hidden
            >
              {getInitials(clientName)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate [font-family:var(--fw-font-display)] text-lg leading-tight text-white">
              {clientName}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/55">
              <ShieldCheck size={13} className="shrink-0 text-[var(--brand)]" aria-hidden />
              All projects
            </p>
          </div>
          <Link
            href={profileHref}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[12px] font-semibold text-white/90 no-underline backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            <ArrowLeft size={14} aria-hidden />
            Profile
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="mb-10">
          <div className="mb-3 flex items-center gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--brand)]">
              Portfolio
            </p>
            <span className="h-px w-8 bg-[var(--brand)]" aria-hidden />
          </div>
          <h1 className="mb-3 [font-family:var(--fw-font-display)] text-[clamp(32px,5vw,48px)] leading-[1.05] tracking-[-0.02em]">
            All projects
          </h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--fw-text-tertiary)]">
            {projectsWithCovers.length} project{projectsWithCovers.length === 1 ? "" : "s"} from{" "}
            {clientName}
            {featuredProjects.length > 0 ? " · featured work first" : ""}.
          </p>
        </section>

        {featuredProjects.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fw-text-tertiary)]">
              Featured
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {featuredProjects.map(({ project, coverUrl }) => {
                const meta = getProjectMeta(project);
                return (
                  <ProjectCard
                    key={project.id}
                    href={`/p/${params.slug}/projects/${project.id}`}
                    title={project.title}
                    meta={meta}
                    coverUrl={coverUrl}
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {otherProjects.map(({ project, coverUrl }) => {
                const meta = getProjectMeta(project);
                return (
                  <ProjectCard
                    key={project.id}
                    href={`/p/${params.slug}/projects/${project.id}`}
                    title={project.title}
                    meta={meta}
                    coverUrl={coverUrl}
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
  featured = false,
}: {
  href: string;
  title: string;
  meta: string | null;
  coverUrl: string | null;
  featured?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group relative isolate overflow-hidden rounded-[18px] bg-[#1C1410] transition-transform duration-300 hover:-translate-y-1"
    >
      <div className="relative aspect-[4/5] overflow-hidden sm:aspect-[4/3]">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[color-mix(in_srgb,var(--brand)_28%,#1C1410)]">
            <span className="text-sm font-semibold tracking-[0.04em] text-white/50 [font-family:var(--fw-font-display)]">
              Project
            </span>
          </div>
        )}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(8,7,6,0.90) 0%, rgba(8,7,6,0.32) 48%, rgba(8,7,6,0.10) 100%)",
          }}
          aria-hidden
        />
        {featured && (
          <span className="absolute left-3 top-3 rounded-full bg-[var(--brand)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--fw-text-primary)]">
            Featured
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <p className="[font-family:var(--fw-font-display)] text-lg leading-tight tracking-[-0.01em] text-white">
            {title}
          </p>
          {meta && <p className="mt-1 text-sm text-white/65">{meta}</p>}
        </div>
      </div>
    </Link>
  );
}
