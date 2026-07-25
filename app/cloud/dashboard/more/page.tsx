"use client";

import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  UserCircle, CreditCard, Users, BarChart2,
  HelpCircle, MessageCircle, ChevronRight, LogOut, Tag,
} from "lucide-react";
import { isCloudAdminRole } from "@/lib/auth/roles";
import { CloudPage } from "@/app/cloud/components/CloudPage";

type MenuItem = {
  icon: React.ElementType;
  label: string;
  description: string;
  href: string;
  external?: boolean;
  download?: boolean;
};

type MenuSection = {
  label: string;
  items: MenuItem[];
};

const menuSections: MenuSection[] = [
  {
    label: "Account",
    items: [
      {
        icon: UserCircle,
        label: "Profile & Settings",
        description: "Name, password, logo, business info",
        href: "/cloud/dashboard/settings",
      },
      {
        icon: CreditCard,
        label: "Billing & Plan",
        description: "Current plan, upgrade, payment history",
        href: "/cloud/dashboard/billing",
      },
    ],
  },
  {
    label: "Business",
    items: [
      {
        icon: Tag,
        label: "Pricing",
        description: "Manage packages on your public profile",
        href: "/cloud/dashboard/pricing",
      },
      {
        icon: Users,
        label: "Team",
        description: "Invite and manage your team members",
        href: "/cloud/dashboard/team",
      },
      {
        icon: BarChart2,
        label: "Analytics",
        description: "Project views, storage usage, performance",
        href: "/cloud/dashboard/analytics",
      },
    ],
  },
  {
    label: "Support",
    items: [
      {
        icon: HelpCircle,
        label: "Help & FAQ",
        description: "How to use SegmiQ Cloud",
        href: "/cloud/dashboard/help",
      },
      {
        icon: MessageCircle,
        label: "Contact support",
        description: "Chat with us on WhatsApp",
        href: "https://wa.me/27000000000",
        external: true,
      },
    ],
  },
];

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return "LC";
}

export default function MorePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isCloudAdmin = isCloudAdminRole(session?.role);

  const visibleSections = menuSections
    .map((section) => ({
      ...section,
      items: section.items.filter(() => {
        if (isCloudAdmin) return true;
        return section.label === "Support";
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <CloudPage>
      <div className="cloud-card--ink cloud-card mb-6 flex items-center gap-3.5 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[rgba(212,255,79,0.3)] bg-[rgba(212,255,79,0.12)] text-[13px] font-bold text-[var(--cloud-accent)]">
          {getInitials(session?.user?.name ?? "")}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-cloud-display text-[18px] text-white">
            {session?.user?.name ?? "—"}
          </p>
          <p className="text-[11px] capitalize text-white/45">
            {session?.role === "CLIENT_MANAGER" ? "Manager" : (session?.role?.toLowerCase().replace("_", " ") ?? "")}
          </p>
        </div>
        {isCloudAdmin && (
          <button
            type="button"
            onClick={() => router.push("/cloud/dashboard/settings")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/8"
          >
            <ChevronRight size={14} className="text-white/50" />
          </button>
        )}
      </div>

      {visibleSections.map((section) => (
        <div key={section.label} className="mb-6">
          <p className="cloud-section-label px-0.5">{section.label}</p>
          <div className="cloud-card overflow-hidden">
            {section.items.map((item, index) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  if (item.download) {
                    window.location.href = item.href;
                  } else if (item.external) {
                    window.open(item.href, "_blank");
                  } else {
                    router.push(item.href);
                  }
                }}
                className={`flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-[var(--cloud-surface-hover)] ${
                  index < section.items.length - 1 ? "border-b border-[var(--cloud-border)]" : ""
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--cloud-surface-muted)]">
                  <item.icon size={18} className="text-[var(--cloud-text-primary)]" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-[var(--cloud-text-primary)]">
                    {item.label}
                  </p>
                  <p className="text-[11px] text-[var(--cloud-text-tertiary)]">
                    {item.description}
                  </p>
                </div>
                <ChevronRight size={14} className="shrink-0 text-[var(--cloud-text-tertiary)]" />
              </button>
            ))}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => void signOut({ callbackUrl: "/cloud/login" })}
        className="cloud-card mb-6 flex h-[52px] w-full items-center justify-center gap-2 border-red-200/70 text-[14px] font-bold text-[var(--cloud-danger)]"
      >
        <LogOut size={16} />
        Sign out
      </button>

      <p className="pb-2 text-center text-[11px] text-[var(--cloud-text-tertiary)]">
        SegmiQ Cloud · Version 1.0
      </p>
    </CloudPage>
  );
}
