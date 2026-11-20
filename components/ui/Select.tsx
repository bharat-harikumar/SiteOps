"use client";

import { Check, ChevronDown, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

import { AnimatePresence, motion, overlayFade, transitions } from "@/components/ui/motion";
import { useBackDismiss } from "@/lib/nav/useBackDismiss";
import { lockBodyScroll } from "@/lib/ui/scrollLock";
import { useFocusTrap } from "@/lib/ui/useFocusTrap";

import { nextEnabledIndex, placeBelow, typeaheadIndex } from "./selectNav";

// The app's dropdown. Replaces the native <select>, whose list renders as the
// browser's own white sheet on Android. On phones the list opens as a bottom
// sheet with thumb-sized rows; on wider screens as a list anchored to the
// field. Both are portalled to <body> above modals (--z-picker), trap focus,
// close on Escape, outside tap and the phone's back gesture.
//
// Options are passed as data, including any "All …" / "Select…" row that was
// an <option value=""> before — choosing it works exactly as it did natively.

export type SelectOption = { value: string; label: string; disabled?: boolean };

type Props = {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  // Shown when the value matches no option.
  placeholder?: string;
  id?: string;
  // Set for uncontrolled use inside a <form> read via FormData.
  name?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  // Title of the phone sheet. Defaults to aria-label, then the <label for=id>.
  label?: string;
  size?: "md" | "sm";
  // Layout classes for the wrapper (width, margin, grid span).
  className?: string;
  // Extra trigger classes, e.g. left padding for an overlaid icon.
  triggerClassName?: string;
};

const PHONE_QUERY = "(max-width: 639px)";
const POPOVER_MAX = 288;

const TRIGGER = {
  md: "input-standard flex min-h-11 items-center justify-between gap-2 text-left",
  sm: "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-left text-xs text-white outline-none transition focus-visible:border-blue-500/50 focus-visible:ring-2 focus-visible:ring-blue-500/40",
};

type PopoverPos = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

export function Select({
  options,
  value,
  defaultValue,
  onChange,
  placeholder = "Select…",
  id,
  name,
  required,
  disabled,
  "aria-label": ariaLabel,
  label,
  size = "md",
  className,
  triggerClassName,
}: Props) {
  const baseId = useId();
  const listId = `${baseId}-list`;
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = value ?? inner;
  const selectedIndex = options.findIndex((o) => o.value === current);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const [open, setOpen] = useState(false);
  const [asSheet, setAsSheet] = useState(false);
  const [active, setActive] = useState(-1);
  const [title, setTitle] = useState("");
  const [pos, setPos] = useState<PopoverPos | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", timer: 0 });

  const close = useCallback(() => setOpen(false), []);

  // Desktop: anchor to the field and flip above when there is no room below.
  const measure = useCallback((): PopoverPos | null => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const vh = window.innerHeight;
    const below = placeBelow(rect, vh, POPOVER_MAX);
    const room = (below ? vh - rect.bottom : rect.top) - 12;
    return {
      left: rect.left,
      width: rect.width,
      top: below ? rect.bottom + 6 : undefined,
      bottom: below ? undefined : vh - rect.top + 6,
      maxHeight: Math.max(120, Math.min(POPOVER_MAX, room)),
    };
  }, []);

  function openList() {
    if (disabled) return;
    const sheet = window.matchMedia(PHONE_QUERY).matches;
    setAsSheet(sheet);
    if (!sheet) setPos(measure());
    const fromDom = id
      ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.replace(/\s*\*\s*$/, "").trim()
      : undefined;
    setTitle(label ?? ariaLabel ?? fromDom ?? placeholder);
    setActive(selectedIndex >= 0 ? selectedIndex : nextEnabledIndex(options, -1, 1));
    setOpen(true);
  }

  function commit(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    if (option.value !== current) {
      if (value === undefined) setInner(option.value);
      onChange?.(option.value);
    }
    setOpen(false);
  }

  useFocusTrap(open, panelRef);
  useBackDismiss(open, close);

  useEffect(() => {
    if (!open || !asSheet) return;
    return lockBodyScroll();
  }, [open, asSheet]);

  // Focus the list once it is in the DOM so arrow keys work straight away.
  useEffect(() => {
    if (open) listRef.current?.focus({ preventScroll: true });
  }, [open]);

  // Centre the chosen item when the list opens; afterwards keep the keyboard
  // highlight in view without jumping.
  const justOpened = useRef(false);
  useEffect(() => {
    if (open) justOpened.current = true;
  }, [open]);
  useEffect(() => {
    if (!open || active < 0) return;
    document
      .getElementById(`${baseId}-opt-${active}`)
      ?.scrollIntoView({ block: justOpened.current ? "center" : "nearest" });
    justOpened.current = false;
  }, [open, active, baseId]);

  // Escape in the capture phase so it closes only this list, not a modal that
  // also listens for Escape on document.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  // Desktop: follow the field while the page or a modal scrolls. Scrolling the
  // list itself does not move the field, so ignore it.
  useEffect(() => {
    if (!open || asSheet) return;
    const place = (event?: Event) => {
      if (event && listRef.current?.contains(event.target as Node)) return;
      setPos(measure());
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, asSheet, measure]);

  useEffect(() => {
    if (!open || asSheet) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, asSheet]);

  function onTriggerKey(event: ReactKeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openList();
    }
  }

  function onListKey(event: ReactKeyboardEvent) {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        setActive((i) => nextEnabledIndex(options, i, event.key === "ArrowDown" ? 1 : -1));
        return;
      case "Home":
      case "End":
        event.preventDefault();
        setActive(nextEnabledIndex(options, -1, event.key === "Home" ? 1 : -1));
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(active);
        return;
      case "Tab":
        setOpen(false);
        return;
    }
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const t = typed.current;
      window.clearTimeout(t.timer);
      t.text += event.key;
      t.timer = window.setTimeout(() => (t.text = ""), 600);
      const match = typeaheadIndex(options, t.text, active);
      if (match >= 0) setActive(match);
    }
  }

  const list = (
    <ul
      ref={listRef}
      id={listId}
      role="listbox"
      tabIndex={-1}
      aria-label={title}
      aria-activedescendant={active >= 0 ? `${baseId}-opt-${active}` : undefined}
      onKeyDown={onListKey}
      className={
        asSheet
          ? "min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2 outline-none"
          : "overflow-y-auto overscroll-contain p-1 outline-none"
      }
      style={asSheet ? undefined : { maxHeight: pos?.maxHeight }}
    >
      {options.map((option, index) => {
        const isSelected = index === selectedIndex;
        const isActive = index === active;
        return (
          <li
            key={`${option.value}-${index}`}
            id={`${baseId}-opt-${index}`}
            role="option"
            aria-selected={isSelected}
            aria-disabled={option.disabled || undefined}
            onPointerMove={() => !option.disabled && setActive(index)}
            onClick={() => commit(index)}
            className={[
              "flex cursor-pointer items-center justify-between gap-3 select-none",
              asSheet ? "min-h-12 rounded-xl px-4 text-[15px]" : "min-h-10 rounded-lg px-3 text-sm",
              isSelected ? "font-semibold text-blue-300" : "text-slate-200",
              isActive ? "bg-white/[0.06]" : "",
              option.disabled ? "cursor-not-allowed opacity-40" : "",
            ].join(" ")}
          >
            <span className="min-w-0 break-words py-2">{option.label}</span>
            {isSelected ? <Check className="h-4 w-4 shrink-0 text-blue-400" strokeWidth={2.5} aria-hidden /> : null}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className={`relative ${className ?? ""}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        // Select-only combobox (ARIA 1.2): the name comes from the <label> or
        // aria-label, the value from the visible text — as with a native select.
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onTriggerKey}
        className={`${TRIGGER[size]} cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${triggerClassName ?? ""}`}
      >
        <span className={`min-w-0 truncate ${selected ? "" : "text-slate-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          aria-hidden
          className={`shrink-0 text-slate-400 transition-transform duration-150 ${size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Carries the value into FormData and native `required` validation;
          the browser anchors its "please select" hint over the field. */}
      {name || required ? (
        <input
          tabIndex={-1}
          aria-hidden="true"
          name={name}
          required={required}
          value={current}
          onChange={() => {}}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        />
      ) : null}

      {mounted
        ? createPortal(
            <AnimatePresence>
              {open && asSheet ? (
                <motion.div
                  key="sheet"
                  className="fixed inset-0 z-[var(--z-picker)] flex items-end bg-black/60"
                  {...overlayFade}
                  onClick={(event) => event.target === event.currentTarget && close()}
                >
                  <motion.div
                    ref={panelRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label={title}
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={transitions.slow}
                    className="pb-safe flex max-h-[75dvh] w-full flex-col rounded-t-3xl border-t border-white/10 bg-slate-900 shadow-2xl"
                  >
                    <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15" />
                    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-1 pr-2 pl-6">
                      <p className="min-w-0 truncate text-base font-semibold text-white">{title}</p>
                      <button
                        type="button"
                        onClick={close}
                        aria-label="Close"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    {list}
                  </motion.div>
                </motion.div>
              ) : null}
              {open && !asSheet && pos ? (
                <motion.div
                  key="popover"
                  ref={panelRef}
                  initial={{ opacity: 0, y: pos.top !== undefined ? -4 : 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={transitions.fast}
                  style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}
                  className="fixed z-[var(--z-picker)] min-w-44 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/50"
                >
                  {list}
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  );
}
