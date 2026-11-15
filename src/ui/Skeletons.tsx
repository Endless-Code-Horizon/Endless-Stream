// Reusable skeleton loading components
export function PosterCardSkeleton() {
  return (
    <div className="aspect-[2/3] rounded-md skeleton" />
  )
}

export function RowSkeleton() {
  return (
    <div className="px-4 md:px-12 py-4">
      <div className="h-6 w-40 rounded skeleton mb-4" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-[140px] md:w-[180px]">
            <PosterCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  )
}

export function HeroSkeleton() {
  return (
    <div className="relative w-full h-[60vh] md:h-[80vh] skeleton">
      <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16">
        <div className="h-10 w-72 rounded skeleton mb-4" />
        <div className="h-4 w-96 max-w-full rounded skeleton mb-2" />
        <div className="h-4 w-80 max-w-full rounded skeleton mb-6" />
        <div className="flex gap-3">
          <div className="h-10 w-28 rounded skeleton" />
          <div className="h-10 w-36 rounded skeleton" />
        </div>
      </div>
    </div>
  )
}

export function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
      {Array.from({ length: 18 }).map((_, i) => (
        <PosterCardSkeleton key={i} />
      ))}
    </div>
  )
}
