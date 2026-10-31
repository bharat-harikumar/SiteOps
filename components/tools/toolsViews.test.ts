import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SWRConfig } from "swr";
import { describe, expect, it } from "vitest";
import { ToolRow } from "./ToolRow";
import { SiteToolsCard } from "./SiteToolsCard";
import { ToolHistory } from "./ToolHistory";
import { ToolMovementForm } from "./ToolMovementForm";
import { SiteTools } from "./SiteTools";
import { ToolsHub } from "./ToolsHub";
import { ToolAddModal } from "./ToolAddModal";
import { ToolSummaryTile } from "./ToolSummaryTile";

const tool = {
  toolId: "t",
  name: "Bending lever 8mm & 10mm",
  code: "HND-001",
  categoryId: "c",
  version: 1,
  icon: null,
  free: 2,
  totalQuantity: 5,
  assignments: [{ siteId: "s", qty: 3 }],
};

describe("tool navigation and readable inventory", () => {
  it("does not describe failed inventory as zero tool types", () => {
    const failure = {
      ok: false,
      kind: "api_error",
      status: 503,
      message: "Unavailable",
      endpoint: "/api/tools",
      method: "GET",
    };
    const html = renderToStaticMarkup(
      createElement(
        SWRConfig,
        { value: { fallback: { "/api/tools": failure } } },
        createElement(ToolsHub),
      ),
    );
    expect(html).not.toContain("0 tool types");
  });
  it("does not describe failed home totals as zero stock", () => {
    const failure = {
      ok: false,
      kind: "api_error",
      status: 503,
      message: "Unavailable",
      endpoint: "/api/tools/dashboard",
      method: "GET",
    };
    const html = renderToStaticMarkup(
      createElement(
        SWRConfig,
        {
          value: {
            fallback: { "/api/tools/dashboard": failure },
            isPaused: () => true,
          },
        },
        createElement(ToolSummaryTile),
      ),
    );
    expect(html).not.toMatch(/>0<\/span>/);
  });
  it("puts category failure recovery inside the creation dialog", () => {
    const html = renderToStaticMarkup(
      createElement(ToolAddModal, {
        open: true,
        onClose: () => {},
        onCreated: () => {},
        categories: [],
        categoriesError: true,
        onRetryCategories: () => {},
      }),
    );
    expect(html.replaceAll("&#x27;", "'")).toContain(
      "Couldn't load tool categories.",
    );
    expect(html).toContain("Retry categories");
  });
  it("separates physical totals from tool types in the company overview", () => {
    const fallback = {
      "/api/tools": { ok: true, data: { tools: [tool] } },
      "/api/tools/dashboard": {
        ok: true,
        data: {
          totalTools: 15,
          totalQuantity: 28,
          free: 9,
          deployed: 19,
          perCategory: [],
          perSite: [],
        },
      },
      "/api/tools/categories": { ok: true, data: { categories: [] } },
      "/api/sites": { ok: true, data: [] },
    };
    const html = renderToStaticMarkup(
      createElement(
        SWRConfig,
        { value: { fallback } },
        createElement(ToolsHub),
      ),
    );
    expect(html).toContain("items total");
    expect(html).toContain("New tool type");
    expect(html).not.toContain("By Site");
    expect(html).not.toContain("free pool");
    expect(html).not.toContain("atomically");
  });
  it("makes new tool registration distinct from stock additions", () => {
    const html = renderToStaticMarkup(
      createElement(ToolAddModal, {
        open: true,
        onClose: () => {},
        onCreated: () => {},
        categories: [
          {
            categoryId: "c",
            name: "Hand tools",
            codePrefix: "HND",
            isActive: true,
            sortOrder: 0,
          },
        ],
      }),
    );
    expect(html).toContain("New tool type");
    expect(html).toContain("Initial quantity in godown");
    expect(html).not.toContain("HND");
  });
  it("places scoped movements inside the current site", () => {
    const data = {
      site: { siteId: "s", name: "Kollam" },
      items: [
        {
          toolId: "t",
          name: "Barrel",
          categoryName: "Containers",
          quantityHere: 2,
          version: 1,
        },
      ],
      itemCount: 2,
      toolTypeCount: 1,
    };
    const html = renderToStaticMarkup(
      createElement(
        SWRConfig,
        { value: { fallback: { "/api/sites/s/tools": { ok: true, data } } } },
        createElement(SiteTools, { siteId: "s", siteName: "Kollam" }),
      ),
    );
    expect(html).toContain("Kollam");
    expect(html).toContain("Receive from godown");
    expect(html).toContain("Return to godown");
    expect(html).toContain("Transfer");
    expect(html).toContain("2 here");
    expect(html).not.toContain("Company Tools");
  });
  it("shows a precise return with quantity and destination before submission", () => {
    const html = renderToStaticMarkup(
      createElement(ToolMovementForm, {
        operation: { action: "return", toolId: "t" },
        tools: [{ toolId: "t", name: "Barrel", version: 2, available: 3 }],
        sites: [],
        siteName: "Kollam",
        onClose: () => {},
        onRetry: () => {},
        onRefresh: async () => true,
        onSubmit: async () => ({ ok: true as const, data: { status: "ok" } }),
      }),
    );
    expect(html).toContain("Return to godown");
    expect(html).toContain("3 available");
    expect(html).toContain("Return 1 × Barrel from Kollam to Godown.");
    expect(html.toLowerCase()).toContain('inputmode="numeric"');
  });
  it("offers a named send action instead of a generic manage action", () => {
    const html = renderToStaticMarkup(
      createElement(ToolRow, {
        tool,
        categoryName: "Hand tools",
        sites: [{ siteId: "s", name: "Kollam" }],
        onAction: () => {},
      }),
    );
    expect(html).toContain("Send to site");
    expect(html).not.toContain(">Manage<");
    expect(html).toContain("Bending lever 8mm &amp; 10mm");
    expect(html).not.toContain("HND-001");
    expect(html).toContain("/app/sites/s/tools");
  });
  it("shows scoped quantities on the site entry point", () => {
    const html = renderToStaticMarkup(
      createElement(
        SWRConfig,
        {
          value: {
            fallback: {
              "/api/sites/s/tools": {
                ok: true,
                data: {
                  site: { siteId: "s", name: "Kollam" },
                  items: [],
                  itemCount: 6,
                  toolTypeCount: 3,
                },
              },
            },
          },
        },
        createElement(SiteToolsCard, { siteId: "s" }),
      ),
    );
    expect(html).toContain("6 items across 3 tool types");
    expect(html).toContain("/app/sites/s/tools");
    expect(html).not.toContain("Company Tools");
  });
  it("keeps a returned tool visible in readable movement history", () => {
    const html = renderToStaticMarkup(
      createElement(ToolHistory, {
        movements: [
          {
            movementId: "m",
            toolName: "Barrel",
            kind: "return",
            quantity: 2,
            from: { label: "Kollam", href: null },
            to: { label: "Godown", href: null },
            actorName: "Anil",
            createdAt: "2026-10-31T08:00:00Z",
            note: "With driver",
          },
        ],
        loading: false,
      }),
    );
    expect(html).toContain("Barrel");
    expect(html).toContain("Returned to godown");
    expect(html).toContain("Anil");
    expect(html).toContain("With driver");
  });
});
