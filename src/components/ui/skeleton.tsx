/** Placeholder blocks sized like the real content, so loading never shifts the layout. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-[16px] bg-track ${className}`} />;
}

export function PageSkeleton({ cards = 4, label = "Loading" }: { cards?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-6">
      <span className="sr-only">{label}…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40 rounded-md" />
        <Skeleton className="h-10 w-72 rounded-lg" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        {Array.from({ length: cards }, (_, i) => (
          <Skeleton key={i} className="h-[124px]" />
        ))}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-4">
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[300px]" />
      </div>
    </div>
  );
}
