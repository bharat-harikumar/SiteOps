// Height of the fixed bottom nav (AppFooterNav, h-20); a menu must clear it.
export const BOTTOM_NAV_HEIGHT = 80;
const GAP = 8;

// Open a dropdown upward when it would run under the bottom nav and there is
// more room above the trigger than below it.
export function shouldOpenUp({
  triggerTop,
  triggerBottom,
  viewportHeight,
  menuHeight,
}: {
  triggerTop: number;
  triggerBottom: number;
  viewportHeight: number;
  menuHeight: number;
}): boolean {
  const spaceBelow = viewportHeight - BOTTOM_NAV_HEIGHT - triggerBottom - GAP;
  const spaceAbove = triggerTop - GAP;
  return spaceBelow < menuHeight && spaceAbove > spaceBelow;
}
