import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  fetchProjectMagazineData,
  normalizeAppDomainUrl,
  resolveMagazineSlugForProject,
} from "@/lib/cloud/project-magazine";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { projectId: string };
}): Promise<Metadata> {
  const resolved = await resolveMagazineSlugForProject(params.projectId);
  if (!resolved) return { title: "Project | Segmiq" };

  try {
    const data = await fetchProjectMagazineData(resolved.slug, resolved.projectId);
    const title = `${data.project.title} — Case Study | ${data.client.name}`;
    const description =
      data.project.story_brief?.slice(0, 160) ??
      data.project.description?.slice(0, 160) ??
      undefined;
    const baseUrl = normalizeAppDomainUrl();
    const pageUrl = `${baseUrl}/p/${resolved.slug}/projects/${resolved.projectId}`;

    return {
      title,
      description,
      alternates: { canonical: pageUrl },
      openGraph: {
        title,
        description,
        url: pageUrl,
        siteName: "Segmiq",
        type: "article",
        images: data.coverUrl ? [{ url: data.coverUrl, alt: data.project.title }] : [],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: data.coverUrl ? [data.coverUrl] : [],
      },
    };
  } catch {
    return { title: "Project | Segmiq" };
  }
}

/** Legacy /cloud/share/{id} URLs redirect to the magazine case-study page. */
export default async function CloudSharePage({
  params,
}: {
  params: { projectId: string };
}) {
  const resolved = await resolveMagazineSlugForProject(params.projectId);
  if (!resolved) notFound();
  redirect(`/p/${resolved.slug}/projects/${resolved.projectId}`);
}
