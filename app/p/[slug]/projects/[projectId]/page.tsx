import type { Metadata } from "next";
import { fetchProjectMagazineData, normalizeAppDomainUrl } from "@/lib/cloud/project-magazine";
import { ProjectMagazineScreen } from "@/components/profile/project-magazine/ProjectMagazineScreen";

export const dynamic = "force-dynamic";

function getMetadataBase(): URL {
  return new URL(normalizeAppDomainUrl());
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string; projectId: string };
}): Promise<Metadata> {
  const metadataBase = getMetadataBase();
  try {
    const data = await fetchProjectMagazineData(params.slug, params.projectId);
    const title = `${data.project.title} — Case Study | ${data.client.name}`;
    const description =
      data.project.story_brief?.slice(0, 160) ??
      data.project.description?.slice(0, 160) ??
      undefined;
    return {
      metadataBase,
      title,
      description,
      openGraph: {
        title,
        description,
        type: "article",
        images: data.coverUrl ? [{ url: data.coverUrl, alt: data.project.title }] : [],
      },
    };
  } catch {
    return { title: "Segmiq", metadataBase };
  }
}

export default async function ProjectMagazinePage({
  params,
}: {
  params: { slug: string; projectId: string };
}) {
  const data = await fetchProjectMagazineData(params.slug, params.projectId);
  return <ProjectMagazineScreen data={data} />;
}
