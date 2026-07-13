import type { SHELL_ICONS } from "./shell-icons";

export type AppShellNavItem = {
  href: string;
  label: string;
  icon: keyof typeof SHELL_ICONS;
  badge?: number;
  children?: AppShellNavItem[];
};

export type AppShellClientRow = {
  id: string;
  name: string;
  leadCount: number;
};
