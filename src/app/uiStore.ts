// Shared UI state — owned by Lead
// Used to open/close the details modal & addon manager from anywhere
import { create } from 'zustand'
import type { MediaType } from '../types'

interface UIState {
  // Details modal
  modalMedia: { type: MediaType; id: string } | null
  openModal: (type: MediaType, id: string) => void
  closeModal: () => void

  // Addon Manager modal
  addonModalOpen: boolean
  openAddonModal: () => void
  closeAddonModal: () => void

  // Search
  searchQuery: string
  setSearchQuery: (q: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  modalMedia: null,
  openModal: (type, id) => {
    document.body.classList.add('modal-open')
    set({ modalMedia: { type, id } })
  },
  closeModal: () => {
    document.body.classList.remove('modal-open')
    set({ modalMedia: null })
  },

  addonModalOpen: false,
  openAddonModal: () => set({ addonModalOpen: true }),
  closeAddonModal: () => set({ addonModalOpen: false }),

  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),
}))

if (typeof window !== 'undefined') {
  ;(window as unknown as { uiStore: typeof useUIStore }).uiStore = useUIStore
}
