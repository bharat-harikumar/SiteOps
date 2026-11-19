'use client';

import { AlertCircle } from 'lucide-react';

// ApiUnavailableBanner is the canonical implementation in
// `components/ui/ApiUnavailableBanner.tsx` — re-exported here for the
// historical import path. Two divergent copies caused theme clashes.
export { ApiUnavailableBanner } from '@/components/ui/ApiUnavailableBanner';

export function SimpleCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`card-standard p-5 ${className}`}>{children}</div>;
}

export function PageHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-1 mb-8">
      <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 font-medium mt-1.5">{subtitle}</p>}
    </div>
  );
}

export function EmptyState({ message = 'No data found' }: { message?: string }) {
  return (
    <div className="text-center py-24 bg-white/2 rounded-2xl border border-dashed border-white/5">
      <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" aria-hidden />
      {/* The only text on an otherwise blank screen, so it clears the 12px floor. */}
      <p className="text-slate-400 text-xs font-semibold">{message}</p>
    </div>
  );
}

export function PageStack({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-6 pb-20 ${className}`}>{children}</div>;
}

export function PageHero({
  children,
  className = '',
  eyebrow,
  title,
  description,
}: {
  children?: React.ReactNode;
  className?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
}) {
  return (
    <div className={`rounded-2xl bg-slate-900/60 border border-white/[0.06] p-6 ${className}`}>
      {eyebrow && <p className="text-xs font-semibold text-blue-400 mb-2">{eyebrow}</p>}
      {title && <h2 className="text-2xl font-semibold tracking-tight text-white mb-1">{title}</h2>}
      {description && <p className="text-sm text-slate-500 font-medium">{description}</p>}
      {children}
    </div>
  );
}
