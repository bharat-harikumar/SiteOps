// Pure keyboard/positioning logic for <Select>, kept DOM-free so it is unit
// tested without a browser (the test env is node).

type NavOption = { label: string; disabled?: boolean };

// Next enabled option from `from` in direction `step` (+1 / -1). Stops at the
// ends rather than wrapping, like a native listbox. With nothing active
// (from = -1) it starts at the first (down) or last (up) enabled option.
export function nextEnabledIndex(options: NavOption[], from: number, step: 1 | -1): number {
  if (from < 0) {
    const order = step === 1 ? options.map((_, i) => i) : options.map((_, i) => options.length - 1 - i);
    return order.find((i) => !options[i].disabled) ?? -1;
  }
  for (let i = from + step; i >= 0 && i < options.length; i += step) {
    if (!options[i].disabled) return i;
  }
  return from;
}

// Typeahead: the first enabled option whose label starts with `query`,
// searching forward from `from`. A single repeated letter moves to the next
// match (so "p", "p" walks through every P option); a longer prefix may match
// the current option itself. Returns -1 with no match.
export function typeaheadIndex(options: NavOption[], query: string, from: number): number {
  const q = query.toLowerCase();
  if (!q) return -1;
  const n = options.length;
  const startOffset = q.length === 1 ? 1 : 0;
  for (let k = 0; k < n; k += 1) {
    const i = (Math.max(from, 0) + startOffset + k) % n;
    if (!options[i].disabled && options[i].label.toLowerCase().startsWith(q)) return i;
  }
  return -1;
}

// Whether the desktop list opens below the field: below when it fits there or
// when there is at least as much room below as above.
export function placeBelow(
  rect: { top: number; bottom: number },
  viewportHeight: number,
  listHeight: number,
): boolean {
  const below = viewportHeight - rect.bottom;
  const above = rect.top;
  return below >= listHeight || below >= above;
}
