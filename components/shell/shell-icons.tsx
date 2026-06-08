import type { LucideIcon } from "lucide-react";
import {
  Archive,
  BarChart3,
  Building2,
  Calendar,
  Camera,
  Clock,
  Cloud,
  FileText,
  Globe,
  Home,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  LayoutTemplate,
  Megaphone,
  Receipt,
  Settings,
  Trophy,
  User,
  Users,
} from "lucide-react";

export const SHELL_ICONS: Record<string, LucideIcon> = {
  home: Home,
  inbox: Inbox,
  building2: Building2,
  megaphone: Megaphone,
  receipt: Receipt,
  "bar-chart-3": BarChart3,
  settings: Settings,
  users: Users,
  "layout-grid": LayoutGrid,
  "layout-dashboard": LayoutDashboard,
  "layout-template": LayoutTemplate,
  clock: Clock,
  archive: Archive,
  calendar: Calendar,
  trophy: Trophy,
  user: User,
  camera: Camera,
  globe: Globe,
  cloud: Cloud,
  "file-text": FileText,
};

export function ShellIcon({
  name,
  className,
}: {
  name: keyof typeof SHELL_ICONS;
  className?: string;
}) {
  const Icon = SHELL_ICONS[name] ?? Home;
  return <Icon className={className} strokeWidth={1.5} aria-hidden />;
}
