import { UserPlus } from 'lucide-react';

import type { userStats } from './adminUsersView';

export function UsersHeader({
  stats,
  onNewAccount,
}: {
  stats: ReturnType<typeof userStats>;
  onNewAccount: () => void;
}) {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return (
    <section className="card-standard p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-on-surface-variant">Access</p>
          <h2 className="mt-2 text-2xl font-black text-on-surface">User management</h2>
          <p className="mt-2 max-w-2xl text-sm font-medium text-on-surface-variant">
            Provision accounts, manage roles and reset passwords.
          </p>
        </div>
        <button
          type="button"
          onClick={onNewAccount}
          className="flex h-11 items-center justify-center gap-2 rounded bg-primary px-5 text-xs font-semibold uppercase text-on-primary hover:bg-sky-400"
        >
          <UserPlus className="h-4 w-4" /> New account
        </button>
      </div>
      <p className="mt-4 text-sm text-on-surface-variant">
        {plural(stats.total, 'account')} · {plural(stats.admins, 'admin')} · {plural(stats.supervisors, 'supervisor')} ·{' '}
        {stats.pending} pending setup
      </p>
    </section>
  );
}
