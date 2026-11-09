"use client";

import Link from "next/link";
import { Send } from "lucide-react";
import type { ToolDTO } from "@/lib/client/tools";

export function ToolRow({
  tool,
  categoryName,
  sites,
  onAction,
}: {
  tool: ToolDTO;
  categoryName: string;
  sites: { siteId: string; name: string }[];
  onAction: (action: "send" | "add" | "remove" | "history") => void;
}) {
  const atSites = tool.assignments.reduce((sum, item) => sum + item.qty, 0);
  return (
    <article className="card-standard p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-40">
          <h3 className="break-words text-base font-semibold leading-snug text-white">
            {tool.name}
          </h3>
          <p className="mt-1 text-xs text-slate-400">{categoryName}</p>
        </div>
        <button
          type="button"
          onClick={() => onAction("send")}
          disabled={tool.free < 1}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-slate-400"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Send to site
        </button>
      </div>
      <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-300">
        <span>
          <strong className="tabular-nums text-white">{tool.free}</strong> in
          godown
        </span>
        <span>
          <strong className="tabular-nums text-white">{atSites}</strong> at
          sites
        </span>
      </p>
      {tool.free === 0 ? (
        <p className="mt-2 text-xs text-slate-400">
          None available to send from godown.
        </p>
      ) : null}
      <details className="mt-2 border-t border-white/5">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-blue-400 focus-visible:outline-blue-500">
          Locations &amp; stock actions
        </summary>
        {tool.assignments.length ? (
          <ul className="mb-3 divide-y divide-white/5">
            {tool.assignments.map((a) => (
              <li key={a.siteId}>
                <Link
                  href={`/app/sites/${encodeURIComponent(a.siteId)}/tools`}
                  className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm text-slate-300 hover:text-blue-400"
                >
                  <span className="min-w-0 break-words">
                    {sites.find((s) => s.siteId === a.siteId)?.name ?? "Site"}
                  </span>
                  <span className="shrink-0 tabular-nums">{a.qty} here →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pb-3 text-sm text-slate-400">No tools at sites.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["add", "Add stock"],
              ["remove", "Remove damaged / lost stock"],
              ["history", "Movement history"],
            ] as const
          ).map(([action, label]) => (
            <button
              key={action}
              type="button"
              onClick={() => onAction(action)}
              disabled={action === "remove" && tool.free === 0}
              className="min-h-11 rounded-lg border border-white/10 px-3 text-sm text-slate-300 transition-colors hover:bg-white/5 disabled:opacity-40"
            >
              {label}
            </button>
          ))}
        </div>
      </details>
    </article>
  );
}
