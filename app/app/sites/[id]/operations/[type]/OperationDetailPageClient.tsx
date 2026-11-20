"use client";

import { Amount } from "@/components/ui/Amount";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from 'next/navigation';
import { useNavRouter } from '@/lib/nav/useNavRouter';
import { Clock3 } from "lucide-react";

import { EntryTypeIcon } from "@/components/constants/EntryTypeIcon";
import { DateFilterField } from "@/components/operations/DateFilterField";
import { FilterPanel } from "@/components/operations/FilterPanel";
import { countActiveFilters } from "@/components/operations/filterCount";
import EntryLogList from "@/components/operations/EntryLogList";
import CategoryGrid from "@/components/operations/CategoryGrid";
import { buildGroupedRows } from "@/components/operations/categoryView";
import type { EntryType } from "@/lib/db/queries/entries";
import {
  type Entry,
  formatCurrency,
  typeLabel,
  SPEND_SORT_OPTIONS,
} from "@/components/operations/entryFormat";
import { Select } from "@/components/ui/Select";

type Site = {
  name: string;
  location: string;
};

type Filters = {
  from: string;
  to: string;
  category: string;
  workStage: string;
  sort: string;
};

type Props = {
  site: Site;
  siteId: string;
  type: EntryType;
  initialEntries: Entry[];
  initialFilters: Filters;
  categoryOptions: string[];
  // Active admin-managed "Work Stage" names, in catalog order.
  workStages: string[];
  highlightId?: string | null;
  initialView?: "category" | "all";
};

const SPEND_TYPES_WITH_GRID = ["labour", "material", "machinery", "expense"] as const;

