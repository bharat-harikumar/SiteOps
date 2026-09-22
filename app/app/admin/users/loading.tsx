import { PageStack } from "@/components/ui/page-primitives";

export default function Loading() {
  return (
    <PageStack>
      <section className="h-40 animate-pulse rounded-3xl bg-surface-container-low" aria-busy="true" aria-label="Loading accounts" />
      <section className="space-y-3 rounded-3xl bg-surface-container-low p-5">
        <div className="h-11 w-full animate-pulse rounded bg-surface-container md:w-80" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-container" />
        ))}
      </section>
    </PageStack>
  );
}
