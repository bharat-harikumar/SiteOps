"use client";

import { DatePicker } from "@/components/ui/DatePicker";

// A labelled date filter. `openId` / `setOpenId` keep only one calendar open
// across the filter panel.
export function DateFilterField({
  id,
  label,
  value,
  onChange,
  openId,
  setOpenId,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  openId: string | null;
  setOpenId: (value: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-xs font-semibold text-slate-400">
        {label}
      </label>
      <DatePicker
        id={id}
        value={value}
        onChange={onChange}
        open={openId === id}
        onOpenChange={(next) => setOpenId(next ? id : null)}
      />
    </div>
  );
}
