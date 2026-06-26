import { createContext, useContext, type ReactNode } from "react";

type AppHeaderContextValue = {
  userName: string;
  unreadCount: number;
  showActions: boolean;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
};

const AppHeaderContext = createContext<AppHeaderContextValue | null>(null);

export function AppHeaderProvider({
  value,
  children,
}: {
  value: AppHeaderContextValue;
  children: ReactNode;
}) {
  return <AppHeaderContext.Provider value={value}>{children}</AppHeaderContext.Provider>;
}

export function useAppHeader(): AppHeaderContextValue | null {
  return useContext(AppHeaderContext);
}
