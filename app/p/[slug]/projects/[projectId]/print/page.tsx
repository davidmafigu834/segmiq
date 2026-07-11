import { fetchProjectMagazineData } from "@/lib/cloud/project-magazine";
import {
  generatePrintQrDataUrl,
  ProjectMagazinePrint,
} from "@/components/profile/project-magazine/ProjectMagazinePrint";

export const dynamic = "force-dynamic";

export default async function ProjectMagazinePrintPage({
  params,
}: {
  params: { slug: string; projectId: string };
}) {
  const data = await fetchProjectMagazineData(params.slug, params.projectId);
  const qrDataUrl = await generatePrintQrDataUrl(data.livePageUrl);
  return <ProjectMagazinePrint data={data} qrDataUrl={qrDataUrl} />;
}
