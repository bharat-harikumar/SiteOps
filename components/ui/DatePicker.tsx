"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { placeBelow } from "./selectNav";

// The app's date field: a trigger styled like every other input plus the
// in-app calendar, replacing <input type="date"> (which opens the phone's own
// picker). Value is "YYYY-MM-DD", or "" for none. The calendar is portalled
// to <body> (fixed, --z-picker) so a card with overflow hidden cannot clip it,
// and it is kept inside the screen edges on phones.

const CALENDAR_HEIGHT = 440;
const EDGE = 16;

type CalendarPos = { left: number; width: number; top?: number; bottom?: number };

function measureCalendar(trigger: HTMLElement): CalendarPos {
  const rect = trigger.getBoundingClientRect();
  const vw = window.innerWidth;
  const width = Math.min(352, vw - EDGE * 2);
  const left = Math.min(Math.max(rect.left, EDGE), vw - width - EDGE);
  const below = placeBelow(rect, window.innerHeight, CALENDAR_HEIGHT);
  return below
    ? { left, width, top: rect.bottom + 8 }
    : { left, width, bottom: window.innerHeight - rect.top + 8 };
}

export function parseDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date(Number.NaN);
  return new Date(year, month - 1, day);
}

export function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthLabel(date: Date) {
  return date.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

export function calendarDays(viewDate: Date) {
  const firstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

export function formatDateFieldValue(value: string) {
  if (!value) return "Select date";
  const date = parseDateValue(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
}

export function DatePicker({
  id,
  value,
  onChange,
  open: openProp,
  onOpenChange,
  clearable = true,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  // Optional: let a parent keep only one calendar open at a time.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Off for required dates, so the field cannot be emptied.
  clearable?: boolean;
}) {
  const [openInner, setOpenInner] = useState(false);
  const open = openProp ?? openInner;
  const setOpen = (next: boolean) => (onOpenChange ? onOpenChange(next) : setOpenInner(next));
  // Latest setter for the listeners below without re-attaching them.
  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;

  const selectedDate = value ? parseDateValue(value) : null;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<CalendarPos | null>(null);

  // Measure before paint so the calendar never flashes at the wrong spot, and
  // follow the field while the page or a modal scrolls.
  useLayoutEffect(() => {
    if (!open) return;
    const place = (event?: Event) => {
      if (event && panelRef.current?.contains(event.target as Node)) return;
      if (triggerRef.current) setPos(measureCalendar(triggerRef.current));
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  const [viewDate, setViewDate] = useState(
    selectedDate && !Number.isNaN(selectedDate.getTime()) ? selectedDate : new Date(),
  );

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (!containerRef.current) return;
      if (!containerRef.current.contains(target) && !panelRef.current?.contains(target)) {
        setOpenRef.current(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenRef.current(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);
  const todayValue = toDateValue(new Date());
  const selectedValue = selectedDate && !Number.isNaN(selectedDate.getTime()) ? toDateValue(selectedDate) : "";

  function changeMonth(offset: number) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function selectDate(date: Date) {
    onChange(toDateValue(date));
    setViewDate(date);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="input-standard flex min-h-11 cursor-pointer items-center justify-between gap-2 text-left"
      >
        <span className={value ? "text-white" : "text-slate-400"}>
          {formatDateFieldValue(value)}
        </span>
        <CalendarDays aria-hidden className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open && pos ? createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Choose date"
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}
          className="fixed z-[var(--z-picker)] rounded-2xl border border-white/10 bg-slate-950 p-4 shadow-2xl shadow-blue-950/40"
        >
          <div className="flex items-center justify-between pb-3">
            <p className="text-sm font-semibold text-white">
              {monthLabel(viewDate)}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                aria-label="Previous month"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-colors hover:border-blue-500/30 hover:text-blue-400"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                aria-label="Next month"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-colors hover:border-blue-500/30 hover:text-blue-400"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 pb-2">
            {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
              <div
                key={`${day}-${index}`}
                className="flex h-8 items-center justify-center text-xs font-semibold text-slate-500"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays(viewDate).map((date) => {
              const dateValue = toDateValue(date);
              const isSelected = dateValue === selectedValue;
              const isToday = dateValue === todayValue;
              const isCurrentMonth = date.getMonth() === viewDate.getMonth();

              return (
                <button
                  key={dateValue}
                  type="button"
                  onClick={() => selectDate(date)}
                  className={[
                    "flex h-10 items-center justify-center rounded-xl text-sm font-semibold transition-colors",
                    isSelected
                      ? "bg-blue-500 text-slate-950 shadow-lg shadow-blue-500/20"
                      : "text-slate-200 hover:bg-blue-500/10 hover:text-blue-400",
                    !isCurrentMonth && !isSelected ? "text-slate-700" : "",
                    isToday && !isSelected ? "border border-blue-500/40" : "",
                  ].join(" ")}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className={`mt-3 flex items-center border-t border-white/10 pt-3 ${clearable ? "justify-between" : "justify-end"}`}>
            {clearable ? (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200"
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => selectDate(new Date())}
              className="rounded-xl bg-blue-500 px-3 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-blue-400"
            >
              Today
            </button>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
