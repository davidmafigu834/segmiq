import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { MapPin, Calendar, ArrowRight, Clock, DollarSign } from "lucide-react";
import Link from "next/link";
import { ViewRecorder } from "./ViewRecorder";
import { ShareViewSwitcher } from "./ShareViewSwitcher";

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function hasAbsoluteLogo(logoUrl: string | null | undefined): logoUrl is string {
  return typeof logoUrl === "string" && /^https?:\/\//.test(logoUrl);
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export const dynamic = "force-dynamic";

const HERO_SCRIM =
  "linear-gradient(to top, rgba(10,9,7,0.86) 0%, rgba(10,9,7,0.45) 42%, rgba(10,9,7,0.12) 72%, rgba(10,9,7,0.30) 100%), linear-gradient(105deg, rgba(10,9,7,0.55) 0%, rgba(10,9,7,0.10) 55%, transparent 80%)";

type MediaItem = {
  id: string;
  public_url: string;
  display_order: number;
  caption: string | null;
  type?: string;
  thumbnail_url?: string | null;
  duration_seconds?: number | null;
};

export async function generateMetadata({ params }: { params: { projectId: string } }): Promise<Metadata> {
  const supabase = createAdminClient();
  const { data: project } = await supabase
    .from("projects")
    .select("title, description, project_media!project_media_project_id_fkey(public_url, display_order)")
    .or(`id.eq.${params.projectId},slug.eq.${params.projectId}`)
    .maybeSingle();
  if (!project) return { title: "Project | Segmiq Cloud" };
  const media = (project.project_media as MediaItem[] | null) ?? [];
  const cover = media.sort((a, b) => a.display_order - b.display_order)[0]?.public_url;
  const title = project.title as string;
  const description = (project.description as string | null) ?? undefined;
  const baseUrl = process.env.NEXT_PUBLIC_CLOUD_DOMAIN ?? "https://cloud.segmiq.com";
  const pageUrl = `${baseUrl}/cloud/share/${params.projectId}`;
  return {
    title: `${title} | Segmiq Cloud`,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "Segmiq Cloud",
      type: "website",
      locale: "en_US",
      images: cover ? [{ url: cover, alt: title }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: cover ? [cover] : [],
    },
  };
}

export default async function CloudSharePage({ params }: { params: { projectId: string } }) {
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*, clients(name, primary_color, slug, logo_url, country, industry)")
    .or(`id.eq.${params.projectId},slug.eq.${params.projectId}`)
    .eq("is_public", true)
    .maybeSingle();

  if (!project) notFound();

  const { data: rawMedia } = await supabase
    .from("project_media")
    .select("id, public_url, display_order, caption, type, thumbnail_url, duration_seconds")
    .eq("project_id", project.id as string)
    .order("display_order", { ascending: true });

  type MilestoneMedia = {
    id: string;
    public_url: string;
    caption: string | null;
    display_order: number;
    thumbnail_url?: string | null;
    type?: string | null;
  };
  type MilestoneRow = {
    id: string;
    title: string;
    description: string | null;
    milestone_date: string;
    display_order: number;
    is_completed: boolean;
    stat_number: string | null;
    stat_label: string | null;
    phase: string | null;
    project_media: MilestoneMedia[];
  };
  const { data: rawMilestones } = await supabase
    .from("project_milestones")
    .select(
      "id, title, description, milestone_date, display_order, is_completed, stat_number, stat_label, phase, project_media(id, public_url, caption, display_order, thumbnail_url, type)"
    )
    .eq("project_id", project.id as string)
    .order("milestone_date", { ascending: true });
  const milestones = (rawMilestones ?? []) as MilestoneRow[];

  const client = project.clients as {
    name: string;
    primary_color: string | null;
    slug: string;
    logo_url: string | null;
    country: string | null;
    industry: string | null;
  } | null;

  const media = (rawMedia ?? []) as MediaItem[];
  const cover = media[0]?.public_url;
  const hasCover = Boolean(cover);
  const isCompleted = Boolean(project.completion_date as string | null);

  type ClientProfileRow = {
    slug?: string;
    watermark_enabled?: boolean;
    watermark_position?: string;
    watermark_opacity?: number;
    watermark_size?: string;
  };
  const clientProfile = project.client_id
    ? await (async () => {
        const { data: cp } = await supabase
          .from("client_profiles")
          .select("slug, watermark_enabled, watermark_position, watermark_opacity, watermark_size")
          .eq("client_id", project.client_id as string)
          .maybeSingle();
        return cp as ClientProfileRow | null;
      })()
    : null;

  const profileSlug = clientProfile?.slug ?? client?.slug ?? null;
  const logoUrl = client?.logo_url ?? null;
  const showLogo = hasAbsoluteLogo(logoUrl);
  const watermarkConfig =
    clientProfile?.watermark_enabled && logoUrl
      ? {
          logoUrl,
          position: (clientProfile.watermark_position ?? "bottom-right") as
            | "bottom-right"
            | "bottom-left"
            | "bottom-center"
            | "center",
          opacity: clientProfile.watermark_opacity ?? 40,
          size: (clientProfile.watermark_size ?? "small") as "small" | "medium" | "large",
        }
      : null;

  const brandColor = client?.primary_color ?? "#0F7A4F";
  const clientName = client?.name ?? "";
  const descriptionText = project.description as string | null;
  const showDescription =
    descriptionText &&
    descriptionText.trim() !== "" &&
    descriptionText.trim() !== "Everything";
  const contactHref = profileSlug ? `/p/${profileSlug}#contact` : null;
  const profileHref = profileSlug ? `/p/${profileSlug}` : null;
  const mediaLabel = media.some((m) => m.type === "video") ? "Media" : "Photos";

  return (
    <div
      className="w-full bg-white antialiased"
      style={{ ["--brand" as string]: brandColor, ["--brand-ink" as string]: "#FFFFFF" }}
    >
      <ViewRecorder projectId={project.id as string} />

      {/* Hero */}
      <section
        className={`relative isolate flex min-h-[clamp(280px,50vh,480px)] w-full flex-col ${
          hasCover ? "bg-cover bg-center bg-no-repeat" : "bg-[color-mix(in_srgb,var(--brand)_38%,#0a0907)]"
        }`}
        style={hasCover ? { backgroundImage: `url(${cover})` } : undefined}
      >
        {hasCover && (
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{ background: HERO_SCRIM }}
            aria-hidden
          />
        )}

        <header className="relative z-[2] mx-auto mt-[18px] flex w-[calc(100%-44px)] max-w-[1040px] items-center justify-between gap-3 rounded-[18px] border border-white/70 bg-white/[0.96] py-[11px] pl-[18px] pr-3.5 shadow-[0_12px_36px_rgba(10,9,7,0.22)] backdrop-blur-[8px] max-[560px]:mt-3.5 max-[560px]:w-[calc(100%-28px)] max-[560px]:gap-2.5 max-[560px]:py-2.5 max-[560px]:pl-3 max-[560px]:pr-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-3 max-[560px]:gap-2.5">
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={clientName}
                className="h-[38px] w-[38px] shrink-0 rounded-[9px] object-contain max-[560px]:h-[34px] max-[560px]:w-[34px]"
              />
            ) : (
              <div
                className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[9px] bg-[var(--brand)] text-xl font-bold text-[var(--brand-ink)] [font-family:var(--fw-font-display)] max-[560px]:h-[34px] max-[560px]:w-[34px] max-[560px]:text-lg"
                aria-hidden
              >
                {getInitials(clientName || "P").slice(0, 1)}
              </div>
            )}
            <div className="min-w-0 overflow-hidden">
              {profileHref ? (
                <Link
                  href={profileHref}
                  className="truncate text-xl font-bold tracking-[-0.01em] text-[var(--fw-text-primary)] no-underline [font-family:var(--fw-font-display)] hover:opacity-80 max-[560px]:text-base"
                >
                  {clientName}
                </Link>
              ) : (
                <p className="truncate text-xl font-bold tracking-[-0.01em] text-[var(--fw-text-primary)] [font-family:var(--fw-font-display)] max-[560px]:text-base">
                  {clientName}
                </p>
              )}
              {client?.industry && (
                <p className="truncate text-[11px] tracking-[0.04em] text-[var(--fw-text-tertiary)] max-[560px]:hidden">
                  {client.industry}
                  {client.country ? ` · ${client.country}` : ""}
                </p>
              )}
            </div>
          </div>
          {contactHref && (
            <a
              href={contactHref}
              className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[11px] bg-[var(--brand)] px-[18px] py-2.5 text-[13px] font-semibold tracking-[0.01em] text-[var(--brand-ink)] no-underline transition-opacity hover:opacity-90 active:translate-y-px"
            >
              Get a quote
            </a>
          )}
        </header>

        <div className="relative z-[2] mx-auto mt-auto w-full max-w-[1040px] px-7 pb-[52px] max-[820px]:pb-10">
          <p className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">
            <span
              className={`inline-block h-2 w-2 rounded-full ${isCompleted ? "bg-emerald-400" : "bg-amber-300"}`}
              aria-hidden
            />
            {isCompleted ? "Completed project" : "In progress"}
          </p>
          <h1 className="max-w-[20ch] text-[clamp(32px,5.5vw,52px)] font-bold leading-[1.05] tracking-[-0.02em] text-white [font-family:var(--fw-font-display)] [text-shadow:0_2px_30px_rgba(0,0,0,0.25)]">
            {project.title as string}
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/75">
            {project.category && (
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white backdrop-blur-sm">
                {project.category as string}
              </span>
            )}
            {project.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} aria-hidden />
                {project.location as string}
              </span>
            )}
            {project.completion_date && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={14} aria-hidden />
                {formatDate(project.completion_date as string)}
              </span>
            )}
            {(project.duration_label as string | null) && (
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} aria-hidden />
                {project.duration_label as string}
              </span>
            )}
            {(project.show_budget as boolean | null) && (project.budget_range as string | null) && (
              <span className="inline-flex items-center gap-1.5">
                <DollarSign size={14} aria-hidden />
                {project.budget_range as string}
              </span>
            )}
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55">
              {media.length} {mediaLabel}
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1040px] px-7">
        {showDescription && (
          <section className="border-b border-[rgba(28,20,16,0.10)] py-12">
            <p className="max-w-[720px] text-[11px] uppercase tracking-[0.22em] text-[var(--fw-text-tertiary)]">
              About this project
            </p>
            <p className="mt-3 max-w-[720px] text-lg leading-[1.75] text-[var(--fw-text-primary)]">
              {descriptionText}
            </p>
          </section>
        )}

        {media.length > 0 && (
          <section className={`py-12 ${showDescription ? "" : "border-t border-[rgba(28,20,16,0.10)]"}`}>
            <div className="mb-6">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--fw-text-tertiary)]">
                {mediaLabel}
              </p>
              <h2 className="mt-2.5 text-[clamp(24px,3.2vw,34px)] font-bold leading-[1.08] tracking-[-0.02em] [font-family:var(--fw-font-display)]">
                Project gallery
              </h2>
            </div>
            <ShareViewSwitcher media={media} milestones={milestones} watermark={watermarkConfig} />
          </section>
        )}

        {contactHref && (
          <section className="py-12">
            <div className="relative overflow-hidden rounded-[22px] bg-[#1C1410] px-[26px] py-10 text-[#F7F4EF] min-[821px]:px-12 min-[821px]:py-[50px]">
              <span className="absolute bottom-0 left-0 top-0 w-[5px] bg-[var(--brand)]" aria-hidden />
              <div className="mx-auto max-w-[640px] text-center">
                <h2 className="text-[clamp(26px,3.4vw,38px)] font-bold leading-[1.08] tracking-[-0.02em] [font-family:var(--fw-font-display)]">
                  Interested in a project like this?
                </h2>
                <p className="mx-auto mt-3.5 max-w-[42ch] text-[15px] leading-normal text-[rgba(247,244,239,0.6)]">
                  Get a free quote from {clientName} today.
                </p>
                <a
                  href={contactHref}
                  className="mt-8 inline-flex items-center justify-center gap-2 rounded-[11px] bg-[var(--brand)] px-[26px] py-3.5 text-sm font-semibold tracking-[0.01em] text-[var(--brand-ink)] no-underline transition-opacity hover:opacity-90 active:translate-y-px"
                >
                  Get a free quote
                  <ArrowRight size={15} aria-hidden />
                </a>
              </div>
            </div>
          </section>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-[18px] border-t border-[rgba(28,20,16,0.10)] py-[42px] pb-[60px]">
          <p className="text-[13px] leading-[1.7] text-[var(--fw-text-tertiary)]">
            <strong className="font-semibold text-[var(--fw-text-primary)]">{clientName}</strong>
            {client?.country ? ` · ${client.country}` : ""}
          </p>
          <p className="flex items-center gap-[7px] text-[11px] tracking-[0.03em] text-[var(--fw-text-tertiary)]">
            <span className="h-[7px] w-[7px] shrink-0 rounded-[2px] bg-[#D4FF4F]" aria-hidden />
            Powered by{" "}
            <strong className="font-semibold text-[var(--fw-text-primary)]">
              <a
                href="https://segmiq.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--fw-text-primary)] no-underline hover:underline"
              >
                Segmiq
              </a>
            </strong>
          </p>
        </footer>
      </div>
    </div>
  );
}
