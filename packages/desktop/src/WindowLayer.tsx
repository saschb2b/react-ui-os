"use client";

import { useWindowManager } from "@react-ui-os/core";
import { Window } from "./Window";

/**
 * Compositor: renders one absolutely-positioned <Window> per open WM entry.
 * z-index ordering comes from each window's `z` so click-to-focus naturally
 * lifts the right one to the top.
 */
export function WindowLayer() {
  const { windows } = useWindowManager();
  return (
    <>
      {windows.map((win) => (
        <Window key={win.id} win={win} />
      ))}
    </>
  );
}
