"use client";

import { AnimatePresence, motion } from "motion/react";
import { MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { shouldOpenUp } from "./menuPlacement";

export type RowAction = {
  label: string;
  onSelect: () => void;
  /** Optional leading icon. */
  icon?: LucideIcon;
  /** Tailwind text color class for the label, e.g. "text-sky-400". */
  tone?: string;
  disabled?: boolean;
};

/**
 * "⋯" overflow menu for catalog rows. Opens an icon-led popover, closes on
 * outside click and Escape. Shared by every catalog manager so the row actions
 * (and their look) can't drift between lists.
 */
export function RowActionsMenu({ actions, label = "Row actions" }: { actions: RowAction[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Focus goes back to the trigger on Escape or a pick, so a dialog an action
  // opens can hand focus back to "⋯" when it closes.
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          const rect = triggerRef.current?.getBoundingClientRect();
          if (!open && rect) {
            // ~44px per item + padding; flip up near the bottom nav.
            setOpenUp(
              shouldOpenUp({
                triggerTop: rect.top,
                triggerBottom: rect.bottom,
                viewportHeight: window.innerHeight,
                menuHeight: actions.length * 44 + 12,
              }),
            );
          }
          setOpen((v) => !v);
        }}
        className={`grid h-10 w-10 cursor-pointer place-items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 ${
          open
            ? "border-sky-500/50 bg-sky-500/10 text-sky-400"
            : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"
        }`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: openUp ? 4 : -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUp ? 4 : -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            role="menu"
            className={`absolute right-0 z-[60] min-w-52 overflow-hidden ${openUp ? "bottom-full mb-2 origin-bottom-right" : "top-full mt-2 origin-top-right"} rounded-2xl border border-white/10 bg-[#0d1526]/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl`}
          >
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  onClick={() => {
                    triggerRef.current?.focus();
                    setOpen(false);
                    action.onSelect();
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:text-slate-600 disabled:hover:bg-transparent ${action.tone ?? "text-slate-200"}`}
                >
                  {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                  {action.label}
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
