import { RotateCw } from 'lucide-react';

import type { AdminUser } from './adminUsersView';
import { UserCard, UserTableRow, type UserRowProps } from './UserRow';

type Handlers = Pick<UserRowProps, 'onRoleChange' | 'onResetPassword'>;

export function UsersTable({
  users,
  currentUserId,
  savingId,
  error,
  onRetry,
  hasFilters,
  onClearFilters,
  query,
  ...handlers
}: Handlers & {
  users: AdminUser[];
  currentUserId: string;
  savingId: string | null;
  error: string | null;
  onRetry: () => void;
  hasFilters: boolean;
  onClearFilters: () => void;
  query: string;
}) {
  const rowProps = (user: AdminUser): UserRowProps => ({
    user,
    isSelf: user.userId === currentUserId,
    saving: savingId === user.userId,
    ...handlers,
  });

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span>{error}</span>
          <button type="button" onClick={onRetry} className="flex items-center gap-1.5 text-xs font-bold uppercase">
            <RotateCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : null}

      {users.length === 0 && !error ? (
        <div role="status" className="rounded-xl border border-dashed border-outline-variant px-4 py-8 text-center">
          <p className="text-sm text-on-surface-variant">
            {hasFilters ? (query.trim() ? `No accounts match "${query.trim()}".` : 'No accounts match this filter.') : 'No accounts yet.'}
          </p>
          {hasFilters ? (
            <button type="button" onClick={onClearFilters} className="mt-3 text-xs font-bold uppercase text-primary">
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

      {users.length > 0 ? (
        <>
          <table className="hidden w-full table-fixed text-left md:table">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                <th scope="col" className="w-1/2 pb-2 pl-4 pr-3">Account</th>
                <th scope="col" className="px-3 pb-2">Role</th>
                <th scope="col" className="px-3 pb-2">Status</th>
                <th scope="col" className="w-16 pb-2 pl-3 pr-4"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => <UserTableRow key={user.userId} {...rowProps(user)} />)}
            </tbody>
          </table>
          <ul className="flex flex-col gap-2 md:hidden">
            {users.map((user) => <UserCard key={user.userId} {...rowProps(user)} />)}
          </ul>
        </>
      ) : null}
    </div>
  );
}
