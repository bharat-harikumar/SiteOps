"use client";

import Link from "next/link";
import { History } from "lucide-react";
import type { SiteToolMovement } from "@/lib/tools/contracts";

export const MOVEMENT_LABELS: Record<string, string> = {
  opening: "Initial stock",
  procure: "Stock added",
  retire: "Stock removed",
  assign: "Sent to site",
  return: "Returned to godown",
  transfer: "Transferred between sites",
  adjust: "Stock adjusted",
};

export function ToolHistory({
  movements,
  loading,
  error,
  onRetry,
  offset = 0,
  onPage,
}: {
  movements: SiteToolMovement[];
  loading: boolean;
  error?: boolean;
  onRetry?: () => void;
  offset?: number;
  onPage?: (offset: number) => void;
}) {
  if (loading)
    return (
      <p role="status" className="py-8 text-sm text-slate-400">
        Loading movement history…
      </p>
    );
  if (error)
    return (
      <div role="alert" className="py-6 text-sm text-slate-300">
        <p>Couldn't load movement history.</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 min-h-11 text-sm font-semibold text-blue-400"
        >
          Try again
        </button>
      </div>
    );
  return (
    <div className="space-y-4">
      {movements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
          <History
            className="mx-auto mb-3 h-6 w-6 text-slate-400"
            aria-hidden="true"
          />
          <p className="text-sm text-slate-300">No movements recorded yet.</p>
        </div>
      ) : (
        <ol className="space-y-3">
          {movements.map((m) => (
            <li
              key={m.movementId}
              className="rounded-xl border border-white/10 bg-slate-900/50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-semibold text-white">
                    {m.toolName}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {MOVEMENT_LABELS[m.kind] ?? "Tool movement"}
                  </p>
                </div>
                <span className="shrink-0 text-base font-bold tabular-nums text-white">
                  ×{m.quantity}
                </span>
              </div>
              <p className="mt-2 break-words text-sm text-slate-400">
                {m.from.href ? (
                  <Link
                    className="text-blue-400 underline-offset-4 hover:underline"
                    href={m.from.href}
                  >
                    {m.from.label}
                  </Link>
                ) : (
                  m.from.label
                )}{" "}
                <span aria-label="to">→</span>{" "}
                {m.to.href ? (
                  <Link
                    className="text-blue-400 underline-offset-4 hover:underline"
                    href={m.to.href}
                  >
                    {m.to.label}
                  </Link>
                ) : (
                  m.to.label
                )}
              </p>
              {m.note ? (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">
                  {m.note}
                </p>
              ) : null}
              <p className="mt-3 text-xs text-slate-400">
                {m.actorName} ·{" "}
                <time dateTime={m.createdAt}>
                  {new Date(m.createdAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Kolkata",
                  })}
                </time>
              </p>
            </li>
          ))}
        </ol>
      )}
      {onPage && (offset > 0 || movements.length === 50) ? (
        <nav aria-label="History pages" className="flex justify-between gap-3">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => onPage(Math.max(0, offset - 50))}
            className="min-h-11 px-3 text-sm font-semibold text-blue-400 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={movements.length < 50}
            onClick={() => onPage(offset + 50)}
            className="min-h-11 px-3 text-sm font-semibold text-blue-400 disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      ) : null}
    </div>
  );
}
