"use client";

import { useEffect, useLayoutEffect } from "react";

/**
 * `useLayoutEffect` on the client, `useEffect` on the server. Runs before the
 * browser paints (so a measured correction lands without a visible flash),
 * while dodging React's warning that `useLayoutEffect` does nothing during
 * server rendering.
 */
export const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;
