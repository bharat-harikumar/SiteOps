'use client';

import { useState } from 'react';

import { ApiUnavailableBanner } from '@/components/ui/ApiUnavailableBanner';
import type { ClientResult } from '@/lib/http/client';
import { useApiResult } from '@/lib/http/useApiQuery';
import { friendlyErrorMessage } from '@/lib/ui/toastMessages';
import { Select } from "@/components/ui/Select";

type AnalyticsResponse = {
  period: '7d' | '30d' | '90d';
  sites: number;
  entries: {
    labour: number;
    material: number;
    machinery: number;
    expense: number;
    incident: number;
  };
  resourceRequests: number;
};

export function AdminAnalyticsPageClient({
  initialPeriod,
  initialAnalytics,
}: {
  initialPeriod: '7d' | '30d' | '90d';
  initialAnalytics: AnalyticsResponse;
}) {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>(initialPeriod);
  // Keyed by period: each window is cached and revalidated independently, and
  // switching periods renders the last-seen value instantly then refreshes.
  // The server render already fetched the initial period; seed that key so the
  // first paint shows numbers, not a loading state (audit F16). Other periods
  // fetch on demand exactly as before.
  const { data: result } = useApiResult<AnalyticsResponse>(`/api/admin/analytics?period=${period}`, {
    fallbackData: period === initialPeriod
      ? ({ ok: true, data: initialAnalytics, status: 200 } as ClientResult<AnalyticsResponse>)
      : undefined,
  });

  return (
    <div className="space-y-4">
      <section className="card-standard p-5">
        <p className="text-xs font-semibold text-on-surface-variant">Pulse</p>
        <h2 className="mt-2 text-2xl font-semibold text-on-surface">Admin analytics</h2>
        <p className="mt-2 max-w-2xl text-sm font-medium text-on-surface-variant">
          Periodic stats now come from the live admin analytics API and stay route-driven.
        </p>
      </section>

      {result && !result.ok && result.kind === 'endpoint_unavailable' ? (
        <ApiUnavailableBanner endpoint={result.endpoint} method={result.method} />
      ) : null}
      {result && !result.ok && result.kind !== 'endpoint_unavailable' ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
          {friendlyErrorMessage(result.code)}
        </div>
      ) : null}

      <label className="grid gap-2 rounded-2xl border border-outline-variant bg-surface p-4 text-sm font-semibold text-on-surface">
        Period
        <Select
          value={period}
          onChange={(value) => setPeriod(value as typeof period)}
          label="Period"
          options={[
            { value: "7d", label: "7d" },
            { value: "30d", label: "30d" },
            { value: "90d", label: "90d" },
          ]}
        />
      </label>

      {result?.ok ? (
        <section className="grid gap-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-outline-variant bg-surface p-4">
              <div className="text-xs font-semibold text-on-surface-variant">Sites</div>
              <div className="mt-2 text-2xl font-semibold text-on-surface">{result.data.sites}</div>
            </div>
            <div className="rounded-2xl border border-outline-variant bg-surface p-4">
              <div className="text-xs font-semibold text-on-surface-variant">Labour</div>
              <div className="mt-2 text-2xl font-semibold text-on-surface">{result.data.entries.labour}</div>
            </div>
            <div className="rounded-2xl border border-outline-variant bg-surface p-4">
              <div className="text-xs font-semibold text-on-surface-variant">Expense</div>
              <div className="mt-2 text-2xl font-semibold text-on-surface">{result.data.entries.expense}</div>
            </div>
            <div className="rounded-2xl border border-outline-variant bg-surface p-4">
              <div className="text-xs font-semibold text-on-surface-variant">Requests</div>
              <div className="mt-2 text-2xl font-semibold text-on-surface">{result.data.resourceRequests}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant bg-surface p-4">
            <h3 className="text-lg font-semibold text-on-surface">Breakdown</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
              <div className="rounded-2xl bg-surface-container-low px-3 py-3">Material: <span className="font-semibold">{result.data.entries.material}</span></div>
              <div className="rounded-2xl bg-surface-container-low px-3 py-3">Machinery: <span className="font-semibold">{result.data.entries.machinery}</span></div>
              <div className="rounded-2xl bg-surface-container-low px-3 py-3">Incident: <span className="font-semibold">{result.data.entries.incident}</span></div>
            </div>
          </div>
        </section>
      ) : (
        <div className="rounded-2xl border border-outline-variant bg-surface px-4 py-6 text-sm font-medium text-on-surface-variant">
          Loading analytics...
        </div>
      )}
    </div>
  );
}
