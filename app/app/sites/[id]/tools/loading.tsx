export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading tools"
      className="mx-auto max-w-4xl space-y-4 py-5"
    >
      <div className="h-10 w-40 animate-pulse rounded-lg bg-white/5" />
      {[0, 1, 2].map((n) => (
        <div key={n} className="h-28 animate-pulse rounded-xl bg-white/5" />
      ))}
    </div>
  );
}
