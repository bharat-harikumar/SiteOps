'use client';

import { useEffect, useRef } from 'react';

// When an overlay opens, remember what had focus (the button that opened it)
// and hand focus back to it when the overlay closes. The hand-back waits one
// tick and is cancelled by a re-run, so Strict Mode's mount → unmount → mount
// doesn't pull focus out of a dialog that just opened.
export function useReturnFocus(open: boolean) {
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (pending.current !== null) {
      clearTimeout(pending.current);
      pending.current = null;
    } else {
      opener.current = document.activeElement as HTMLElement | null;
    }
    return () => {
      pending.current = setTimeout(() => {
        pending.current = null;
        opener.current?.focus?.();
      }, 0);
    };
  }, [open]);
}
