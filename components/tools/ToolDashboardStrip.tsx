"use client";
import { useToolDashboard } from "@/lib/client/tools";

export function ToolDashboardStrip() {
  const { data: result, isLoading, mutate } = useToolDashboard();
  if (!result && isLoading)
    return (
      <div
        role="status"
        aria-label="Loading inventory totals"
        className="h-12 animate-pulse rounded-xl bg-white/5"
      />
    );
  if (!result?.ok)
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-400">
        <span>Inventory totals unavailable.</span>
        <button
          type="button"
          onClick={() => void mutate()}
          className="min-h-11 font-semibold text-blue-400"
        >
          Retry totals
        </button>
      </div>
    );
  const data = result.data;
  return (
    <div
      aria-label="Company inventory totals"
      className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3 text-sm text-slate-300"
    >
      <span>
        <strong className="font-semibold tabular-nums text-white">
          {data.totalQuantity}
        </strong>{" "}
        items total
      </span>
      <span>
        <strong className="font-semibold tabular-nums text-emerald-400">
          {data.free}
        </strong>{" "}
        in godown
      </span>
      <span>
        <strong className="font-semibold tabular-nums text-blue-400">
          {data.deployed}
        </strong>{" "}
        at sites
      </span>
    </div>
  );
}
