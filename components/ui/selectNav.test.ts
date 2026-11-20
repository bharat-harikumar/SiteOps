import { describe, expect, it } from "vitest";

import { nextEnabledIndex, placeBelow, typeaheadIndex } from "./selectNav";

const opts = [
  { value: "", label: "All stages" },
  { value: "a", label: "Basement Level", disabled: true },
  { value: "b", label: "Brick Level" },
  { value: "p", label: "Plastering" },
  { value: "q", label: "Parapet work" },
];

describe("nextEnabledIndex", () => {
  it("skips disabled options going down", () => {
    expect(nextEnabledIndex(opts, 0, 1)).toBe(2);
  });
  it("skips disabled options going up", () => {
    expect(nextEnabledIndex(opts, 2, -1)).toBe(0);
  });
  it("stays put at the ends instead of wrapping", () => {
    expect(nextEnabledIndex(opts, 4, 1)).toBe(4);
    expect(nextEnabledIndex(opts, 0, -1)).toBe(0);
  });
  it("starts from the first or last enabled option when nothing is active", () => {
    expect(nextEnabledIndex(opts, -1, 1)).toBe(0);
    expect(nextEnabledIndex(opts, -1, -1)).toBe(4);
  });
});

describe("typeaheadIndex", () => {
  it("finds the next option starting with the typed text, case-insensitive", () => {
    expect(typeaheadIndex(opts, "p", 0)).toBe(3);
  });
  it("cycles to the following match when the same letter is typed again", () => {
    expect(typeaheadIndex(opts, "p", 3)).toBe(4);
    expect(typeaheadIndex(opts, "p", 4)).toBe(3);
  });
  it("matches a longer prefix from the current option", () => {
    expect(typeaheadIndex(opts, "pa", 3)).toBe(4);
  });
  it("ignores disabled options and returns -1 with no match", () => {
    expect(typeaheadIndex(opts, "ba", 0)).toBe(-1);
    expect(typeaheadIndex(opts, "z", 0)).toBe(-1);
  });
});

describe("placeBelow", () => {
  it("opens below when the list fits under the field", () => {
    expect(placeBelow({ top: 100, bottom: 150 }, 800, 300)).toBe(true);
  });
  it("flips above when there is no room below but room above", () => {
    expect(placeBelow({ top: 600, bottom: 650 }, 800, 300)).toBe(false);
  });
  it("uses the larger side when neither fits", () => {
    expect(placeBelow({ top: 300, bottom: 350 }, 500, 400)).toBe(false);
    expect(placeBelow({ top: 150, bottom: 200 }, 500, 400)).toBe(true);
  });
});
