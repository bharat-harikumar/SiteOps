"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  History,
  PackagePlus,
  Search,
  Wrench,
} from "lucide-react";
import {
  useSiteTools,
  useSiteToolReceiveOptions,
  useSiteToolMovements,
  useToolMutations,
} from "@/lib/client/tools";
import { useApiResult } from "@/lib/http/useApiQuery";
import { ToolHistory } from "./ToolHistory";
import {
  ToolMovementForm,
  type MovementDraft,
  type MovementOperation,
  type MovementToolChoice,
} from "./ToolMovementForm";

export function SiteTools({
  siteId,
  siteName,
}: {
  siteId: string;
  siteName: string;
}) {
  const inventory = useSiteTools(siteId);
  const { data: result } = inventory;
  const data = result?.ok ? result.data : null;
  const [query, setQuery] = useState("");
  const [operation, setOperation] = useState<MovementOperation | null>(null);
  const [history, setHistory] = useState(false);
  const [offset, setOffset] = useState(0);
  const receive = useSiteToolReceiveOptions(
    operation?.action === "receive" ? siteId : null,
  );
  const ledger = useSiteToolMovements(history ? siteId : null, offset);
  const locations = useApiResult<{ siteId: string; name: string }[]>(
    operation?.action === "transfer" ? "/api/sites" : null,
  );
  const destinations = locations.data?.ok
    ? locations.data.data.filter((site) => site.siteId !== siteId)
    : [];
  const { moveSiteTool, revalidateTools } = useToolMutations();
  const revoked =
    result && !result.ok && [401, 403, 404].includes(result.status ?? 0);
  useEffect(() => {
    if (revoked) {
      setOperation(null);
      setHistory(false);
    }
  }, [revoked]);
  const items =
    data?.items.filter((tool) =>
      tool.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    ) ?? [];
  const choices: MovementToolChoice[] =
    operation?.action === "receive"
      ? receive.data?.ok
        ? receive.data.data.tools.map((tool) => ({
            ...tool,
            available: tool.availableInGodown,
          }))
        : []
      : (data?.items.map((tool) => ({
          ...tool,
          available: tool.quantityHere,
        })) ?? []);

  async function submit(draft: MovementDraft) {
    if (!operation) throw new Error("No movement selected");
    const base = {
      toolId: draft.toolId,
      expectedVersion: draft.expectedVersion,
      quantity: draft.quantity,
      note: draft.note,
    };
    if (operation.action === "transfer")
      return moveSiteTool(siteId, {
        ...base,
        kind: "transfer",
        targetSiteId: draft.targetSiteId,
      });
    return moveSiteTool(siteId, {
      ...base,
      kind: operation.action === "receive" ? "receive" : "return",
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-28 pt-2">
      <Link
        href={`/app/sites/${encodeURIComponent(siteId)}`}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to site
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-44">
          <p className="mb-1 break-words text-sm font-medium text-slate-400">
            {siteName}
          </p>
          <h1 className="text-2xl font-bold text-white">Tools</h1>
          {data ? (
            <p className="mt-2 text-sm text-slate-400">
              {data.itemCount} {data.itemCount === 1 ? "item" : "items"} across{" "}
              {data.toolTypeCount} tool{" "}
              {data.toolTypeCount === 1 ? "type" : "types"}
            </p>
          ) : null}
        </div>
        {!revoked ? (
          <button
            type="button"
            onClick={() => setOperation({ action: "receive" })}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            <PackagePlus className="h-4 w-4" aria-hidden="true" />
            Receive from godown
          </button>
        ) : null}
      </header>
      {!data && inventory.isLoading ? (
        <div
          role="status"
          aria-label="Loading site tools"
          className="space-y-3"
        >
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-28 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      ) : !data ? (
        <div role="alert" className="card-standard p-5">
          <p className="text-sm text-slate-300">
            {revoked
              ? "This site's tools are no longer available to your account."
              : "Couldn't load this site's tools."}
          </p>
          <button
            type="button"
            onClick={() => void inventory.mutate()}
            className="mt-2 min-h-11 text-sm font-semibold text-blue-400"
          >
            Try again
          </button>
        </div>
      ) : history ? (
        <section aria-label="Movement history" className="space-y-3">
          <button
            type="button"
            onClick={() => setHistory(false)}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to tools
          </button>
          <h2 className="text-lg font-semibold text-white">Movement history</h2>
          <ToolHistory
            movements={ledger.data?.ok ? ledger.data.data.movements : []}
            loading={ledger.isLoading && !ledger.data}
            error={Boolean(ledger.data && !ledger.data.ok)}
            onRetry={() => void ledger.mutate()}
            offset={offset}
            onPage={setOffset}
          />
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative min-w-0 flex-1 basis-44">
              <span className="sr-only">Search this site's tools</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tools"
                className="input-standard min-h-11 pl-10 text-base"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setHistory(true);
                setOffset(0);
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-semibold text-slate-300 hover:bg-white/5"
            >
              <History className="h-4 w-4" aria-hidden="true" />
              Movement history
            </button>
          </div>
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
              <Wrench
                className="mx-auto mb-3 h-7 w-7 text-slate-400"
                aria-hidden="true"
              />
              <p className="text-base font-semibold text-white">
                {query.trim() ? "No matching tools" : "No tools at this site"}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                {query.trim()
                  ? "Try another name or clear your search."
                  : "Receive tools from godown to get started."}
              </p>
              <button
                type="button"
                onClick={() =>
                  query.trim()
                    ? setQuery("")
                    : setOperation({ action: "receive" })
                }
                className="mt-3 min-h-11 text-sm font-semibold text-blue-400"
              >
                {query.trim() ? "Clear search" : "Receive from godown"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((tool) => (
                <article key={tool.toolId} className="card-standard p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="break-words text-base font-semibold text-white">
                        {tool.name}
                      </h2>
                      <p className="mt-1 text-xs text-slate-400">
                        {tool.categoryName}
                      </p>
                    </div>
                    <span className="shrink-0 text-base font-bold tabular-nums text-white">
                      {tool.quantityHere} here
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setOperation({ action: "return", toolId: tool.toolId })
                      }
                      className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
                    >
                      Return to godown
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setOperation({
                          action: "transfer",
                          toolId: tool.toolId,
                        })
                      }
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-blue-400 hover:bg-blue-500/10"
                    >
                      <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
                      Transfer
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
      <ToolMovementForm
        operation={operation}
        tools={choices}
        sites={destinations}
        siteName={siteName}
        loading={
          operation?.action === "receive"
            ? receive.isLoading && !receive.data
            : operation?.action === "transfer"
              ? locations.isLoading && !locations.data
              : false
        }
        error={
          operation?.action === "receive"
            ? Boolean(receive.data && !receive.data.ok)
            : operation?.action === "transfer"
              ? Boolean(locations.data && !locations.data.ok)
              : false
        }
        onRetry={() => {
          void receive.mutate();
          void locations.mutate();
        }}
        onSubmit={submit}
        onRefresh={revalidateTools}
        onClose={() => setOperation(null)}
      />
    </div>
  );
}
