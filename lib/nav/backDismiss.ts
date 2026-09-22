import { popOverlayEntry, pushOverlayEntry, type HistoryLike } from "./overlayHistory";

type WindowLike = {
  history: HistoryLike;
  addEventListener(type: "popstate", listener: () => void): void;
  removeEventListener(type: "popstate", listener: () => void): void;
};

// A detach's history pop waits one tick. React Strict Mode mounts effects as
// attach → detach → attach; an immediate history.back() there fired a popstate
// after the re-attach and closed a dialog that had just mounted open. A
// re-attach inside that tick cancels the pop and keeps the existing sentinel.
let pendingPop: ReturnType<typeof setTimeout> | null = null;

// Wires one open overlay to the back gesture. onClose is read through a getter
// at popstate time, so a re-render with a new inline onClose never needs a
// re-attach (which would pop history and close the overlay). Returns the detach.
export function attachBackDismiss(
  win: WindowLike,
  getOnClose: () => (() => void) | undefined,
  isNavigating: () => boolean,
): () => void {
  if (pendingPop !== null) {
    clearTimeout(pendingPop);
    pendingPop = null;
  } else {
    pushOverlayEntry(win.history);
  }

  const handlePopState = () => getOnClose()?.();
  win.addEventListener("popstate", handlePopState);

  return () => {
    win.removeEventListener("popstate", handlePopState);
    if (isNavigating()) return;
    pendingPop = setTimeout(() => {
      pendingPop = null;
      popOverlayEntry(win.history, { navigating: false });
    }, 0);
  };
}
