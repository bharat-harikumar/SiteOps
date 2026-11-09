"use client";

import Link from "next/link";
import { ChevronRight, Wrench } from "lucide-react";
import { useSiteTools } from "@/lib/client/tools";

export function SiteToolsCard({ siteId }: { siteId: string }) {
  const { data: result, isLoading, mutate } = useSiteTools(siteId);
  const data = result?.ok ? result.data : null;
  return (
    <div className="card-standard border-blue-500/20">
      <Link
        href={`/app/sites/${encodeURIComponent(siteId)}/tools`}
        className="flex min-h-24 items-center justify-between gap-4 p-5 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-blue-500/20 bg-blue-500/10">
            <Wrench className="h-5 w-5 text-blue-400" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-bold text-white">Tools</span>
            <span className="mt-1 block text-sm text-slate-400">
              {data
                ? data.itemCount === 0
                  ? "No tools at this site"
                  : `${data.itemCount} ${data.itemCount === 1 ? "item" : "items"} across ${data.toolTypeCount} tool ${data.toolTypeCount === 1 ? "type" : "types"}`
                : isLoading
                  ? "Loading tools…"
                  : "Tools unavailable"}
            </span>
          </span>
        </span>
        <ChevronRight
          className="h-5 w-5 shrink-0 text-slate-400"
          aria-hidden="true"
        />
      </Link>
      {result && !result.ok ? (
        <button
          type="button"
          onClick={() => void mutate()}
          className="mb-2 min-h-11 px-5 text-sm font-semibold text-blue-400"
        >
          Retry tools summary
        </button>
      ) : null}
    </div>
  );
}
