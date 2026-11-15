import { useMemo } from 'react'
import { useProfileStore } from '@/profiles/profileStore'
import { useWatchlistStore } from '@/profiles/watchlistStore'
import { Grid } from '@/ui/Grid'
import type { MediaItem } from '@/types'

export function MyList() {
  const activeProfile = useProfileStore((s) => s.getActiveProfile())
  const watchlist = useWatchlistStore((s) => s.watchlist)

  const entries = useMemo(
    () => (activeProfile ? watchlist[activeProfile.id] || [] : []),
    [activeProfile, watchlist]
  )

  const items: MediaItem[] = useMemo(() => {
    return entries.map((entry) => ({
      id: entry.mediaId,
      type: entry.mediaType,
      title: entry.title,
      poster: entry.poster,
      backdrop: entry.backdrop,
      thumbnail: entry.backdrop || entry.poster,
      subtitle: 'In My List',
    }))
  }, [entries])

  return (
    <div className="pt-20 sm:pt-28 px-4 sm:px-12 md:px-16 lg:px-20 pb-28 min-h-screen bg-[#0a0a0a]">
      <div className="mb-6">
        <h1 className="text-xl sm:text-4xl font-bold tracking-tight text-white mb-1.5 sm:mb-2">
          My List
        </h1>
        <p className="text-xs sm:text-sm text-white/50">
          Saved shows and movies on Endless Stream
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 text-center text-white/50">
          <p className="text-lg font-medium text-white/70 mb-1">
            Your list is currently empty
          </p>
          <p className="text-sm text-white/40 max-w-sm">
            Add titles to your list from the details menu to keep track of what you want to watch.
          </p>
        </div>
      ) : (
        <Grid items={items} />
      )}
    </div>
  )
}
