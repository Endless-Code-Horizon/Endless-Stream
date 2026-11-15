import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WatchProgress, EpisodeRef } from '@/types'

interface ProgressState {
  progress: Record<string, WatchProgress[]>
  saveProgress: (profileId: string, item: Omit<WatchProgress, 'updatedAt'>) => void
  getProgress: (profileId: string, mediaId: string, episode?: EpisodeRef) => WatchProgress | null
  getAllProgress: (profileId: string) => WatchProgress[]
  removeProgress: (profileId: string, mediaId: string, episode?: EpisodeRef) => void
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      progress: {},

      saveProgress: (profileId, item) => {
        set((state) => {
          const list = state.progress[profileId] || []
          const filtered = list.filter((p) => {
            if (p.mediaId !== item.mediaId) return true
            if (item.episode && p.episode) {
              return !(
                p.episode.season === item.episode.season &&
                p.episode.episode === item.episode.episode
              )
            }
            return false
          })

          const entry: WatchProgress = {
            ...item,
            updatedAt: Date.now(),
          }

          return {
            progress: {
              ...state.progress,
              [profileId]: [entry, ...filtered],
            },
          }
        })
      },

      getProgress: (profileId, mediaId, episode) => {
        const list = get().progress[profileId] || []
        const match = list.find((p) => {
          if (p.mediaId !== mediaId) return false
          if (episode && p.episode) {
            return (
              p.episode.season === episode.season &&
              p.episode.episode === episode.episode
            )
          }
          return true
        })
        return match ?? null
      },

      getAllProgress: (profileId) => {
        return get().progress[profileId] || []
      },

      removeProgress: (profileId, mediaId, episode) => {
        set((state) => {
          const list = state.progress[profileId] || []
          return {
            progress: {
              ...state.progress,
              [profileId]: list.filter((p) => {
                if (p.mediaId !== mediaId) return true
                if (episode && p.episode) {
                  return !(
                    p.episode.season === episode.season &&
                    p.episode.episode === episode.episode
                  )
                }
                return false
              }),
            },
          }
        })
      },
    }),
    {
      name: 'streamx-progress',
    }
  )
)
