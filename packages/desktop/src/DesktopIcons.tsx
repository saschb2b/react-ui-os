"use client";

import { useEffect, useState } from "react";
import { useWindowManager } from "@react-ui-os/core";
import { useDesktopContext, useTheme } from "./desktop-context";
import { FolderSvg } from "./folder-svg";
import {
  listSystemWindows,
  type SystemWindowDef,
} from "./system-windows";
import { MENU_BAR_HEIGHT } from "./util/layout";

interface VisibleIcon {
  systemId: string;
  def: SystemWindowDef;
}

const ICON_TILE = 56;
const ICON_LABEL_GAP = 4;
const ICON_GAP = 18;
const EDGE_INSET = 14;

/**
 * Right-edge column of file-style desktop shortcuts. Renders one icon per
 * system window whose `appearsAsDesktopIcon` evaluates to true. Predicates
 * are re-checked whenever the storage adapter fires a change event, so a
 * Downloads or Presets folder appears the moment the user creates the
 * first item and disappears when they delete the last one.
 */
export function DesktopIcons() {
  const theme = useTheme();
  const { storage } = useDesktopContext();
  const { openWindow } = useWindowManager();
  const [visible, setVisible] = useState<VisibleIcon[]>(() =>
    computeVisible(storage),
  );

  useEffect(() => {
    const recompute = () => {
      setVisible(computeVisible(storage));
    };
    recompute();
    const unsubscribe = storage.subscribe(() => {
      recompute();
    });
    return unsubscribe;
  }, [storage]);

  if (visible.length === 0) return null;

  const topInset =
    (theme.chrome.menuBar === "top" ? MENU_BAR_HEIGHT : 0) + EDGE_INSET;

  return (
    <div
      aria-label="Desktop icons"
      style={{
        position: "fixed",
        top: topInset,
        right: EDGE_INSET,
        display: "flex",
        flexDirection: "column",
        gap: ICON_GAP,
        zIndex: 1,
      }}
    >
      {visible.map(({ systemId, def }) => (
        <DesktopShortcut
          key={systemId}
          systemId={systemId}
          def={def}
          onOpen={() => {
            openWindow({ kind: "system", systemId });
          }}
        />
      ))}
    </div>
  );
}

function DesktopShortcut({
  systemId,
  def,
  onOpen,
}: {
  systemId: string;
  def: SystemWindowDef;
  onOpen: () => void;
}) {
  const theme = useTheme();
  const Icon = def.desktopIcon ?? FolderSvg;
  return (
    <button
      type="button"
      onDoubleClick={onOpen}
      onClick={(e) => {
        // Single click selects; double click opens. Match macOS desktop
        // behavior. For now there is no selection model on the desktop, so
        // single click just gives a brief visual press.
        e.currentTarget.blur();
      }}
      data-desktop-icon-id={systemId}
      title={def.name}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: ICON_LABEL_GAP,
        width: ICON_TILE,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        color: theme.palette.textPrimary,
        fontFamily: "inherit",
        padding: 0,
      }}
    >
      <div
        style={{
          width: ICON_TILE,
          height: ICON_TILE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={Math.round(ICON_TILE * 0.85)} />
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          textShadow: "0 1px 3px rgba(0,0,0,0.6)",
          whiteSpace: "nowrap",
          maxWidth: ICON_TILE + 24,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {def.name}
      </span>
    </button>
  );
}

function computeVisible(
  storage: ReturnType<typeof useDesktopContext>["storage"],
): VisibleIcon[] {
  return listSystemWindows()
    .filter((entry) => {
      const cond = entry.appearsAsDesktopIcon;
      if (cond === undefined || cond === false) return false;
      if (cond === true) return true;
      try {
        return cond(storage);
      } catch {
        return false;
      }
    })
    .map(({ systemId, ...def }) => ({ systemId, def }));
}
