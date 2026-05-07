import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Calendar, CloudUpload } from "lucide-react";
import Link from "next/link";
import { ViewRecorder } from "./ViewRecorder";

export const dynamic = "force-dynamic";

type MediaItem = { id: string; public_url: string; display_order: number; caption: string | null };

export async function generateMetadata({ params }: { params: { projectId: string } }): Promise<Metadata> {
  const supabase = createAdminClient();
  const { data: project } = await supabase
    .from("projects")
    .select("title, description, project_media(public_url, display_order)")
    .or(`id.eq.${params.projectId},slug.eq.${params.projectId}`)
    .maybeSingle();
  if (!project) return { title: "Project | Leadstaq Cloud" };
  const media = (project.project_media as MediaItem[] | null) ?? [];
  const cover = media.sort((a, b) => a.display_order - b.display_order)[0]?.public_url;
  return {
    title: `${project.title as string} | Leadstaq Cloud`,
    description: (project.description as string | null) ?? undefined,
    openGraph: {
      title: project.title as string,
      description: (project.description as string | null) ?? undefined,
      images: cover ? [{ url: cover }] : [],
    },
  };
}

export default async function CloudSharePage({ params }: { params: { projectId: string } }) {
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*, clients(name, primary_color, slug)")
    .or(`id.eq.${params.projectId},slug.eq.${params.projectId}`)
    .eq("is_public", true)
    .maybeSingle();

  if (!project) notFound();

  const { data: rawMedia } = await supabase
    .from("project_media")
    .select("id, public_url, display_order, caption")
    .eq("project_id", project.id as string)
    .order("display_order", { ascending: true });

  const client = project.clients as { name: string; primary_color: string | null; slug: string } | null;
  const accentColor = client?.primary_color ?? "#D4FF4F";
  const media = (rawMedia ?? []) as MediaItem[];
  const cover = media[0]?.public_url;

  const profileSlug = project.client_id
    ? await (async () => {
        const { data: cp } = await supabase
          .from("client_profiles")
          .select("slug")
          .eq("client_id", project.client_id as string)
          .maybeSingle();
        return (cp as { slug?: string } | null)?.slug ?? client?.slug ?? null;
      })()
    : null;

  // Gallery photos = everything after the hero cover to avoid duplication
  const galleryMedia = cover ? media.slice(1) : media;

  return (
    <div className="min-h-screen bg-white">
      <ViewRecorder projectId={project.id as string} />
      {/* Nav */}
      <nav className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3 min-w-0">
            {profileSlug && (
              <Link
                href={`/p/${profileSlug}`}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 whitespace-nowrap"
              >
                <ArrowLeft className="h-4 w-4 flex-shrink-0" />
                <span className="truncate max-w-[140px] sm:max-w-none">{client?.name ?? "Back"}</span>
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/cloud"
              className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700"
            >
              <CloudUpload className="h-3.5 w-3.5" />
              Leadstaq Cloud
            </Link>
            {profileSlug && (
              <a
                href={`/p/${profileSlug}#contact`}
                className="rounded-lg px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-90 sm:px-4 sm:text-sm"
                style={{ backgroundColor: accentColor, color: "#0a0a0a" }}
              >
                Get a Quote
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      {cover && (
        <div className="relative h-[45vw] min-h-[220px] max-h-[520px] overflow-hidden bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt={project.title as string} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 sm:px-8 sm:pb-8 lg:px-14 lg:pb-10">
            <h1 className="text-2xl font-semibold text-white sm:text-3xl lg:text-5xl lg:font-light leading-tight">
              {project.title as string}
            </h1>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-10">
        {/* Project meta */}
        <div className="mb-8 border-b border-gray-100 pb-6 sm:mb-10 sm:pb-8">
          {!cover && (
            <h1 className="mb-4 text-2xl font-light text-gray-900 sm:text-3xl">{project.title as string}</h1>
          )}
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 sm:gap-4">
            {project.category && (
              <span className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700">
                {project.category as string}
              </span>
            )}
            {project.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />{project.location as string}
              </span>
            )}
            {project.completion_date && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(project.completion_date as string).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
          {project.description && (
            <p className="mt-4 max-w-2xl text-sm text-gray-600 leading-relaxed sm:text-base sm:mt-5">
              {project.description as string}
            </p>
          )}
        </div>

        {/* Gallery — all photos (cover already shown as hero) */}
        {galleryMedia.length > 0 && (
          <div className="mb-10 sm:mb-12">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-gray-400">
              Photos · {media.length}
            </p>
            <div className="columns-2 gap-2 sm:columns-2 sm:gap-3 lg:columns-3 lg:gap-4">
              {galleryMedia.map((item, idx) => (
                <div key={item.id} className="mb-2 overflow-hidden rounded-lg sm:mb-3 sm:rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.public_url}
                    alt={item.caption ?? `Photo ${idx + 2}`}
                    className="w-full object-cover"
                    loading={idx < 4 ? "eager" : "lazy"}
                  />
                  {item.caption && (
                    <p className="mt-1 px-1 text-[10px] text-gray-400 sm:text-xs">{item.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Single photo — show it in gallery too if no cover was rendered */}
        {!cover && media.length === 1 && (
          <div className="mb-10 overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={media[0].public_url} alt={media[0].caption ?? project.title as string} className="w-full object-cover rounded-xl" />
          </div>
        )}

        {/* CTA */}
        {profileSlug && (
          <div
            className="rounded-2xl px-5 py-8 text-center sm:p-10"
            style={{ backgroundColor: `${accentColor}22` }}
          >
            <h2 className="mb-2 text-xl font-semibold text-gray-900 sm:mb-3 sm:text-2xl">
              Interested in a project like this?
            </h2>
            <p className="mb-5 text-sm text-gray-600 sm:mb-6 sm:text-base">
              Get a free quote from {client?.name ?? "us"} today.
            </p>
            <a
              href={`/p/${profileSlug}#contact`}
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90 sm:px-8 sm:py-4"
              style={{ backgroundColor: accentColor, color: "#0a0a0a" }}
            >
              Get a Free Quote
            </a>
          </div>
        )}
      </div>

      <footer className="border-t border-gray-100 py-6 sm:py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-gray-400 sm:px-6 sm:text-sm lg:px-10">
          {client?.name} &middot;{" "}
          <a href="https://cloud.leadstaq.tech" className="hover:text-gray-600">
            Powered by Leadstaq Cloud
          </a>
        </div>
      </footer>
    </div>
  );
}
