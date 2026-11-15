import { useMemo } from 'react'
import { useCatalog } from '@/data'
import { Grid } from '@/ui/Grid'

export function Movies() {
  const { data: movies, loading } = useCatalog('movie', 'popular')

  const sortedMovies = useMemo(() => {
    return [...movies].sort((a, b) => a.title.localeCompare(b.title))
  }, [movies])

  return (
    <div className="pt-20 sm:pt-28 px-4 sm:px-12 md:px-16 lg:px-20 pb-28 min-h-screen bg-[#0a0a0a]">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-4xl font-bold tracking-tight text-white">
          Movies
        </h1>
      </div>

      <Grid items={sortedMovies} loading={loading && movies.length === 0} />
    </div>
  )
}
