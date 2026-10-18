'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { PageStack } from '@/components/ui/page-primitives';

export default function SiteDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Site detail error', error);
  }, [error]);

  return (
    <PageStack>
      <section className="rounded-3xl bg-red-500/10 p-6 text-red-300">
        <h2 className="text-lg font-bold">Couldn&apos;t load site</h2>
        <p className="mt-2 text-sm">
          The site detail failed to load. Try again or go back to the site list.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="h-11 rounded-full bg-red-500 px-5 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-red-400 active:scale-[0.97]"
          >
            Try again
          </button>
          {/* The site list lives on the dashboard (/app/sites is retired). */}
          <Link
            href="/app/dashboard"
            className="inline-flex h-11 items-center rounded-full border border-red-500/30 px-5 text-sm font-semibold text-red-200 transition-[background-color,transform] duration-150 hover:bg-red-500/10 active:scale-[0.97]"
          >
            Back to sites
          </Link>
        </div>
      </section>
    </PageStack>
  );
}
