'use client';

import { useState, type FormEvent } from 'react';
import { AlertTriangle, KeyRound, Loader2 } from 'lucide-react';

import { ModalShell } from '@/components/ui/motion';
import { isPasswordLongEnough } from '@/lib/auth/passwordPolicy';
import { requestJson } from '@/lib/http/client';

import type { AdminUser } from './adminUsersView';
import { SharePassword, TempPasswordField } from './TempPasswordField';
import { generateTempPassword } from './tempPassword';
import { useReturnFocus } from './useReturnFocus';

// Mounted only while a user is selected, so each open starts with a fresh
// generated password and nothing survives a close.
export function ResetPasswordDialog({
  user,
  onClose,
  onReset,
}: {
  user: AdminUser;
  onClose: () => void;
  onReset: (userId: string) => void;
}) {
  const [password, setPassword] = useState(generateTempPassword);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const label = user.email ?? user.userId;
  useReturnFocus(true);

  function close() {
    if (!saving) onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await requestJson<{ userId: string; mustChangePassword: boolean }>(
      `/api/admin/users/${user.userId}/reset-password`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tempPassword: password }),
      },
    );
    setSaving(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setDone(true);
    onReset(user.userId);
  }

  return (
    <ModalShell
      open
      onClose={close}
      ariaLabelledBy="reset-password-title"
      className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-low p-5 shadow-xl"
    >
      <h2 id="reset-password-title" className="flex items-center gap-2 text-lg font-black text-on-surface">
        <KeyRound className="h-5 w-5" /> {done ? 'Password reset' : 'Reset password'}
      </h2>
      <p className="mt-1 truncate text-sm text-on-surface-variant" title={label}>{label}</p>

      {done ? (
        <div className="mt-4 flex flex-col gap-4">
          <SharePassword email={label} password={password} />
          <button type="button" onClick={onClose} className="btn-primary h-11 px-5 text-xs">
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4" aria-describedby="reset-password-warning">
          <TempPasswordField id="reset-temp-password" label="New temp password" value={password} onChange={setPassword} />
          <p
            id="reset-password-warning"
            className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-on-surface"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
            This signs them out on every device. They must set their own password the next time they sign in.
          </p>
          {error ? (
            <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} disabled={saving} className="btn-secondary h-11 px-4 text-xs disabled:opacity-60">
              Cancel
            </button>
            {/* Initial focus on the action, not the prefilled field, so opening
                the dialog on a phone doesn't pop the keyboard over it. */}
            <button
              type="submit"
              autoFocus
              disabled={saving || !isPasswordLongEnough(password)}
              className="flex h-11 items-center justify-center gap-2 rounded bg-primary px-5 text-xs font-semibold uppercase text-on-primary hover:bg-sky-400 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {saving ? 'Resetting…' : 'Reset password'}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}
