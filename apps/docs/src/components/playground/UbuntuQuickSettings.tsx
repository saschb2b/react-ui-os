import { useEffect, useState } from "react";
import { useWindowManager } from "@react-ui-os/core";
import {
  nextCascadeIndex,
  pickInitialBounds,
  registerQuickSetting,
  useApps,
  useTheme,
} from "@react-ui-os/desktop";

const I = 16;

function SpeakerIcon() {
  return (
    <svg
      width={I}
      height={I}
      viewBox="0 0 16 16"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinejoin="round"
    >
      <path d="M3 6h3l4-3v10l-4-3H3z" fill="currentColor" stroke="none" />
      <path d="M11.5 6c1 1.3 1 2.7 0 4" strokeLinecap="round" />
    </svg>
  );
}
function SignalIcon() {
  return (
    <svg width={I} height={I} viewBox="0 0 16 16" aria-hidden fill="currentColor">
      <rect x="1.5" y="10" width="2.5" height="4" rx="0.6" />
      <rect x="5.5" y="7" width="2.5" height="7" rx="0.6" />
      <rect x="9.5" y="3.5" width="2.5" height="10.5" rx="0.6" />
    </svg>
  );
}
function GaugeIcon() {
  // A speedometer, the GNOME power-mode mark.
  return (
    <svg
      width={I}
      height={I}
      viewBox="0 0 16 16"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
    >
      <path d="M2.6 11.5a5.5 5.5 0 0 1 10.8 0" />
      <path d="M8 11.5 11 7" />
      <circle cx="8" cy="11.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
function ContrastIcon() {
  // A circle with one half filled, the GNOME dark-style mark.
  return (
    <svg width={I} height={I} viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth={1.2} />
      <path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" />
    </svg>
  );
}
function BellOffIcon() {
  return (
    <svg
      width={I}
      height={I}
      viewBox="0 0 16 16"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinejoin="round"
    >
      <path d="M4.5 7a3.5 3.5 0 0 1 7 0c0 3 1.5 4 1.5 4h-10S4.5 10 4.5 7z" />
      <path d="M6.5 13.5a1.6 1.6 0 0 0 3 0" strokeLinecap="round" />
      <path d="M2.5 2.5l11 11" strokeLinecap="round" />
    </svg>
  );
}
function CameraIcon() {
  return (
    <svg
      width={I}
      height={I}
      viewBox="0 0 16 16"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinejoin="round"
    >
      <rect x="1.5" y="4.5" width="13" height="9" rx="1.6" />
      <circle cx="8" cy="9" r="2.4" />
      <path d="M5.5 4.5 6.6 2.8h2.8l1.1 1.7" />
    </svg>
  );
}
function SlidersIcon() {
  return (
    <svg
      width={I}
      height={I}
      viewBox="0 0 16 16"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
    >
      <line x1="2" y1="5" x2="14" y2="5" />
      <circle cx="6" cy="5" r="1.7" fill="currentColor" stroke="none" />
      <line x1="2" y1="11" x2="14" y2="11" />
      <circle cx="10.5" cy="11" r="1.7" fill="currentColor" stroke="none" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg
      width={I}
      height={I}
      viewBox="0 0 16 16"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinejoin="round"
    >
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.4" />
      <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" />
    </svg>
  );
}
function PowerIcon() {
  return (
    <svg
      width={I}
      height={I}
      viewBox="0 0 16 16"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
    >
      <path d="M8 2v6" />
      <path d="M4.8 4.2a5 5 0 1 0 6.4 0" />
    </svg>
  );
}

/**
 * Demo Quick Settings content for the Ubuntu theme, mirroring the GNOME
 * system menu: a volume slider, a row of action buttons, and a grid of
 * toggle tiles. Each control is registered with its own effect so dragging
 * the slider re-registers only that one entry, never blanking the panel.
 * Rendered as a Desktop child so it can open the Settings window.
 */
export function UbuntuQuickSettings() {
  const { state, openWindow } = useWindowManager();
  const apps = useApps();
  const theme = useTheme();

  const [volume, setVolume] = useState(0.72);
  const [wired, setWired] = useState(true);
  const [powerSaver, setPowerSaver] = useState(false);
  const [dark, setDark] = useState(true);
  const [dnd, setDnd] = useState(false);

  const openSettings = () => {
    const payload = { kind: "system" as const, systemId: "settings" };
    openWindow(
      payload,
      pickInitialBounds(payload, theme, apps, undefined, nextCascadeIndex(state)),
    );
  };

  useEffect(() => {
    const unsubs = [
      registerQuickSetting({
        kind: "action",
        id: "qs-screenshot",
        icon: <CameraIcon />,
        tooltip: "Take Screenshot",
        align: "start",
        order: 1,
      }),
      registerQuickSetting({
        kind: "action",
        id: "qs-settings",
        icon: <SlidersIcon />,
        tooltip: "Settings",
        align: "start",
        order: 2,
        onClick: openSettings,
      }),
      registerQuickSetting({
        kind: "action",
        id: "qs-lock",
        icon: <LockIcon />,
        tooltip: "Lock Screen",
        align: "end",
        order: 1,
      }),
      registerQuickSetting({
        kind: "action",
        id: "qs-power",
        icon: <PowerIcon />,
        tooltip: "Power Off / Log Out",
        align: "end",
        order: 2,
      }),
    ];
    return () => {
      for (const u of unsubs) u();
    };
    // openSettings closes over fresh state/apps/theme each render; the action
    // buttons themselves never change, so registering once is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () =>
      registerQuickSetting({
        kind: "slider",
        id: "qs-volume",
        ariaLabel: "Volume",
        icon: <SpeakerIcon />,
        value: volume,
        onChange: setVolume,
        order: 1,
      }),
    [volume],
  );

  useEffect(
    () =>
      registerQuickSetting({
        kind: "toggle",
        id: "qs-wired",
        label: "Wired",
        sublabel: wired ? "Connected" : "Off",
        icon: <SignalIcon />,
        active: wired,
        onToggle: setWired,
        onExpand: () => undefined,
        order: 1,
      }),
    [wired],
  );

  useEffect(
    () =>
      registerQuickSetting({
        kind: "toggle",
        id: "qs-power-mode",
        label: "Power Mode",
        sublabel: powerSaver ? "Power Saver" : "Balanced",
        icon: <GaugeIcon />,
        active: powerSaver,
        onToggle: setPowerSaver,
        order: 2,
      }),
    [powerSaver],
  );

  useEffect(
    () =>
      registerQuickSetting({
        kind: "toggle",
        id: "qs-dark",
        label: "Dark Style",
        icon: <ContrastIcon />,
        active: dark,
        onToggle: setDark,
        order: 3,
      }),
    [dark],
  );

  useEffect(
    () =>
      registerQuickSetting({
        kind: "toggle",
        id: "qs-dnd",
        label: "Do Not Disturb",
        icon: <BellOffIcon />,
        active: dnd,
        onToggle: setDnd,
        order: 4,
      }),
    [dnd],
  );

  return null;
}
