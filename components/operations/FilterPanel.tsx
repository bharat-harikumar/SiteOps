"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

// Filter card for the operations lists. On phones the fields fold behind a
// "Filters" button: open, they filled the whole first screen and pushed every
// entry below the fold. From md up they are always shown. `lead` (e.g. live
// search) stays visible at every size.
export function FilterPanel({
  activeCount,
  gridClassName,
  lead,
  children,
}: {
  activeCount: number;
  gridClassName: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <section className="card-standard overflow-visible p-4 space-y-4">
      {lead}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="btn-secondary h-12 w-full justify-between md:hidden"
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Filters
          {activeCount > 0 ? <span className="text-blue-400 tabular-nums">· {activeCount} active</span> : null}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <div id={panelId} className={`${open ? "grid" : "hidden"} md:grid gap-4 ${gridClassName}`}>
        {children}
      </div>
    </section>
  );
}
