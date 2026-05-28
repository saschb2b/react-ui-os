"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { App, OsTheme, StorageAdapter } from "@react-ui-os/core";
import { createLocalStorageAdapter } from "@react-ui-os/core";

interface DesktopContextValue {
  apps: App[];
  appsById: Map<string, App>;
  theme: OsTheme;
  storage: StorageAdapter;
}

const DesktopContext = createContext<DesktopContextValue | null>(null);

export interface DesktopContextProviderProps {
  apps: App[];
  theme: OsTheme;
  /** Optional override. Defaults to a `localStorage`-backed adapter. */
  storage?: StorageAdapter;
  children: ReactNode;
}

export function DesktopContextProvider({
  apps,
  theme,
  storage,
  children,
}: DesktopContextProviderProps) {
  const value = useMemo<DesktopContextValue>(() => {
    const appsById = new Map<string, App>();
    for (const app of apps) appsById.set(app.id, app);
    return {
      apps,
      appsById,
      theme,
      storage: storage ?? createLocalStorageAdapter(),
    };
  }, [apps, theme, storage]);

  return (
    <DesktopContext.Provider value={value}>{children}</DesktopContext.Provider>
  );
}

export function useDesktopContext(): DesktopContextValue {
  const ctx = useContext(DesktopContext);
  if (!ctx) {
    throw new Error(
      "useDesktopContext must be used inside <Desktop> or <DesktopProvider>",
    );
  }
  return ctx;
}

export function useTheme(): OsTheme {
  return useDesktopContext().theme;
}

export function useApps(): App[] {
  return useDesktopContext().apps;
}

export function useApp(appId: string): App | undefined {
  return useDesktopContext().appsById.get(appId);
}
