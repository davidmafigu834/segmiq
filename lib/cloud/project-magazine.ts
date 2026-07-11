import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Battery, Check, Clock, Shield, Sun, Zap } from "lucide-react";
import {
  isMissingMagazineColumnError,
} from "@/lib/cloud/project-columns";
import {
  CLIENT_CAPABILITY_COLUMNS,
  isMissingCapabilityColumnError,
  parseClientCapabilityProfile,
  shouldShowCapabilitySection,
  type ClientCapabilityProfile,
} from "@/lib/cloud/client-capability";

export type TimelineStep = {
  day_label: string;
  title: string;
  description: string;
  media_ids: string[];
};

export type SpecField = {
  label: string;
  value: string;
};

export type ProjectMediaRow = {
  id: string;
  public_url: string;
  display_order: number;
  caption: string | null;
  type?: string;
  thumbnail_url?: string | null;
};

export type ProjectMagazineClient = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  industry: string | null;
  country: string | null;
};

export type ProjectMagazineData = {
  slug: string;
  project: {
    id: string;
    title: string;
    slug: string | null;
    category: string | null;
    location: string | null;
    completion_date: string | null;
    description: string | null;
    cover_media_id: string | null;
    story_brief: string | null;
    story_result: string | null;
    pull_quote: string | null;
    pull_quote_by: string | null;
    timeline_steps: TimelineStep[];
    spec_fields: SpecField[];
    pdf_url: string | null;
    pdf_generated_at: string | null;
    updated_at: string;
    duration_label: string | null;
    budget_range: string | null;
    show_budget: boolean;
    include_capability_section: boolean;
  };
  client: ProjectMagazineClient;
  capability: ClientCapabilityProfile;
  publicProjectCount: number;
  showCapabilitySection: boolean;
  media: ProjectMediaRow[];
  coverUrl: string | null;
  printCoverUrl: string | null;
  testimonial: {
    author_name: string;
    author_role: string | null;
    content: string;
  } | null;
  livePageUrl: string;
  pdfDownloadUrl: string;
  pdfDirectUrl: string | null;
};

export const HERO_SCRIM =
  "linear-gradient(to top, rgba(10,9,7,0.86) 0%, rgba(10,9,7,0.45) 42%, rgba(10,9,7,0.12) 72%, rgba(10,9,7,0.30) 100%), linear-gradient(105deg, rgba(10,9,7,0.55) 0%, rgba(10,9,7,0.10) 55%, transparent 80%)";

const SPEC_ICONS: LucideIcon[] = [Zap, Battery, Sun, Shield, Clock, Check];

export function normalizeAppDomainUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "https://segmiq.com";
  return raw.startsWith("http") ? raw.replace(/\/$/, "") : `https://${raw.replace(/\/$/, "")}`;
}

export function hasAbsoluteLogo(logoUrl: string | null | undefined): logoUrl is string {
  return typeof logoUrl === "string" && /^https?:\/\//.test(logoUrl);
}

export function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function parseTimelineSteps(raw: unknown): TimelineStep[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const day_label = typeof row.day_label === "string" ? row.day_label.trim() : "";
      const title = typeof row.title === "string" ? row.title.trim() : "";
      const description = typeof row.description === "string" ? row.description.trim() : "";
      const media_ids = Array.isArray(row.media_ids)
        ? row.media_ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        : [];
      if (!day_label && !title && !description && media_ids.length === 0) return null;
      return { day_label, title, description, media_ids };
    })
    .filter((row): row is TimelineStep => row !== null);
}

function parseSpecFields(raw: unknown): SpecField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const label = typeof row.label === "string" ? row.label.trim() : "";
      const value = typeof row.value === "string" ? row.value.trim() : "";
      if (!label && !value) return null;
      return { label, value };
    })
    .filter((row): row is SpecField => row !== null);
}

export function resolveCoverUrl(
  coverMediaId: string | null,
  media: ProjectMediaRow[]
): string | null {
  const photos = [...media]
    .filter((m) => m.type !== "video" && m.type !== "video_url")
    .sort((a, b) => a.display_order - b.display_order);

  if (coverMediaId) {
    const cover = photos.find((m) => m.id === coverMediaId);
    if (cover?.public_url) return cover.public_url;
  }

  return photos[0]?.public_url ?? null;
}

export function resolvePrintCoverUrl(
  coverMediaId: string | null,
  media: ProjectMediaRow[]
): string | null {
  const photos = [...media]
    .filter((m) => m.type !== "video" && m.type !== "video_url")
    .sort((a, b) => a.display_order - b.display_order);

  if (coverMediaId) {
    const cover = photos.find((m) => m.id === coverMediaId);
    if (cover) return cover.thumbnail_url ?? cover.public_url;
  }

  const first = photos[0];
  return first ? (first.thumbnail_url ?? first.public_url) : null;
}

