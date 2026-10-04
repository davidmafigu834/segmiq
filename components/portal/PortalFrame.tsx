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
    { id: "assets", href: "/portal/assets", label: "My System" },
    { id: "documents", href: "/portal/documents", label: "Documents" },
    { id: "support", href: "/portal/support", label: "Support" },
  ] as const;

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#1a1f1c]">
      <header className="mx-auto flex max-w-lg items-center justify-between gap-4 px-5 pb-2 pt-6">
        <div className="flex min-w-0 items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0f6b4c] text-sm font-semibold text-white">
              {companyName.slice(0, 1)}
            </span>
          )}
          <p className="truncate text-sm font-semibold tracking-tight">{companyName}</p>
        </div>
        <LogoutButton />
      </header>
      <main className="mx-auto max-w-lg px-5 pb-8 pt-4">{children}</main>
      <p className="pb-20 text-center text-[11px] tracking-wide text-[#8a918c]">Powered by SegmiQ</p>
      <nav className="fixed inset-x-0 bottom-0 border-t border-[#e4ddd0] bg-[#fbf9f4]/95 backdrop-blur">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {links.map((link) => (
            <li key={link.id}>
              <Link
                href={link.href}
                className={`flex min-h-14 items-center justify-center px-1 text-center text-[11px] font-medium ${
                  active === link.id ? "text-[#0f6b4c]" : "text-[#5c665f]"
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
