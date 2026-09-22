"use client";

import { useEffect, useRef, type RefObject } from "react";

import { attachBackDismiss } from "./backDismiss";

type Options = {
  /**
   * Set by overlays that close *because* they are navigating (the search
   * overlay closing on a result tap). Teardown then leaves the router's new
   * history entry alone instead of popping it back off.
   */
  navigatingRef?: RefObject<boolean>;
};

/**
 * Make the phone's back gesture close an overlay instead of leaving the page.
 *
 * On a touch device the back gesture is the only dismiss affordance a user has
 * — Escape is keyboard-only, and reaching for a small × in a corner is not what
 * anyone does first. Every full-screen surface therefore pushes a sentinel
 * history entry while it is open, so back pops the sentinel (dismissing the
 * overlay) rather than navigating the page away underneath it.
 *
 * The sentinel is popped again on teardown, but only when it is still the
 * current entry — a real popstate has already consumed it — so this never eats
 * an unrelated history entry. See overlayHistory.ts.
 */
export function useBackDismiss(
  open: boolean,
  onClose: (() => void) | undefined,
  { navigatingRef }: Options = {},
): void {
  // Latest onClose via a ref: the effect must depend on `open` only, or every
  // re-render with a new inline onClose re-attaches and closes the overlay.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const hasOnClose = Boolean(onClose);

  useEffect(() => {
    if (!open || !hasOnClose) return undefined;
    if (typeof window === "undefined") return undefined;

    if (navigatingRef) navigatingRef.current = false;
    return attachBackDismiss(
      window,
      () => onCloseRef.current,
      () => navigatingRef?.current ?? false,
    );
  }, [open, hasOnClose, navigatingRef]);
}
