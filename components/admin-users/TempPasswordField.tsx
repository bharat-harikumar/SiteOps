'use client';

import { useState } from 'react';
import { Copy, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { PASSWORD_MAX, PASSWORD_MIN } from '@/lib/auth/passwordPolicy';

import { generateTempPassword } from './tempPassword';

const iconButton =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded border border-outline bg-surface-container-lowest text-on-surface-variant hover:text-on-surface focus:outline-none focus:ring-1 focus:ring-primary';

export async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success('Copied');
  } catch {
    toast.error('Could not copy — select and copy it manually');
  }
}

export function TempPasswordField({
  id,
  label,
  value,
  onChange,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(true);
  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs font-semibold uppercase text-on-surface-variant">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          aria-describedby={hintId}
          className="h-11 min-w-0 flex-1 rounded border border-outline bg-surface-container-lowest px-3 font-mono text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className={iconButton}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <button type="button" onClick={() => onChange(generateTempPassword())} aria-label="Generate password" className={iconButton}>
          <RefreshCw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => void copyToClipboard(value)}
          disabled={!value}
          aria-label="Copy password"
          className={`${iconButton} disabled:opacity-40`}
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
      <p id={hintId} className="text-xs text-on-surface-variant">
        At least {PASSWORD_MIN} characters.
      </p>
    </div>
  );
}

// Shown once after a create or reset: the admin shares this by hand.
export function SharePassword({ email, password }: { email: string; password: string }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <p className="text-sm text-on-surface-variant">
        Share this temp password with <span className="font-semibold text-on-surface">{email}</span>:
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 select-all break-all rounded bg-surface px-3 py-2 font-mono text-base text-on-surface">
          {password}
        </code>
        <button type="button" onClick={() => void copyToClipboard(password)} aria-label="Copy password" className={iconButton}>
          <Copy className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-3 text-xs text-on-surface-variant">
        It won&apos;t be shown again. They&apos;ll be asked to choose their own password when they sign in.
      </p>
    </div>
  );
}
