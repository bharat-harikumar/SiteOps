import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { attachBackDismiss } from "./backDismiss";

function fakeWindow() {
  const listeners = new Set<() => void>();
  const back = vi.fn();
  const history = {
    state: null as unknown,
    pushState(state: unknown) {
      history.state = state;
    },
    back,
  };
  return {
    win: {
      history,
      addEventListener: (_: "popstate", fn: () => void) => listeners.add(fn),
      removeEventListener: (_: "popstate", fn: () => void) => listeners.delete(fn),
    },
    firePopState: () => [...listeners].forEach((fn) => fn()),
    listenerCount: () => listeners.size,
    back,
  };
}

describe("attachBackDismiss", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("pushes the back sentinel when the overlay opens", () => {
    const { win } = fakeWindow();
    attachBackDismiss(win, () => vi.fn(), () => false);
    expect(win.history.state).toEqual({ searchOverlay: true });
  });

  it("closes the overlay on the back gesture", () => {
    const { win, firePopState } = fakeWindow();
    const onClose = vi.fn();
    attachBackDismiss(win, () => onClose, () => false);
    firePopState();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls the latest onClose without re-attaching when the overlay re-renders", () => {
    // Regression: re-attaching on every new inline onClose ran history.back(),
    // whose async popstate then closed the overlay the moment it opened.
    const { win, firePopState, back } = fakeWindow();
    let current = vi.fn();
    const first = current;
    attachBackDismiss(win, () => current, () => false);
    current = vi.fn(); // a re-render hands the overlay a new inline onClose

    firePopState();
    expect(first).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();
  });

  it("removes its listener and pops the sentinel when the overlay closes", () => {
    const { win, back, listenerCount } = fakeWindow();
    const detach = attachBackDismiss(win, () => vi.fn(), () => false);
    detach();
    expect(listenerCount()).toBe(0);
    vi.runOnlyPendingTimers();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("leaves history alone when the overlay closed to navigate", () => {
    const { win, back } = fakeWindow();
    const detach = attachBackDismiss(win, () => vi.fn(), () => true);
    detach();
    vi.runOnlyPendingTimers();
    expect(back).not.toHaveBeenCalled();
  });

  it("survives React Strict Mode's attach → detach → attach on mount", () => {
    // Regression: the immediate history.back() in the first detach fired a
    // popstate after the re-attach, closing a dialog that mounted open.
    const { win, firePopState, back } = fakeWindow();
    const onClose = vi.fn();
    const pushes = vi.spyOn(win.history, "pushState");

    attachBackDismiss(win, () => onClose, () => false)();
    attachBackDismiss(win, () => onClose, () => false);
    vi.runOnlyPendingTimers();

    expect(back).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(pushes).toHaveBeenCalledTimes(1); // one sentinel, reused
    firePopState();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
