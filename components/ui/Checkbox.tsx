"use client";

import { Check } from "lucide-react";
import type { InputHTMLAttributes } from "react";

// Native checkbox/radio inputs (keeping their form and accessibility
// behaviour) restyled with appearance-none, so they match the dark UI instead
// of the browser's white boxes. Pair with a <label> as before.

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

const BASE =
  "peer cursor-pointer appearance-none border border-white/20 bg-white/5 outline-none transition-colors checked:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-40";

export function Checkbox({ className, ...props }: Props) {
  return (
    <span className={`relative inline-flex h-5 w-5 shrink-0 ${className ?? ""}`}>
      <input type="checkbox" {...props} className={`${BASE} h-5 w-5 rounded-md checked:bg-blue-500`} />
      <Check
        aria-hidden
        strokeWidth={3}
        className="pointer-events-none absolute inset-0 m-auto h-3.5 w-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100"
      />
    </span>
  );
}

export function Radio({ className, ...props }: Props) {
  return (
    <span className={`relative inline-flex h-5 w-5 shrink-0 ${className ?? ""}`}>
      <input type="radio" {...props} className={`${BASE} h-5 w-5 rounded-full`} />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 m-auto h-2.5 w-2.5 scale-0 rounded-full bg-blue-500 transition-transform peer-checked:scale-100"
      />
    </span>
  );
}
