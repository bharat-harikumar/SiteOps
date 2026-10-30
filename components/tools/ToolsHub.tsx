"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Search, Wrench } from "lucide-react";
import { ToolAddModal } from "./ToolAddModal";
import { ToolDashboardStrip } from "./ToolDashboardStrip";
import { ToolLedgerDrawer } from "./ToolLedgerDrawer";
import {
  ToolMovementForm,
  type MovementDraft,
  type MovementOperation,
} from "./ToolMovementForm";
import { ToolRow } from "./ToolRow";
import {
  useToolCategories,
  useTools,
  useToolMutations,
} from "@/lib/client/tools";
import { useApiResult } from "@/lib/http/useApiQuery";

export function ToolsHub() {
  const [query, setQuery] = useState("");
  const inventory = useTools();
  const categoriesQuery = useToolCategories();
  const locations =
    useApiResult<{ siteId: string; name: string }[]>("/api/sites");
  const [operation, setOperation] = useState<MovementOperation | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const { moveTool, revalidateTools } = useToolMutations();
  const tools = inventory.data?.ok ? inventory.data.data.tools : [];
  const categories = categoriesQuery.data?.ok
    ? categoriesQuery.data.data.categories
    : [];
  const sites = locations.data?.ok ? locations.data.data : [];
  const matches = tools.filter((tool) =>
    tool.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const selectedHistory = tools.find((tool) => tool.toolId === historyId);
  const choices = tools.map((tool) => ({
    ...tool,
    available:
      operation?.action === "add"
        ? Math.max(0, 1_000_000 - tool.totalQuantity)
        : tool.free,
  }));

  async function submit(draft: MovementDraft) {
    const common = {
      expectedVersion: draft.expectedVersion,
      quantity: draft.quantity,
      note: draft.note,
    };
    if (operation?.action === "add")
      return moveTool(draft.toolId, { ...common, kind: "add_stock" });
    if (operation?.action === "remove")
      return moveTool(draft.toolId, { ...common, kind: "remove_stock" });
    return moveTool(draft.toolId, {
      ...common,
      kind: "send_to_site",
      targetSiteId: draft.targetSiteId,
    });
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 py-5 pb-28">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">Company Tools</h1>
          <p className="mt-1 text-sm text-slate-400">
            See what you own and where it is.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/5"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New tool type
        </button>
      </header>
      <ToolDashboardStrip />
      <label className="relative block">
        <span className="sr-only">Search company tools</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tools"
          className="input-standard min-h-12 pl-10 text-base"
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-300">
          {!inventory.data?.ok
            ? "Tool inventory"
            : query.trim()
              ? `${matches.length} matching tool ${matches.length === 1 ? "type" : "types"}`
              : `${tools.length} tool ${tools.length === 1 ? "type" : "types"}`}
        </h2>
        <Link
          href="/app/admin/catalog?tab=tools"
          className="inline-flex min-h-11 items-center text-sm font-medium text-blue-400 hover:underline"
        >
          Edit tool catalog →
        </Link>
      </div>
      {!inventory.data && inventory.isLoading ? (
        <div role="status" aria-label="Loading tools" className="space-y-3">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-36 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      ) : !inventory.data?.ok ? (
        <div role="alert" className="card-standard p-5">
          <p className="text-sm text-slate-300">Couldn't load company tools.</p>
          <button
            type="button"
            onClick={() => void inventory.mutate()}
            className="mt-2 min-h-11 text-sm font-semibold text-blue-400"
          >
            Try again
          </button>
        </div>
      ) : matches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
          <Wrench
            className="mx-auto mb-3 h-7 w-7 text-slate-400"
            aria-hidden="true"
          />
          <p className="font-semibold text-white">
            {query.trim() ? "No matching tools" : "No tool types yet"}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            {query.trim()
              ? "Try another name or clear your search."
              : "Register your first tool and its initial godown quantity."}
          </p>
          <button
            type="button"
            onClick={() => (query.trim() ? setQuery("") : setAddOpen(true))}
            className="mt-3 min-h-11 text-sm font-semibold text-blue-400"
          >
            {query.trim() ? "Clear search" : "New tool type"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((tool) => (
            <ToolRow
              key={tool.toolId}
              tool={tool}
              sites={sites}
              categoryName={
                categories.find(
                  (category) => category.categoryId === tool.categoryId,
                )?.name ?? "Tool"
              }
              onAction={(action) =>
                action === "history"
                  ? setHistoryId(tool.toolId)
                  : setOperation({ action, toolId: tool.toolId })
              }
            />
          ))}
        </div>
      )}
      <ToolMovementForm
        operation={operation}
        tools={choices}
        sites={sites}
        loading={
          operation?.action === "send" && locations.isLoading && !locations.data
        }
        error={Boolean(
          operation?.action === "send" && locations.data && !locations.data.ok,
        )}
        onRetry={() => void locations.mutate()}
        onSubmit={submit}
        onRefresh={revalidateTools}
        onClose={() => setOperation(null)}
      />
      <ToolLedgerDrawer
        toolId={historyId}
        toolName={selectedHistory?.name ?? "Tool"}
        siteName={(id) =>
          sites.find((site) => site.siteId === id)?.name ?? "Site"
        }
        onClose={() => setHistoryId(null)}
        allowClear={false}
      />
      <ToolAddModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        categories={categories}
        onCreated={revalidateTools}
        categoriesLoading={categoriesQuery.isLoading && !categoriesQuery.data}
        categoriesError={Boolean(
          categoriesQuery.data && !categoriesQuery.data.ok,
        )}
        onRetryCategories={() => void categoriesQuery.mutate()}
      />
    </div>
  );
}
