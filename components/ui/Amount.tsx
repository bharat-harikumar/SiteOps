import type { ReactNode } from "react";

export const AMOUNT_MASK = "₹ ****";

// A rupee figure the admin can hide for demos ("Hide amounts" on Profile).
// Both versions are in the markup and one CSS rule picks which shows (see
// app/globals.css), so there's no hook, no hydration flash on reload, and it
// works in server components. The mask is fixed-length so it never hints at
// the size of the number.
export function Amount({ children, mask = AMOUNT_MASK }: { children: ReactNode; mask?: string }) {
  return (
    <>
      <span data-amount-value="">{children}</span>
      <span data-amount-mask="" aria-hidden="true">
        {mask}
      </span>
    </>
  );
}
