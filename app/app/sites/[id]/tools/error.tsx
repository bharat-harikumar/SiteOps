"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-4xl space-y-3 py-8">
      <h1 className="text-xl font-bold text-white">Couldn't open tools</h1>
      <p className="text-sm text-slate-400">
        Check your connection and try again.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"
        >
          Try again
        </button>
        <Link
          href="/app/dashboard"
          className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-slate-300"
        >
          Go to Home
        </Link>
      </div>
    </div>
  );
}
