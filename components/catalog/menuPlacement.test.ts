import { describe, expect, it } from "vitest";

import { shouldOpenUp } from "./menuPlacement";

// Viewport 800px tall with an 80px fixed bottom nav; the menu needs ~120px.
describe("shouldOpenUp", () => {
  it("opens down when there is room above the bottom nav", () => {
    expect(shouldOpenUp({ triggerTop: 200, triggerBottom: 240, viewportHeight: 800, menuHeight: 120 })).toBe(false);
  });

  it("opens up when the menu would run under the bottom nav", () => {
    expect(shouldOpenUp({ triggerTop: 620, triggerBottom: 660, viewportHeight: 800, menuHeight: 120 })).toBe(true);
  });

  it("stays down when there is no more room above than below", () => {
    expect(shouldOpenUp({ triggerTop: 60, triggerBottom: 100, viewportHeight: 250, menuHeight: 120 })).toBe(false);
  });
});
