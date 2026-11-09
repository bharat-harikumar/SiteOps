// "Hide amounts" demo mode (admin only). Purely presentational: every rupee
// figure renders through <Amount> (components/ui/Amount.tsx), and CSS in
// app/globals.css swaps it for "₹ ****" while <html data-privacy="on"> is set
// AND it sits inside AppShell's Admin-only [data-privacy-scope]. Real values
// stay in the DOM — this is for over-the-shoulder demos, not a security boundary.

export const HIDE_VALUES_KEY = "siteops:hide-values";

export function readHideValues(storage: Pick<Storage, "getItem"> | null | undefined): boolean {
  try {
    return storage?.getItem(HIDE_VALUES_KEY) === "1";
  } catch {
    return false; // Storage blocked (private mode, disabled site data).
  }
}

export function writeHideValues(
  storage: Pick<Storage, "setItem" | "removeItem"> | null | undefined,
  on: boolean,
): void {
  try {
    if (on) storage?.setItem(HIDE_VALUES_KEY, "1");
    else storage?.removeItem(HIDE_VALUES_KEY);
  } catch {
    // Preference just won't survive a reload; the current page still updates.
  }
}

export function applyHideValues(root: { dataset: DOMStringMap }, on: boolean): void {
  if (on) root.dataset.privacy = "on";
  else delete root.dataset.privacy;
}

// Inlined in <head> so the preference applies before first paint — reading it
// in a React effect would flash real values on every reload.
export const HIDE_VALUES_BOOT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(
  HIDE_VALUES_KEY,
)})==="1")document.documentElement.dataset.privacy="on"}catch(e){}`;

// Tiny external store so the Profile toggle re-renders when the value changes.
const listeners = new Set<() => void>();

export function subscribeHideValues(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setHideValues(
  on: boolean,
  env: {
    storage: Pick<Storage, "setItem" | "removeItem"> | null | undefined;
    root: { dataset: DOMStringMap };
  },
): void {
  writeHideValues(env.storage, on);
  applyHideValues(env.root, on);
  listeners.forEach((listener) => listener());
}
