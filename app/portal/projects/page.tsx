import Link from "next/link";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { requirePortal } from "@/lib/portal/page";
import { listPortalProjects } from "@/lib/portal/service";

export const dynamic = "force-dynamic";

export default async function PortalProjectsPage() {
  const identity = await requirePortal();
  const projects = await listPortalProjects(identity.clientId, identity.contactId, identity.settings);
  return (
    <PortalFrame companyName={identity.companyName} logoUrl={identity.logoUrl} active="projects">
      <h1 className="text-4xl font-semibold tracking-tight">Projects</h1>
      <div className="mt-8 space-y-3">
        {projects.map((project) => (
          <Link key={project.id} href={`/portal/projects/${project.id}`} className="block rounded-3xl bg-white p-5">
            <p className="text-lg font-semibold">{project.title}</p>
            <p className="mt-1 text-sm text-[#0f6b4c]">{project.stage}</p>
            {project.site ? <p className="mt-2 text-sm text-[#5c665f]">{project.site}</p> : null}
          </Link>
        ))}
      </div>
    </PortalFrame>
  );
}
