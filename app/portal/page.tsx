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
      <h1 className="text-4xl font-semibold tracking-tight">{greeting(identity.name)}</h1>
      <p className="mt-3 text-base text-[#5c665f]">Your projects with {identity.companyName}.</p>
      <div className="mt-8 space-y-3">
        {projects.length ? projects.map((project) => (
          <Link key={project.id} href={`/portal/projects/${project.id}`} className="block rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-lg font-semibold">{project.title}</p>
            <p className="mt-1 text-sm text-[#0f6b4c]">{project.stage}</p>
            <p className="mt-3 text-sm text-[#5c665f]">{project.nextStep}</p>
          </Link>
        )) : (
          <p className="rounded-3xl bg-white p-5 text-sm text-[#5c665f]">No projects are available on this portal yet.</p>
        )}
      </div>
    </PortalFrame>
  );
}
