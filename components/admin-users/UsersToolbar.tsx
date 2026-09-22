import { Search } from 'lucide-react';

import { ROLES } from '@/lib/auth/roles';

import type { UserFilter } from './adminUsersView';

const FILTERS: { value: UserFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: ROLES.ADMIN, label: 'Admin' },
  { value: ROLES.SUPERVISOR, label: 'Supervisor' },
  { value: 'pending', label: 'Pending setup' },
];

export function UsersToolbar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  filter: UserFilter;
  onFilterChange: (value: UserFilter) => void;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="relative md:w-80">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search email or designation"
          aria-label="Search accounts"
          className="h-11 w-full rounded border border-outline bg-surface-container-lowest pl-9 pr-3 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div role="group" aria-label="Filter accounts" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => onFilterChange(f.value)}
            aria-pressed={filter === f.value}
            className={`h-9 shrink-0 rounded-full border px-4 text-xs font-semibold transition-colors ${
              filter === f.value
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-outline-variant text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
