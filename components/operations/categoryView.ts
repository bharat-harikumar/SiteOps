import { displayUnitName } from "@/lib/catalog/units";
import {
  type Entry, type EntryType,
  entrySpend, entryDate, entryId, gridCategoryKey,
} from "./entryFormat";

export type CategorySummary = {
  key: string;
  count: number;
  totalSpend: number;
  lastActivity: string;
};

export function buildCategorySummaries(entries: Entry[], type: EntryType): CategorySummary[] {
  const map = new Map<string, CategorySummary>();
  for (const entry of entries) {
    const key = gridCategoryKey(entry, type);
    const date = entryDate(entry, type) || "";
    const prev = map.get(key) ?? { key, count: 0, totalSpend: 0, lastActivity: "" };
    prev.count += 1;
    prev.totalSpend += entrySpend(entry, type);
    if (date > prev.lastActivity) prev.lastActivity = date;
    map.set(key, prev);
  }
  return [...map.values()].sort((a, b) => b.totalSpend - a.totalSpend || a.key.localeCompare(b.key));
}

export function entryMatchesSearch(entry: Entry, type: EntryType, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    entry.remarks, entry.description,
    entry.amount, entry.cost, entry.totalCost,
    entry.salaryAmount, entry.masonSalaryAmount, entry.helperSalaryAmount, entry.peopleCount,
  ]
    .filter((v) => v != null)
    .map((v) => String(v).toLowerCase())
    .join(" ");
  return haystack.includes(q);
}

export type GroupedRow = {
  entries: Entry[];
  primary: Entry;
  total: number;
  editable: boolean;
};
export type GroupedDate = { date: string; rows: GroupedRow[] };

export function buildGroupedRows(
  entries: Entry[],
  type: EntryType,
  sort: string,
): { groupedRows: GroupedDate[]; runningTotals: Map<string, number>; totalSpend: number; visibleLogCount: number } {
  const totalSpend = entries.reduce((sum, e) => sum + entrySpend(e, type), 0);

  // Every spend type now shows independent cards (post consolidation-fix).
  const byDate = new Map<string, Entry[]>();
  for (const entry of entries) {
    const dateKey = entryDate(entry, type) || "Unknown";
    byDate.set(dateKey, [...(byDate.get(dateKey) ?? []), entry]);
  }
  let groupedRows: GroupedDate[] = [...byDate.entries()].map(([date, dateEntries]) => {
    const sorted = [...dateEntries].sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return at - bt;
    });
    return {
      date,
      rows: sorted.map((entry) => ({
        entries: [entry], primary: entry, total: entrySpend(entry, type), editable: true,
      })),
    };
  });

  groupedRows.sort((left, right) => {
    if (sort === "highest_spend" || sort === "lowest_spend") {
      const lt = left.rows.reduce((s, r) => s + r.total, 0);
      const rt = right.rows.reduce((s, r) => s + r.total, 0);
      return sort === "highest_spend" ? rt - lt : lt - rt;
    }
    const lt = new Date(left.date).getTime();
    const rt = new Date(right.date).getTime();
    return sort === "oldest" ? lt - rt : rt - lt;
  });

  const chronological = [...groupedRows].sort(
    (l, r) => new Date(l.date).getTime() - new Date(r.date).getTime(),
  );
  const runningTotals = new Map<string, number>();
  const runningByCategory = new Map<string, number>();
  for (const group of chronological) {
    for (const row of group.rows) {
      const categoryKey = gridCategoryKey(row.primary, type);
      const id = entryId(row.primary, type);
      const key = id ? String(id) : `${group.date}|${categoryKey}`;
      const next = (runningByCategory.get(categoryKey) ?? 0) + row.total;
      runningByCategory.set(categoryKey, next);
      runningTotals.set(key, next);
    }
  }
  const visibleLogCount = groupedRows.reduce((s, g) => s + g.rows.length, 0);
  return { groupedRows, runningTotals, totalSpend, visibleLogCount };
}

export function entrySuccessDestination(entry: Entry, type: EntryType, siteId: string): string {
  if (!siteId) return "/app/dashboard";
  const id = entryId(entry, type);
  const category = gridCategoryKey(entry, type);
  const base = `/app/sites/${siteId}/operations/${type}/${encodeURIComponent(category)}`;
  return id ? `${base}?highlight=${id}` : base;
}

export type MaterialQuantitySummary = {
  totalQuantity: number | null;
  formattedQuantity: string | null;
  unit: string | null;
  isMixed: boolean;
  displayText: string | null;
};

export function buildMaterialQuantitySummary(entries: Entry[]): MaterialQuantitySummary {
  const emptyResult: MaterialQuantitySummary = {
    totalQuantity: null,
    formattedQuantity: null,
    unit: null,
    isMixed: false,
    displayText: null,
  };

  if (!entries || entries.length === 0) {
    return emptyResult;
  }

  let total = 0;
  let validEntryCount = 0;
  const normalizedUnits = new Set<string>();
  let canonicalUnitDisplay = "";

  for (const entry of entries) {
    if (!entry || entry.quantity == null || entry.quantity === "") {
      continue;
    }
    const qty = Number(entry.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      continue;
    }

    validEntryCount += 1;
    total += qty;

    const rawUnit = typeof entry.unit === "string" ? entry.unit.trim() : "";
    const displayUnit = rawUnit ? displayUnitName(rawUnit) : "";
    const normalizedKey = displayUnit.toLowerCase();

    normalizedUnits.add(normalizedKey);
    if (!canonicalUnitDisplay && displayUnit) {
      canonicalUnitDisplay = displayUnit;
    }
  }

  if (validEntryCount === 0) {
    return emptyResult;
  }

  if (normalizedUnits.size > 1) {
    return {
      totalQuantity: null,
      formattedQuantity: null,
      unit: null,
      isMixed: true,
      displayText: "MIXED UNITS",
    };
  }

  const rounded = Math.round((total + Number.EPSILON) * 100) / 100;
  const formattedQuantity = rounded.toFixed(2);
  const unit = canonicalUnitDisplay || null;
  const displayText = unit ? `${formattedQuantity} ${unit}` : formattedQuantity;

  return {
    totalQuantity: rounded,
    formattedQuantity,
    unit,
    isMixed: false,
    displayText,
  };
}
