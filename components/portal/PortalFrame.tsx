import Link from "next/link";
import { LogoutButton } from "@/components/portal/PortalActions";

export function PortalFrame({
  companyName,
  logoUrl,
  active,
  children,
}: {
  companyName: string;
  logoUrl: string | null;
  active: "home" | "projects" | "assets" | "documents" | "support";
  children: React.ReactNode;
}) {
  const links = [
    { id: "home", href: "/portal", label: "Home" },
    { id: "projects", href: "/portal/projects", label: "Projects" },
    { id: "assets", href: "/portal/assets", label: "System" },
    { id: "documents", href: "/portal/documents", label: "Files" },
    { id: "support", href: "/portal/support", label: "Support" },
  ] as const;

  return (
    <div className="min-h-screen bg-sales-surface text-sales-text-primary">
      <header className="mx-auto flex max-w-lg items-center justify-between gap-4 px-5 pb-2 pt-6">
        <div className="flex min-w-0 items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sales-text-primary text-sm font-semibold text-white">
              {companyName.slice(0, 1)}
            </span>
          )}
          <p className="truncate text-[15px] font-semibold">{companyName}</p>
        </div>
        <LogoutButton />
      </header>
      <main className="mx-auto max-w-lg px-5 pb-28 pt-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-sales-border bg-sales-surface" aria-label="Portal">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {links.map((link) => {
            const selected = active === link.id;
            return (
              <li key={link.id}>
                <Link
                  href={link.href}
                  aria-current={selected ? "page" : undefined}
                  className={`flex min-h-14 items-center justify-center whitespace-nowrap border-t-2 px-1 text-[13px] font-semibold ${
                    selected ? "border-segmiq-lime text-sales-text-primary" : "border-transparent text-sales-text-secondary"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
