"use client";

import { useCallback, useSyncExternalStore } from "react";

import { setHideValues, subscribeHideValues } from "./privacy";

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// The <html data-privacy> attribute (set before paint by the boot script) is
// the source of truth; the server snapshot is "off" so hydration never mismatches.
export function usePrivacyMode(): [on: boolean, setOn: (next: boolean) => void] {
  const on = useSyncExternalStore(
    subscribeHideValues,
    () => document.documentElement.dataset.privacy === "on",
    () => false,
  );
  const setOn = useCallback((next: boolean) => {
    setHideValues(next, { storage: safeLocalStorage(), root: document.documentElement });
  }, []);
  return [on, setOn];
}
