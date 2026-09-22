'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';

import { ModalShell } from '@/components/ui/motion';
import { PASSWORD_MIN, isPasswordLongEnough } from '@/lib/auth/passwordPolicy';
import { ALL_ROLES, ROLES, type Role } from '@/lib/auth/roles';
import { requestJson } from '@/lib/http/client';
import { notifyError } from '@/lib/ui/toast';

import { SharePassword, TempPasswordField } from './TempPasswordField';
import { generateTempPassword } from './tempPassword';
import { useReturnFocus } from './useReturnFocus';

const labelClass = 'text-xs font-semibold uppercase text-on-surface-variant';
const inputClass =
  'h-11 w-full rounded border border-outline bg-surface-container-lowest px-3 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

export function CreateUserDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState('');
  const [tempPassword, setTempPassword] = useState(generateTempPassword);
  const [role, setRole] = useState<Role>(ROLES.SUPERVISOR);
  const [designation, setDesignation] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  useReturnFocus(open);

  function close() {
    if (creating) return;
    // The password is shown once; drop every trace of it on close.
    setEmail('');
    setTempPassword(generateTempPassword());
    setRole(ROLES.SUPERVISOR);
    setDesignation('');
    setCreated(null);
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !isPasswordLongEnough(tempPassword)) {
      toast.error(`Email and a temp password of at least ${PASSWORD_MIN} characters are required`);
      return;
    }
    setCreating(true);
    const res = await requestJson<{ userId: string }>('/api/admin/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        tempPassword,
        role,
        designation: designation.trim() || undefined,
      }),
    });
    setCreating(false);
    if (!res.ok) {
      notifyError(res);
      return;
    }
    setCreated({ email: email.trim(), password: tempPassword });
    onCreated();
  }

  return (
    <ModalShell
      open={open}
      onClose={close}
      ariaLabelledBy="create-user-title"
      overlayClassName="fixed inset-0 z-[60] flex justify-end bg-black/40"
      className="flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-outline-variant bg-surface-container-low"
    >
      <header className="flex items-center justify-between gap-3 border-b border-outline-variant px-5 py-4">
        <h2 id="create-user-title" className="flex items-center gap-2 text-lg font-black text-on-surface">
          <UserPlus className="h-5 w-5" /> New account
        </h2>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded border border-outline text-on-surface-variant hover:text-on-surface"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {created ? (
        <div className="flex flex-col gap-4 p-5">
          <p className="text-sm font-semibold text-on-surface">Account created.</p>
          <SharePassword email={created.email} password={created.password} />
          <button type="button" onClick={close} className="btn-primary h-11 px-5 text-xs">
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="new-email" className={labelClass}>Email *</label>
            <input
              id="new-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="off"
              className={inputClass}
            />
          </div>
          <TempPasswordField id="new-temp-password" label="Temp password *" value={tempPassword} onChange={setTempPassword} />
          <div className="flex flex-col gap-2">
            <label htmlFor="new-role" className={labelClass}>Role *</label>
            <select id="new-role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}>
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="new-designation" className={labelClass}>Designation</label>
            <input
              id="new-designation"
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              maxLength={100}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="flex h-11 items-center justify-center gap-2 rounded bg-primary px-5 text-xs font-semibold uppercase text-on-primary hover:bg-sky-400 disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {creating ? 'Creating…' : 'Create account'}
          </button>
        </form>
      )}
    </ModalShell>
  );
}
