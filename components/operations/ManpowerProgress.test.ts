import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ManpowerProgress from "./ManpowerProgress";

const html = (initial: { masons: number; helpers: number; masonTarget: number | null; helperTarget: number | null }) =>
  renderToStaticMarkup(createElement(ManpowerProgress, { siteId: "s1", workType: "Plastering", initial }));

describe("ManpowerProgress", () => {
  it("shows deployed against target with an edit button once a target exists", () => {
    const out = html({ masons: 13, helpers: 7, masonTarget: 60, helperTarget: 40 });
    expect(out).toContain("Masons deployed: 13 / 60 (22%)");
    expect(out).toContain("Helpers deployed: 7 / 40 (18%)");
    expect(out).toContain("counted per day, all dates");
    expect(out).toContain("Edit target");
  });

  it("shows bare counts and a set button when no target exists", () => {
    const out = html({ masons: 13, helpers: 7, masonTarget: null, helperTarget: null });
    expect(out).toContain("Masons deployed: 13<");
    expect(out).toContain("Helpers deployed: 7<");
    expect(out).toContain("Set target");
  });

  it("treats a target with only one role set as an existing target", () => {
    const out = html({ masons: 13, helpers: 7, masonTarget: 60, helperTarget: null });
    expect(out).toContain("Masons deployed: 13 / 60 (22%)");
    expect(out).toContain("Helpers deployed: 7<");
    expect(out).toContain("Edit target");
  });
});
