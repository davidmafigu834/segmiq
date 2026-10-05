import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { greeting } from "@/components/portal/format";
import { requirePortal } from "@/lib/portal/page";
import { listPortalProjects } from "@/lib/portal/service";

export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  const identity = await requirePortal();
  const projects = await listPortalProjects(identity.clientId, identity.contactId, identity.settings);
  if (projects.length === 1) redirect(`/portal/projects/${projects[0].id}`);
  return (
    <PortalFrame companyName={identity.companyName} logoUrl={identity.logoUrl} active="home">
      <h1 className="text-[2rem] font-semibold leading-tight">{greeting(identity.name)}</h1>
      <p className="mt-3 text-[16px] text-sales-text-secondary">Your projects with {identity.companyName}.</p>
      {projects.length ? (
        <ul className="mt-8 divide-y divide-sales-border">
          {projects.map((project) => (
            <li key={project.id}>
              <Link href={`/portal/projects/${project.id}`} className="block py-5">
                <p className="text-[1.25rem] font-semibold">{project.title}</p>
                <p className="mt-1 text-[16px]">{project.stage}</p>
                <p className="mt-2 text-[15px] text-sales-text-secondary">{project.nextStep}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-[16px] text-sales-text-secondary">No projects are available on this portal yet.</p>
      )}
    </PortalFrame>
  );
}