export default function OperationDetailPageClient({
  site,
  siteId,
  type,
  initialEntries,
  initialFilters,
  categoryOptions: initialCategoryOptions,
  workStages: catalogStages,
  highlightId = null,
  initialView = "category",
}: Props) {
  const router = useNavRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useState(initialFilters);
  const [openDateField, setOpenDateField] = useState<string | null>(null);
  const [entries, setEntries] = useState(initialEntries);
  useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);

  const isGridEligible = (SPEND_TYPES_WITH_GRID as readonly string[]).includes(type);
  const [view, setView] = useState<"category" | "all">(initialView);

  function selectView(next: "category" | "all") {
    setView(next);
    const params = new URLSearchParams(window.location.search);
    if (next === "all") {
      params.set("view", "all");
    } else {
      params.delete("view");
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  const categoryOptions = Array.from(
    new Set(filters.category ? [filters.category, ...initialCategoryOptions] : initialCategoryOptions),
  );

  // Keep a stage from the URL selectable even if it was since renamed/removed.
  const workStages = Array.from(
    new Set(filters.workStage ? [...catalogStages, filters.workStage] : catalogStages),
  );

  // Header numbers only — the grouped-card rendering itself lives in EntryLogList.
  const { totalSpend, visibleLogCount } = useMemo(
    () => buildGroupedRows(entries, type, filters.sort),
    [entries, type, filters.sort],
  );

  const stageTotals = useMemo(
    () =>
      workStages.map((stage) => ({
        stage,
        total: entries
          .filter((entry) => entry.workStage === stage)
          .reduce((sum, entry) => sum + Number(entry.cost ?? 0), 0),
      })),
    [entries, workStages],
  );

  function applyFilters() {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.category) params.set("category", filters.category);
    if (filters.workStage) params.set("workStage", filters.workStage);
    if (filters.sort) params.set("sort", filters.sort);
    const query = params.toString();
    router.replace(query ? `/app/sites/${siteId}/operations/${type}?${query}` : `/app/sites/${siteId}/operations/${type}`);
  }

  function clearFilters() {
    setFilters({ from: "", to: "", category: "", workStage: "", sort: "newest" });
    router.replace(`/app/sites/${siteId}/operations/${type}`);
  }

  return (
    <div className="space-y-6 pt-2 pb-20 max-w-5xl mx-auto">
      <section className="card-standard p-5 border-blue-500/10 bg-blue-500/5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 min-w-0">
            <Link
              href={`/app/sites/${siteId}`}
              className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 hover:text-blue-300"
            >
              <Clock3 className="w-3.5 h-3.5" />
              Back to site
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-blue-400">
                <EntryTypeIcon type={type} className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  {typeLabel[type]} Logs
                </h1>
                <p className="text-xs text-slate-500 font-semibold">{site.name}</p>
              </div>
            </div>
          </div>

          <div className="text-right">
            <p className="text-2xl font-semibold text-white">{visibleLogCount}</p>
            <p className="text-xs font-semibold text-slate-500">Logs</p>
            {(type === "labour" || type === "material" || type === "machinery" || type === "expense") ? (
              <p className="mt-2 text-sm font-semibold text-blue-400"><Amount>{formatCurrency(totalSpend)}</Amount></p>
            ) : null}
          </div>
        </div>
      </section>

      {isGridEligible ? (
        <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => selectView("category")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              view === "category" ? "bg-blue-500 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            By Category
          </button>
          <button
            type="button"
            onClick={() => selectView("all")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              view === "all" ? "bg-blue-500 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All Logs
          </button>
        </div>
      ) : null}

      {isGridEligible && view === "category" ? (
        <CategoryGrid entries={entries} type={type} siteId={siteId} />
      ) : (
        <>
      <FilterPanel activeCount={countActiveFilters(initialFilters)} gridClassName="md:grid-cols-5">
        <DateFilterField
          id="filter-from"
          label="From date"
          value={filters.from}
          onChange={(value) => setFilters((state) => ({ ...state, from: value }))}
          openId={openDateField}
          setOpenId={setOpenDateField}
        />
        <DateFilterField
          id="filter-to"
          label="To date"
          value={filters.to}
          onChange={(value) => setFilters((state) => ({ ...state, to: value }))}
          openId={openDateField}
          setOpenId={setOpenDateField}
        />
        <div className="space-y-2">
          <label
            htmlFor="filter-category"
            className="text-xs font-semibold text-slate-400"
          >
            Category
          </label>
          <Select
            id="filter-category"
            value={filters.category}
            onChange={(value) => setFilters((state) => ({ ...state, category: value }))}
            aria-label="Category"
            options={[
              { value: "", label: "All categories" },
              ...categoryOptions.map((option) => ({ value: option, label: option })),
            ]}
          />
        </div>
        {(type === "labour" || type === "material" || type === "machinery" || type === "expense") ? (
          <div className="space-y-2">
            <label
              htmlFor="filter-stage"
              className="text-xs font-semibold text-slate-400"
            >
              Work stage
            </label>
            <Select
              id="filter-stage"
              value={filters.workStage}
              onChange={(value) => setFilters((state) => ({ ...state, workStage: value }))}
              aria-label="Work stage"
              options={[
                { value: "", label: "All stages" },
                ...workStages.map((stage) => ({ value: stage, label: stage })),
              ]}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400">
              Site
            </span>
            <div className="input-standard flex items-center text-xs text-slate-500">
              {site.location}
            </div>
          </div>
        )}
        <div className="space-y-2">
          <label
            htmlFor="filter-sort"
            className="text-xs font-semibold text-slate-400"
          >
            Sort by
          </label>
          <Select
            id="filter-sort"
            value={filters.sort}
            onChange={(value) => setFilters((state) => ({ ...state, sort: value }))}
            aria-label="Sort"
            options={
              type === "labour" || type === "material" || type === "machinery" || type === "expense"
                ? SPEND_SORT_OPTIONS
                : SPEND_SORT_OPTIONS.slice(0, 2)
            }
          />
        </div>
        <div className="grid gap-3 md:col-span-5 md:grid-cols-[1fr_auto]">
          <button type="button" onClick={applyFilters} className="btn-primary h-12 py-3">
            Apply filters
          </button>
          <button type="button" onClick={clearFilters} className="btn-secondary h-12 py-3">
            Clear filters
          </button>
        </div>
      </FilterPanel>

      {type === "material" ? (
        <section className="grid gap-3 md:grid-cols-3">
          {stageTotals.map((item) => (
            <div key={item.stage} className="card-standard p-4">
              <p className="text-xs font-semibold text-slate-500">{item.stage}</p>
              <p className="mt-1 text-lg font-semibold text-white"><Amount>{formatCurrency(item.total)}</Amount></p>
            </div>
          ))}
        </section>
      ) : null}

      <EntryLogList
        siteId={siteId}
        type={type}
        entries={entries}
        sort={filters.sort}
        highlightId={highlightId}
        onDeleted={() => router.refresh()}
      />
        </>
      )}
    </div>
  );
}
