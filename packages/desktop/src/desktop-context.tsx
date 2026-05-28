"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  App,
  OsTheme,
  SettingsPrefs,
  StorageAdapter,
} from "@react-ui-os/core";
import { applyPrefs, createLocalStorageAdapter } from "@react-ui-os/core";

interface DesktopContextValue {
  apps: App[];
  appsById: Map<string, App>;
  /** Theme as declared by the consumer, before any user prefs are layered on. */
  baseTheme: OsTheme;
  /** The effective theme: defaults overlaid with the user's stored prefs. */
  theme: OsTheme;
  storage: StorageAdapter;
  /** Stored user-pref overlay. Keys are the same dotted paths as `theme.customizable`. */
  prefs: SettingsPrefs;
  setPref: (path: string, value: unknown) => void;
  resetPref: (path: string) => void;
  resetAllPrefs: () => void;
}

const DesktopContext = createContext<DesktopContextValue | null>(null);

export interface DesktopContextProviderProps {
  apps: App[];
  theme: OsTheme;
  /** Optional override. Defaults to a `localStorage`-backed adapter. */
  storage?: StorageAdapter;
  children: ReactNode;
}

function prefsKey(themeId: string): string {
  return `settings:${themeId}`;
}

function readStoredPrefs(
  storage: StorageAdapter,
  themeId: string,
): SettingsPrefs {
  const raw = storage.get<SettingsPrefs>(prefsKey(themeId));
  return raw && typeof raw === "object" ? raw : {};
}

export function DesktopContextProvider({
  apps,
  theme: baseTheme,
  storage: storageProp,
  children,
}: DesktopContextProviderProps) {
  // Single storage instance for the life of the provider.
  const storage = useMemo<StorageAdapter>(
    () => storageProp ?? createLocalStorageAdapter(),
    [storageProp],
  );

  const [prefs, setPrefs] = useState<SettingsPrefs>(() =>
    readStoredPrefs(storage, baseTheme.id),
  );

  // Re-read prefs whenever the base theme changes (so a build-time theme
  // switch picks up its own stored prefs) or the storage backend changes.
  useEffect(() => {
    setPrefs(readStoredPrefs(storage, baseTheme.id));
  }, [storage, baseTheme.id]);

  // Subscribe to cross-tab and in-tab pref updates.
  useEffect(() => {
    const unsubscribe = storage.subscribe((key) => {
      if (key === prefsKey(baseTheme.id)) {
        setPrefs(readStoredPrefs(storage, baseTheme.id));
      }
    });
    return unsubscribe;
  }, [storage, baseTheme.id]);

  const writePrefs = useCallback(
    (next: SettingsPrefs) => {
      storage.set(prefsKey(baseTheme.id), next);
      setPrefs(next);
    },
    [storage, baseTheme.id],
  );

  const setPref = useCallback(
    (path: string, value: unknown) => {
      writePrefs({ ...prefs, [path]: value });
    },
    [prefs, writePrefs],
  );

  const resetPref = useCallback(
    (path: string) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [path]: _omit, ...rest } = prefs;
      writePrefs(rest);
    },
    [prefs, writePrefs],
  );

  const resetAllPrefs = useCallback(() => {
    writePrefs({});
  }, [writePrefs]);

  const theme = useMemo<OsTheme>(
    () => applyPrefs(baseTheme, prefs),
    [baseTheme, prefs],
  );

  const value = useMemo<DesktopContextValue>(() => {
    const appsById = new Map<string, App>();
    for (const app of apps) appsById.set(app.id, app);
    return {
      apps,
      appsById,
      baseTheme,
      theme,
      storage,
      prefs,
      setPref,
      resetPref,
      resetAllPrefs,
    };
  }, [apps, baseTheme, theme, storage, prefs, setPref, resetPref, resetAllPrefs]);

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

/** Effective theme: declared theme overlaid with user prefs. */
export function useTheme(): OsTheme {
  return useDesktopContext().theme;
}

/** Theme as declared by the consumer, before user prefs. Use sparingly. */
export function useBaseTheme(): OsTheme {
  return useDesktopContext().baseTheme;
}

export function useApps(): App[] {
  return useDesktopContext().apps;
}

export function useApp(appId: string): App | undefined {
  return useDesktopContext().appsById.get(appId);
}

export interface UseSettingsResult {
  /** The active theme's customizable schema. Empty record when undeclared. */
  schema: NonNullable<OsTheme["customizable"]>;
  /** Current user pref values keyed by the same paths. */
  prefs: SettingsPrefs;
  /** Set one pref value. Triggers immediate re-render across the desktop. */
  setPref: (path: string, value: unknown) => void;
  /** Remove a single pref so the field falls back to the theme default. */
  resetPref: (path: string) => void;
  /** Clear every stored pref for the active theme. */
  resetAll: () => void;
}

export function useSettings(): UseSettingsResult {
  const { theme, baseTheme, prefs, setPref, resetPref, resetAllPrefs } =
    useDesktopContext();
  // Resolve the schema from the base theme so removing a customizable field
  // hides it immediately, regardless of stored prefs.
  void theme;
  return {
    schema: baseTheme.customizable ?? {},
    prefs,
    setPref,
    resetPref,
    resetAll: resetAllPrefs,
  };
}