export function getSpecIcon(index: number, label: string): LucideIcon {
  const normalized = label.toLowerCase();
  if (normalized.includes("battery") || normalized.includes("storage")) return Battery;
  if (normalized.includes("panel") || normalized.includes("solar") || normalized.includes("sun")) return Sun;
  if (normalized.includes("inverter") || normalized.includes("power") || normalized.includes("kw")) return Zap;
  if (normalized.includes("warranty") || normalized.includes("shield") || normalized.includes("insurance")) return Shield;
  if (normalized.includes("time") || normalized.includes("duration") || normalized.includes("day")) return Clock;
  return SPEC_ICONS[index % SPEC_ICONS.length] ?? Check;
}

export function formatCompletionDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function buildSpecMetaLine(specFields: SpecField[]): string | null {
  if (specFields.length === 0) return null;
  const parts = specFields
    .slice(0, 3)
    .map((f) => f.value)
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function galleryPhotos(media: ProjectMediaRow[]): ProjectMediaRow[] {
  return [...media]
    .filter((m) => m.type !== "video" && m.type !== "video_url")
    .sort((a, b) => a.display_order - b.display_order);
}

export function resolveTimelineStepPhotos(
  step: TimelineStep,
  media: ProjectMediaRow[]
): ProjectMediaRow[] {
  const ids = step.media_ids ?? [];
  if (ids.length === 0) return [];
  const photoMap = new Map(galleryPhotos(media).map((m) => [m.id, m]));
  return ids.map((id) => photoMap.get(id)).filter((m): m is ProjectMediaRow => Boolean(m));
}

/** Resolve a published profile slug for a public project (by id or legacy slug). */
export async function resolveMagazineSlugForProject(
  projectIdOrSlug: string
): Promise<{ slug: string; projectId: string } | null> {
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, client_id, is_public")
    .or(`id.eq.${projectIdOrSlug},slug.eq.${projectIdOrSlug}`)
    .eq("is_public", true)
    .maybeSingle();

  if (!project) return null;

  const { data: profile } = await supabase
    .from("client_profiles")
    .select("slug, is_published")
    .eq("client_id", project.client_id as string)
    .maybeSingle();

  const slug = (profile?.slug as string | null)?.trim();
  if (!slug || !profile?.is_published) return null;

  return { slug, projectId: project.id as string };
}

export async function fetchProjectMagazineData(
  slug: string,
  projectId: string
): Promise<ProjectMagazineData> {
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("client_profiles")
    .select("client_id, slug, is_published")
    .eq("slug", slug)
    .maybeSingle();

  if (!profile || !profile.is_published) notFound();

  const clientId = profile.client_id as string;
  const baseClientSelect = "id, name, slug, logo_url, primary_color, industry, country";
  const capabilitySelect = CLIENT_CAPABILITY_COLUMNS.join(", ");

  let clientRow: Record<string, unknown> | null = null;
  let capability = parseClientCapabilityProfile({});

  const withCapability = await supabase
    .from("clients")
    .select(`${baseClientSelect}, ${capabilitySelect}`)
    .eq("id", clientId)
    .single();

  if (withCapability.error && isMissingCapabilityColumnError(withCapability.error.message)) {
    const basic = await supabase.from("clients").select(baseClientSelect).eq("id", clientId).single();
    if (basic.error || !basic.data) notFound();
    clientRow = basic.data as unknown as Record<string, unknown>;
  } else if (withCapability.error || !withCapability.data) {
    notFound();
  } else {
    clientRow = withCapability.data as Record<string, unknown>;
    capability = parseClientCapabilityProfile(clientRow);
  }

  const client: ProjectMagazineClient = {
    id: clientRow.id as string,
    name: clientRow.name as string,
    slug: (clientRow.slug as string | null) ?? slug,
    logo_url: (clientRow.logo_url as string | null) ?? null,
    primary_color: (clientRow.primary_color as string | null) ?? null,
    industry: (clientRow.industry as string | null) ?? null,
    country: (clientRow.country as string | null) ?? null,
  };

  const baseProjectSelect =
    "id, title, slug, category, location, completion_date, description, cover_media_id, story_brief, story_result, pull_quote, pull_quote_by, timeline_steps, spec_fields, pdf_url, pdf_generated_at, updated_at, duration_label, budget_range, show_budget, is_public";

  const fullProjectResult = await supabase
    .from("projects")
    .select(`${baseProjectSelect}, include_capability_section`)
    .eq("id", projectId)
    .eq("client_id", clientId)
    .eq("is_public", true)
    .maybeSingle();

  let project = fullProjectResult.data as Record<string, unknown> | null;
  let includeCapabilitySection = false;

  if (fullProjectResult.error && isMissingMagazineColumnError(fullProjectResult.error.message)) {
    const basicProjectResult = await supabase
      .from("projects")
      .select(baseProjectSelect)
      .eq("id", projectId)
      .eq("client_id", clientId)
      .eq("is_public", true)
      .maybeSingle();
    project = basicProjectResult.data as Record<string, unknown> | null;
  } else if (fullProjectResult.error) {
    notFound();
  } else if (project) {
    includeCapabilitySection = Boolean(project.include_capability_section);
  }

  if (!project) notFound();
  const showCapabilitySection = shouldShowCapabilitySection(includeCapabilitySection, capability);

  const { count: publicProjectCount } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("is_public", true);

  const { data: rawMedia } = await supabase
    .from("project_media")
    .select("id, public_url, display_order, caption, type, thumbnail_url")
    .eq("project_id", projectId)
    .order("display_order", { ascending: true });

  const media = (rawMedia ?? []) as ProjectMediaRow[];
  const timelineSteps = parseTimelineSteps(project.timeline_steps);
  const specFields = parseSpecFields(project.spec_fields);
  const coverUrl = resolveCoverUrl(project.cover_media_id as string | null, media);
  const printCoverUrl = resolvePrintCoverUrl(project.cover_media_id as string | null, media);

  const hasPullQuote = Boolean(
    (project.pull_quote as string | null)?.trim() ||
      (project.pull_quote_by as string | null)?.trim()
  );

  let testimonial: ProjectMagazineData["testimonial"] = null;
  if (!hasPullQuote) {
    const { data: testimonialRow } = await supabase
      .from("testimonials")
      .select("author_name, author_role, content")
      .eq("client_id", clientId)
      .order("is_featured", { ascending: false })
      .order("display_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (testimonialRow?.content) {
      testimonial = {
        author_name: testimonialRow.author_name as string,
        author_role: (testimonialRow.author_role as string | null) ?? null,
        content: testimonialRow.content as string,
      };
    }
  }

  const baseUrl = normalizeAppDomainUrl();
  const livePageUrl = `${baseUrl}/p/${slug}/projects/${projectId}`;

  return {
    slug,
    project: {
      id: project.id as string,
      title: project.title as string,
      slug: (project.slug as string | null) ?? null,
      category: (project.category as string | null) ?? null,
      location: (project.location as string | null) ?? null,
      completion_date: (project.completion_date as string | null) ?? null,
      description: (project.description as string | null) ?? null,
      cover_media_id: (project.cover_media_id as string | null) ?? null,
      story_brief: (project.story_brief as string | null) ?? null,
      story_result: (project.story_result as string | null) ?? null,
      pull_quote: (project.pull_quote as string | null) ?? null,
      pull_quote_by: (project.pull_quote_by as string | null) ?? null,
      timeline_steps: timelineSteps,
      spec_fields: specFields,
      pdf_url: (project.pdf_url as string | null) ?? null,
      pdf_generated_at: (project.pdf_generated_at as string | null) ?? null,
      updated_at: project.updated_at as string,
      duration_label: (project.duration_label as string | null) ?? null,
      budget_range: (project.budget_range as string | null) ?? null,
      show_budget: Boolean(project.show_budget),
      include_capability_section: includeCapabilitySection,
    },
    client,
    capability,
    publicProjectCount: publicProjectCount ?? 0,
    showCapabilitySection,
    media,
    coverUrl,
    printCoverUrl,
    testimonial,
    livePageUrl,
    pdfDownloadUrl: `/api/cloud/projects/${projectId}/pdf?slug=${encodeURIComponent(slug)}`,
    pdfDirectUrl: isProjectPdfCacheFresh({
      pdf_url: (project.pdf_url as string | null) ?? null,
      pdf_generated_at: (project.pdf_generated_at as string | null) ?? null,
      updated_at: project.updated_at as string,
    })
      ? ((project.pdf_url as string | null) ?? null)
      : null,
  };
}

export function isProjectPdfCacheFresh(project: {
  pdf_url: string | null;
  pdf_generated_at: string | null;
  updated_at: string;
}): boolean {
  const pdfUrl = project.pdf_url;
  const pdfGeneratedAt = project.pdf_generated_at;
  if (!pdfUrl || !pdfGeneratedAt) return false;
  return new Date(pdfGeneratedAt).getTime() >= new Date(project.updated_at).getTime();
}

export function printImageUrl(url: string): string {
  return url;
}

export function buildProjectPdfFilename(title: string): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "case-study";
  return `${base}.pdf`;
}

export function generateProjectPdfKey(clientId: string, projectId: string): string {
  return `clients/${clientId}/projects/${projectId}/case-study-${Date.now()}.pdf`;
}
