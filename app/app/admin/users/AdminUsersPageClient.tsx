'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { CreateUserDrawer } from '@/components/admin-users/CreateUserDrawer';
import { ResetPasswordDialog } from '@/components/admin-users/ResetPasswordDialog';
import { UsersHeader } from '@/components/admin-users/UsersHeader';
import { UsersTable } from '@/components/admin-users/UsersTable';
import { UsersToolbar } from '@/components/admin-users/UsersToolbar';
import {
  filterUsers,
  needsDemoteConfirm,
  sortUsers,
  userStats,
  type AdminUser,
  type UserFilter,
} from '@/components/admin-users/adminUsersView';
import type { Role } from '@/lib/auth/roles';
import { requestJson, type ClientResult } from '@/lib/http/client';
import { useApiResult } from '@/lib/http/useApiQuery';
import { confirmDialog } from '@/lib/ui/confirm';
import { notifyError } from '@/lib/ui/toast';

export function AdminUsersPageClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: AdminUser[];
  currentUserId: string;
}) {
  // SWR owns the fetch (cache-then-revalidate + dedupe). `users` is a local
  // working copy so role changes and resets can patch a single row (server is
  // the authority) without a full refetch. Seeded from the server render so the
  // list is in the first paint (audit F16); SWR still revalidates on mount.
  const { data: listResult, mutate } = useApiResult<AdminUser[]>('/api/admin/users', {
    fallbackData: { ok: true, data: initialUsers, status: 200 } as ClientResult<AdminUser[]>,
  });
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<AdminUser | null>(null);

  useEffect(() => {
    if (listResult?.ok) setUsers(listResult.data);
  }, [listResult]);

  const loadUsers = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const stats = useMemo(() => userStats(users), [users]);
  const visible = useMemo(() => sortUsers(filterUsers(users, query, filter)), [users, query, filter]);

  async function handleRoleChange(user: AdminUser, nextRole: Role) {
    if (needsDemoteConfirm(user.role, nextRole)) {
      const confirmed = await confirmDialog({
        title: `Remove admin access from ${user.email ?? 'this user'}?`,
        message: 'This signs them out now. They keep their account as a Supervisor.',
        confirmLabel: 'Change role',
        tone: 'danger',
      });
      if (!confirmed) return;
    }

    setSavingId(user.userId);
    const res = await requestJson<{ role: Role; changed: boolean; note?: string }>(
      `/api/admin/users/${user.userId}/role`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: nextRole }),
      },
    );
    setSavingId(null);

    if (!res.ok) {
      notifyError(res);
      void loadUsers(); // resync the dropdown to the server's truth
      return;
    }
    setUsers((prev) => prev.map((u) => (u.userId === user.userId ? { ...u, role: res.data.role } : u)));
    toast.success(res.data.note ?? 'Role updated');
  }

  function handleReset(userId: string) {
    setUsers((prev) => prev.map((u) => (u.userId === userId ? { ...u, mustChangePassword: true } : u)));
    void loadUsers();
  }

  return (
    <div className="space-y-6">
      <UsersHeader stats={stats} onNewAccount={() => setCreating(true)} />

      {/* overflow-visible: .card-standard clips, which would cut off the ⋯ menu. */}
      <section className="card-standard flex flex-col gap-4 overflow-visible p-5">
        <UsersToolbar query={query} onQueryChange={setQuery} filter={filter} onFilterChange={setFilter} />
        <UsersTable
          users={visible}
          currentUserId={currentUserId}
          savingId={savingId}
          error={listResult && !listResult.ok ? listResult.message : null}
          onRetry={() => void loadUsers()}
          hasFilters={query.trim() !== '' || filter !== 'all'}
          onClearFilters={() => {
            setQuery('');
            setFilter('all');
          }}
          query={query}
          onRoleChange={(user, role) => void handleRoleChange(user, role)}
          onResetPassword={setResetting}
        />
      </section>

      <CreateUserDrawer open={creating} onClose={() => setCreating(false)} onCreated={() => void loadUsers()} />
      {resetting ? (
        <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} onReset={handleReset} />
      ) : null}
    </div>
  );
}
