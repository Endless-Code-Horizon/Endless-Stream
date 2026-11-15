import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WatchlistEntry } from '@/types'

interface WatchlistState {
  watchlist: Record<string, WatchlistEntry[]>
  addToList: (profileId: string, entry: Omit<WatchlistEntry, 'addedAt'>) => void
  removeFromList: (profileId: string, mediaId: string) => void
  getList: (profileId: string) => WatchlistEntry[]
  isInList: (profileId: string, mediaId: string) => boolean
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      watchlist: {},

      addToList: (profileId, entry) => {
        set((state) => {
          const list = state.watchlist[profileId] || []
          if (list.some((item) => item.mediaId === entry.mediaId)) {
            return state
          }
          return {
            watchlist: {
              ...state.watchlist,
              [profileId]: [{ ...entry, addedAt: Date.now() }, ...list],
            },
          }
        })
      },

      removeFromList: (profileId, mediaId) => {
        set((state) => {
          const list = state.watchlist[profileId] || []
          return {
            watchlist: {
              ...state.watchlist,
              [profileId]: list.filter((item) => item.mediaId !== mediaId),
            },
          }
        })
      },

      getList: (profileId) => {
        return get().watchlist[profileId] || []
      },

      isInList: (profileId, mediaId) => {
        const list = get().watchlist[profileId] || []
        return list.some((item) => item.mediaId === mediaId)
      },
    }),
    {
      name: 'streamx-watchlist',
    }
  )
)
