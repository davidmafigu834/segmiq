"use client";

import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  UserCircle, CreditCard, Users, BarChart2,
  HelpCircle, MessageCircle, ChevronRight, LogOut,
} from "lucide-react";

type MenuItem = {
  icon: React.ElementType;
  label: string;
  description: string;
  href: string;
  external?: boolean;
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
        description: "How to use Segmiq Cloud",
        href: "/cloud/help",
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

  const F = "var(--fw-font-body), system-ui, sans-serif";
  const S = "var(--fw-font-display), Georgia, serif";

  return (
    <div style={{ minHeight: "100vh", background: "#F7F4EF", fontFamily: F, paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}>

      {/* Page header */}
      <div style={{ padding: "24px 20px 16px", background: "#F7F4EF" }}>
        <p style={{ fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8C7B6B", margin: "0 0 4px" }}>
          Menu
        </p>
        <h1 style={{ fontFamily: S, fontSize: 28, color: "#1C1410", margin: 0, lineHeight: 1.1 }}>
          More
        </h1>
      </div>

      {/* User card */}
      <div style={{ padding: "0 20px 20px" }}>
        <div style={{ background: "#1C1410", borderRadius: 20, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(212,255,79,0.15)", border: "0.5px solid rgba(212,255,79,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: F, fontSize: 14, fontWeight: 700, color: "#D4FF4F" }}>
            {getInitials(session?.user?.name ?? "")}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: S, fontSize: 16, color: "#FFFFFF", margin: "0 0 2px", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {session?.user?.name ?? "—"}
            </p>
            <p style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.45)", margin: 0, textTransform: "capitalize" }}>
              {session?.role === "CLIENT_MANAGER" ? "Manager" : (session?.role?.toLowerCase().replace("_", " ") ?? "")}
            </p>
          </div>
          <button
            onClick={() => router.push("/cloud/dashboard/settings")}
            style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            <ChevronRight size={14} color="rgba(255,255,255,0.5)" />
          </button>
        </div>
      </div>

      {/* Menu sections */}
      {menuSections.map((section) => (
        <div key={section.label} style={{ marginBottom: 24 }}>
          <p style={{ fontFamily: F, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8C7B6B", margin: "0 0 10px", padding: "0 20px" }}>
            {section.label}
          </p>
          <div style={{ margin: "0 20px", background: "#FFFFFF", borderRadius: 18, border: "0.5px solid rgba(28,20,16,0.08)", overflow: "hidden" }}>
            {section.items.map((item, index) => (
              <button
                key={item.label}
                onClick={() => {
                  if (item.external) {
                    window.open(item.href, "_blank");
                  } else {
                    router.push(item.href);
                  }
                }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "none", border: "none", borderBottom: index < section.items.length - 1 ? "0.5px solid rgba(28,20,16,0.06)" : "none", cursor: "pointer", textAlign: "left" }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "#F7F4EF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <item.icon size={18} color="#1C1410" strokeWidth={1.8} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: "#1C1410", margin: "0 0 2px", lineHeight: 1.2 }}>
                    {item.label}
                  </p>
                  <p style={{ fontFamily: F, fontSize: 11, color: "#8C7B6B", margin: 0, lineHeight: 1.3 }}>
                    {item.description}
                  </p>
                </div>
                <ChevronRight size={14} color="#B4A898" style={{ flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Sign out */}
      <div style={{ padding: "0 20px 32px" }}>
        <button
          onClick={() => void signOut({ callbackUrl: "/cloud/login" })}
          style={{ width: "100%", height: 52, background: "#FFFFFF", border: "0.5px solid rgba(232,96,44,0.25)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}
        >
          <LogOut size={16} color="#E8602C" />
          <span style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: "#E8602C" }}>
            Sign out
          </span>
        </button>
      </div>

      {/* App version */}
      <p style={{ textAlign: "center", fontFamily: F, fontSize: 11, color: "#B4A898", margin: "0 0 20px" }}>
        Segmiq Cloud · Version 1.0
      </p>

    </div>
  );
}
