"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open traps, innermost last. A confirm opened over a modal must own Tab alone;
// otherwise the modal's trap sees focus "outside" itself and pulls it back.
const stack: object[] = [];

/**
 * Keep Tab inside an open dialog and hand focus back to whatever opened it.
 *
 * Without this, Tab walks out of a modal into the page behind it, and closing
 * the modal drops focus on <body> — a keyboard or screen-reader user loses
 * their place. Initial focus is left to the dialog (autoFocus or its own
 * effect); this only moves focus in when nothing inside has it yet.
 */
export function useFocusTrap(open: boolean, containerRef: RefObject<HTMLElement | null>): void {
  // The opener is read during the render that opens the dialog: by the time any
  // effect runs, React has already applied a child's autoFocus.
  const openerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  if (open && !wasOpenRef.current && typeof document !== "undefined") {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  wasOpenRef.current = open;

  useEffect(() => {
    if (!open) return;
    const token = {};
    stack.push(token);
    const opener = openerRef.current;

    // Run after the dialog's own autoFocus / focus effect has had its turn.
    const id = window.setTimeout(() => {
      const container = containerRef.current;
      if (stack[stack.length - 1] === token && container && !container.contains(document.activeElement)) {
        (container.querySelector<HTMLElement>(FOCUSABLE) ?? container).focus();
      }
    }, 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || stack[stack.length - 1] !== token) return;
      const container = containerRef.current;
      if (!container) return;
      const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !container.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(id);
      document.removeEventListener("keydown", onKeyDown);
      stack.splice(stack.indexOf(token), 1);
      // Only restore if the opener is still on the page (a row deleted from
      // inside its own dialog is gone).
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open, containerRef]);
}
