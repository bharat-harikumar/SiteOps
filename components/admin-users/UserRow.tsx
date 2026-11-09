'use client';

import { CheckCircle2, Clock, KeyRound, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { RowActionsMenu } from '@/components/catalog/RowActionsMenu';

import { ALL_ROLES, type Role } from '@/lib/auth/roles';

import { initialsFor, type AdminUser } from './adminUsersView';

export type UserRowProps = {
  user: AdminUser;
  isSelf: boolean;
  saving: boolean;
  onRoleChange: (user: AdminUser, role: Role) => void;
  onResetPassword: (user: AdminUser) => void;
};

function Identity({ user, isSelf, wrap = false }: { user: AdminUser; isSelf: boolean; wrap?: boolean }) {
  const label = user.email ?? user.userId;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-container text-xs font-black text-on-surface-variant"
      >
        {initialsFor(user.email)}
      </span>
      <div className="min-w-0">
        <p className={`flex gap-2 ${wrap ? 'items-start' : 'items-center'}`}>
          <span
            className={`text-sm font-bold text-on-surface ${wrap ? 'min-w-0 break-all' : 'truncate'} ${user.email ? '' : 'font-mono'}`}
            title={label}
          >
            {label}
          </span>
          {isSelf ? (
            <span className="shrink-0 rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
              You
            </span>
          ) : null}
        </p>
        {user.designation ? <p className="truncate text-xs text-on-surface-variant">{user.designation}</p> : null}
      </div>
    </div>
  );
}

function RoleControl({ user, isSelf, saving, onRoleChange }: UserRowProps) {
  // Your own role is read-only here; the server's last-admin guard backs this up.
  if (isSelf) return <span className="text-sm text-on-surface">{user.role}</span>;
  return (
    <div className="flex items-center gap-2">
      <select
        value={user.role}
        disabled={saving}
        onChange={(e) => onRoleChange(user, e.target.value as Role)}
        aria-label={`Role for ${user.email ?? user.userId}`}
        className="h-10 rounded border border-outline bg-surface-container-lowest px-3 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60"
      >
        {ALL_ROLES.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      {saving ? <Loader2 className="h-4 w-4 animate-spin text-on-surface-variant" aria-label="Saving" /> : null}
    </div>
  );
}

function StatusBadge({ pending }: { pending: boolean }) {
  return pending ? (
    <span
      title="Hasn't set their own password yet"
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300"
    >
      <Clock className="h-3.5 w-3.5" aria-hidden /> Pending setup
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Active
    </span>
  );
}

// Other users: reset their password. Your own row: change your own password
// (which proves the current one) — admins can't reset themselves.
function Actions({ user, isSelf, onResetPassword }: UserRowProps) {
  const router = useRouter();
  const action = isSelf
    ? { label: 'Change password', icon: KeyRound, onSelect: () => router.push('/auth/change-password') }
    : { label: 'Reset password', icon: KeyRound, onSelect: () => onResetPassword(user) };
  return <RowActionsMenu label={`Actions for ${user.email ?? user.userId}`} actions={[action]} />;
}

export function UserTableRow(props: UserRowProps) {
  return (
    <tr className="border-t border-outline-variant">
      <td className="max-w-0 py-3 pl-4 pr-3"><Identity user={props.user} isSelf={props.isSelf} /></td>
      <td className="px-3 py-3"><RoleControl {...props} /></td>
      <td className="px-3 py-3"><StatusBadge pending={props.user.mustChangePassword} /></td>
      <td className="py-3 pl-3 pr-4 text-right"><Actions {...props} /></td>
    </tr>
  );
}

export function UserCard(props: UserRowProps) {
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface px-4 py-3">
      <Identity user={props.user} isSelf={props.isSelf} wrap />
      <div className="flex flex-wrap items-center gap-2">
        <RoleControl {...props} />
        <StatusBadge pending={props.user.mustChangePassword} />
        <div className="ml-auto"><Actions {...props} /></div>
      </div>
    </li>
  );
}
