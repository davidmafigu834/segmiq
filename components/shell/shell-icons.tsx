import type { LucideIcon } from "lucide-react";
import {
  Archive,
  BarChart3,
  Building2,
  Calendar,
  Camera,
  Clock,
  Cloud,
  Globe,
  Home,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  LayoutTemplate,
  Megaphone,
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
