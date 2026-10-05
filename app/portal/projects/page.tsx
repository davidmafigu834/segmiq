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
      <h1 className="text-[2rem] font-semibold leading-tight">Projects</h1>
      {projects.length ? (
        <ul className="mt-6 divide-y divide-sales-border">
          {projects.map((project) => (
            <li key={project.id}>
              <Link href={`/portal/projects/${project.id}`} className="block py-5">
                <p className="text-[1.25rem] font-semibold">{project.title}</p>
                <p className="mt-1 text-[16px]">{project.stage}</p>
                {project.site ? <p className="mt-1 text-[15px] text-sales-text-secondary">{project.site}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-[16px] text-sales-text-secondary">No projects are available yet.</p>
      )}
    </PortalFrame>
  );
}
