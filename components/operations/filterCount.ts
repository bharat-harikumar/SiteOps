// How many filters are applied, shown on the collapsed "Filters" button so a
// phone user knows the list below is narrowed. Counts the applied (URL) state.
export function countActiveFilters(
  filters: { from: string; to: string; workStage?: string; sort: string },
  extra = 0,
): number {
  return (
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0) +
    (filters.workStage ? 1 : 0) +
    (filters.sort && filters.sort !== "newest" ? 1 : 0) +
    extra
  );
}
