import { PageStack } from "@/components/ui/page-primitives";

// Mirrors the real dashboard (SitesCard header + rows, then ArchivedSites) so
// nothing jumps when the data lands. The old skeleton opened with a 192px hero
// block the page does not have.
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading sites">
      <PageStack>
        <div>
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="h-7 w-28 animate-pulse rounded-lg bg-surface-container-low" />
            <div className="flex gap-2">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-surface-container-low" />
              <div className="h-10 w-10 animate-pulse rounded-xl bg-surface-container-low" />
            </div>
          </div>
          <div className="card-standard divide-y divide-white/5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <div className="h-2.5 w-2.5 rounded-full bg-surface-container" />
                <div className="h-12 w-12 animate-pulse rounded-2xl bg-surface-container-low" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/5 animate-pulse rounded bg-surface-container-low" />
                  <div className="h-3 w-3/5 animate-pulse rounded bg-surface-container-low" />
                </div>
                <div className="h-6 w-20 animate-pulse rounded-lg bg-surface-container-low" />
              </div>
            ))}
          </div>
        </div>
        <div className="h-[76px] animate-pulse rounded-2xl bg-surface-container-low" />
      </PageStack>
    </div>
  );
}
