import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AMOUNT_MASK, Amount } from "./Amount";

const visibleText = (html: string) => html.replace(/<[^>]+>/g, "");

describe("Amount", () => {
  it("renders the real value and a fixed-length mask side by side for the CSS switch", () => {
    const html = renderToStaticMarkup(createElement(Amount, { children: "₹21,500" }));
    expect(html).toContain('<span data-amount-value="">₹21,500</span>');
    expect(html).toContain(`<span data-amount-mask="" aria-hidden="true">${AMOUNT_MASK}</span>`);
    expect(AMOUNT_MASK).toBe("₹ ****");
  });

  it("uses the same mask whatever the size of the number", () => {
    const small = renderToStaticMarkup(createElement(Amount, { children: "₹0" }));
    const large = renderToStaticMarkup(createElement(Amount, { children: "₹1,24,50,000" }));
    expect(small.replace("₹0", "")).toBe(large.replace("₹1,24,50,000", ""));
  });

  it("accepts a custom mask for derived figures and sentences", () => {
    const html = renderToStaticMarkup(createElement(Amount, { mask: "**%", children: "62%" }));
    expect(visibleText(html)).toBe("62%**%");
  });
});
