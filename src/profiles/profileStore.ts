import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile } from '@/types'

export interface AvatarOption {
  id: string
  label: string
  image: string
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: 'lion', label: 'Lion', image: '/avatars/lion.jpg' },
  { id: 'wolf', label: 'Wolf', image: '/avatars/wolf.jpg' },
  { id: 'leopard', label: 'Snow Leopard', image: '/avatars/leopard.jpg' },
  { id: 'fox', label: 'Red Fox', image: '/avatars/fox.jpg' },
  { id: 'owl', label: 'Barn Owl', image: '/avatars/owl.jpg' },
  { id: 'panther', label: 'Black Panther', image: '/avatars/panther.jpg' },
]

export const PRESET_AVATARS = AVATAR_OPTIONS.map((a) => a.id)

interface ProfileState {
  profiles: Profile[]
  activeProfileId: string | null
  createProfile: (name: string, avatarId: string) => Profile
  updateProfile: (id: string, name: string, avatarId: string) => void
  deleteProfile: (id: string) => void
  selectProfile: (id: string) => void
  getActiveProfile: () => Profile | null
}

const INITIAL_PROFILES: Profile[] = [
  {
    id: 'default-user',
    name: 'Viewer',
    avatar: 'lion',
    createdAt: Date.now(),
  },
]

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profiles: INITIAL_PROFILES,
      activeProfileId: 'default-user',

      createProfile: (name: string, avatarId: string) => {
        const newProfile: Profile = {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `profile-${Date.now()}`,
          name: name.trim() || 'User',
          avatar: avatarId || 'lion',
          createdAt: Date.now(),
        }
        set((state) => ({
          profiles: [...state.profiles, newProfile],
          activeProfileId: newProfile.id,
        }))
        return newProfile
      },

      updateProfile: (id: string, name: string, avatarId: string) => {
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === id ? { ...p, name: name.trim() || p.name, avatar: avatarId || p.avatar } : p
          ),
        }))
      },

      deleteProfile: (id: string) => {
        set((state) => {
          const remaining = state.profiles.filter((p) => p.id !== id)
          return {
            profiles: remaining,
            activeProfileId: state.activeProfileId === id ? (remaining[0]?.id ?? null) : state.activeProfileId,
          }
        })
      },

      selectProfile: (id: string) => {
        set({ activeProfileId: id })
      },

      getActiveProfile: () => {
        const { profiles, activeProfileId } = get()
        return profiles.find((p) => p.id === activeProfileId) ?? null
      },
    }),
    {
      name: 'streamx-profiles',
    }
  )
)
