'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { PageStack } from '@/components/ui/page-primitives';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('App route error', error);
  }, [error]);

  return (
    <PageStack>
      <section className="rounded-3xl bg-red-500/10 p-6 text-red-300">
        <h2 className="text-lg font-bold">Something went wrong</h2>
        <p className="mt-2 text-sm">
          We hit an unexpected error loading this page. Anything you had already
          saved is safe; unsaved changes on this screen may need re-entering.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="h-11 rounded-full bg-red-500 px-5 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-red-400 active:scale-[0.97]"
          >
            Try again
          </button>
          <Link
            href="/app/dashboard"
            className="inline-flex h-11 items-center rounded-full border border-red-500/30 px-5 text-sm font-semibold text-red-200 transition-[background-color,transform] duration-150 hover:bg-red-500/10 active:scale-[0.97]"
          >
            Back to dashboard
          </Link>
        </div>
      </section>
    </PageStack>
  );
}
