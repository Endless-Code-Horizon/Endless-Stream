import { useMemo } from 'react'
import { useCatalog } from '@/data'
import { Hero } from '@/ui/Hero'
import { Grid } from '@/ui/Grid'
import { PosterCard } from '@/ui/PosterCard'
import { useProfileStore } from '@/profiles/profileStore'
import { useProgressStore } from '@/profiles/progressStore'
import type { MediaItem } from '@/types'

export function Home() {
  const activeProfile = useProfileStore((s) => s.getActiveProfile())
  const progress = useProgressStore((s) => s.progress)
  const removeProgress = useProgressStore((s) => s.removeProgress)

  // Fetch both movies and shows to combine on the homepage
  const { data: movies, loading: moviesLoading } = useCatalog('movie', 'popular')
  const { data: series, loading: seriesLoading } = useCatalog('series', 'popular')

  const loading = (moviesLoading && movies.length === 0) || (seriesLoading && series.length === 0)

  // Combine all content, placing series prominently up front
  const allItems = useMemo(() => {
    const combined = [...series, ...movies]
    const seen = new Set<string>()
    const deduped = combined.filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
    const seriesList = deduped.filter((item) => item.type === 'series')
    const moviesList = deduped.filter((item) => item.type === 'movie')
    return [...seriesList, ...moviesList]
  }, [movies, series])

  // Dynamic 4-hour epoch slot rotation across the whole library
  const heroItems = useMemo(() => {
    if (allItems.length <= 6) return allItems
    // 4 hours in milliseconds = 4 * 60 * 60 * 1000 = 14,400,000 ms
    const fourHourEpoch = Math.floor(Date.now() / (4 * 60 * 60 * 1000))
    // Stride by 3 titles each 4-hour cycle to provide fresh rotation
    const startIdx = (fourHourEpoch * 3) % allItems.length
    const items: MediaItem[] = []
    for (let i = 0; i < 6; i++) {
      items.push(allItems[(startIdx + i) % allItems.length])
    }
    return items
  }, [allItems])

  // Continue Watching progress (reacts immediately to profile changes or removals)
  const progressList = useMemo(() => {
    if (!activeProfile) return []
    return progress[activeProfile.id] || []
  }, [activeProfile, progress])

  return (
    <div className="pb-28 min-h-screen bg-[#0a0a0a]">
      {/* Apple-style Multi-Content Hero Carousel (Rotates every 4 hours) */}
      {heroItems.length > 0 && <Hero items={heroItems} />}

      {/* Infinitely Growing 6x6 Content Grid Section */}
      <div className="relative z-20 -mt-4 sm:-mt-6 px-4 sm:px-12 md:px-16 lg:px-20 space-y-8 sm:space-y-10">
        {/* Continue Watching Section (if active) */}
        {progressList.length > 0 && (
          <div>
            <h2 className="text-white text-base sm:text-xl font-bold tracking-tight mb-3 sm:mb-4">
              Continue Watching
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-5">
              {progressList.map((p) => {
                const item: MediaItem = {
                  id: p.mediaId,
                  type: p.mediaType,
                  title: p.title,
                  poster: p.poster,
                  backdrop: p.backdrop,
                  thumbnail: p.backdrop || p.poster,
                  subtitle: p.episode ? `S${p.episode.season} E${p.episode.episode}` : 'Resume',
                }
                const uniqueKey = p.episode
                  ? `${p.mediaId}-${p.episode.season}-${p.episode.episode}`
                  : p.mediaId

                return (
                  <PosterCard
                    key={uniqueKey}
                    item={item}
                    onRemove={() => {
                      if (activeProfile) {
                        removeProgress(activeProfile.id, p.mediaId, p.episode)
                      }
                    }}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* Infinitely Growing 6-Wide Content Section */}
        <div>
          <div className="mb-4">
            <h2 className="text-white text-lg sm:text-xl font-bold tracking-tight">
              Up Next on Endless Stream
            </h2>
          </div>

          <Grid items={allItems} loading={loading} />
        </div>
      </div>
    </div>
  )
}
