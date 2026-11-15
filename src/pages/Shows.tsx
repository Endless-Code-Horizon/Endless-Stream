import { useMemo } from 'react'
import { useCatalog } from '@/data'
import { Grid } from '@/ui/Grid'

export function Shows() {
  const { data: shows, loading } = useCatalog('series', 'popular')

  const sortedShows = useMemo(() => {
    return [...shows].sort((a, b) => a.title.localeCompare(b.title))
  }, [shows])

  return (
    <div className="pt-20 sm:pt-28 px-4 sm:px-12 md:px-16 lg:px-20 pb-28 min-h-screen bg-[#0a0a0a]">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-4xl font-bold tracking-tight text-white">
          TV Shows
        </h1>
      </div>

      <Grid items={sortedShows} loading={loading && shows.length === 0} />
    </div>
  )
}
