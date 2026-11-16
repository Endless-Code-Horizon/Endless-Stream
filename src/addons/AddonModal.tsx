import { useState, useEffect } from 'react'
import { useUIStore } from '@/app/uiStore'
import {
  getSavedAddonUrls,
  CINEMETA_URL,
} from '@/data'
import type { AddonManifest } from '@/types'

const PRESET_ADDONS = [
  {
    name: 'Cinemeta',
    url: CINEMETA_URL,
    tag: 'Official Catalogs & Metadata',
  },
  {
    name: 'OpenSubtitles v3',
    url: 'https://opensubtitles-v3.strem.io',
    tag: 'Official Subtitles',
  },
  {
    name: 'WatchHub',
    url: 'https://watchhub.strem.io',
    tag: 'Legal Streaming Directories',
  },
  {
    name: 'CyberFlix',
    url: 'https://cyberflix.kodi.al',
    tag: 'Streaming Catalogs',
  },
  {
    name: 'Anime Kitsu',
    url: 'https://anime-kitsu.strem.fun',
    tag: 'Anime Catalogs & Metadata',
  },
]

interface LoadedAddon {
  url: string
  manifest?: AddonManifest
  loading: boolean
  error?: string
}

async function fetchManifestSafe(cleanUrl: string): Promise<AddonManifest> {
  const target = `${cleanUrl}/manifest.json`
  const res = await fetch(target)
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return (await res.json()) as AddonManifest
}

export function AddonModal() {
  const isOpen = useUIStore((s) => s.addonModalOpen)
  const closeModal = useUIStore((s) => s.closeAddonModal)

  const [inputUrl, setInputUrl] = useState('')
  const [installedAddons, setInstalledAddons] = useState<LoadedAddon[]>([])

  const loadInstalled = async () => {
    const urls = getSavedAddonUrls()
    const initial: LoadedAddon[] = urls.map((u) => ({
      url: u,
      loading: true,
    }))
    setInstalledAddons(initial)

    const updated = await Promise.all(
      urls.map(async (u) => {
        try {
          const clean = u.replace(/\/manifest\.json$/i, '').replace(/\/+$/, '')
          const manifest = await fetchManifestSafe(clean)
          return { url: clean, manifest, loading: false }
        } catch {
          return { url: u, loading: false, error: 'Manifest unreachable' }
        }
      })
    )
    setInstalledAddons(updated)
  }

  useEffect(() => {
    if (isOpen) {
      loadInstalled()
      setInputUrl('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const isUrlInstalled = (url: string) => {
    const cleanTarget = url.replace(/\/manifest\.json$/i, '').replace(/\/+$/, '').toLowerCase()
    return installedAddons.some((a) => {
      const cleanA = a.url.replace(/\/manifest\.json$/i, '').replace(/\/+$/, '').toLowerCase()
      return cleanA === cleanTarget
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal()
      }}
    >
      {/* Living Creature Frosted Container */}
      <div className="relative w-full max-w-lg my-auto animate-modal-spring group/modal">
        {/* Living Ambient Aura */}
        <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-white/10 via-white/20 to-white/10 blur-2xl opacity-60 animate-glass-glow pointer-events-none" />

        <div className="relative w-full bg-[#181818]/95 backdrop-blur-3xl text-white rounded-3xl overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.95),0_0_40px_rgba(255,255,255,0.06)] border border-white/20 p-6 sm:p-8 select-none">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
                Addons
              </h2>
              <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/15">
                {installedAddons.length} Active
              </span>
            </div>

            <button
              type="button"
              onClick={closeModal}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white text-xs font-bold transition-all hover:scale-105 cursor-pointer border border-white/15"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Showcase Mode Notice Banner */}
          <div className="mt-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200/90 text-xs sm:text-sm flex items-start gap-2.5 shadow-inner">
            <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            <p className="leading-snug">
              <strong>Showcase Mode:</strong> Only Cinemeta metadata is active. Custom add-on installation is disabled.
            </p>
          </div>

          {/* Disabled Install Input Field */}
          <div className="mt-5">
            <div className="relative flex items-center">
              <input
                type="text"
                disabled
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Custom add-on installation disabled in showcase"
                className="w-full bg-white/[0.04] text-white/40 placeholder-white/25 text-xs sm:text-sm pl-4 pr-24 py-2.5 rounded-full border border-white/10 cursor-not-allowed select-none transition-all shadow-inner"
              />
              <button
                type="button"
                disabled
                title="Custom add-on installation is disabled in showcase mode"
                className="absolute right-1.5 bg-white/40 text-black/50 font-bold text-xs px-4 py-1.5 rounded-full cursor-not-allowed shadow-none"
              >
                + Install
              </button>
            </div>
          </div>

          {/* Minimalist Presets List */}
          <div className="mt-6 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2">
              Featured Protocols
            </p>

            <div className="divide-y divide-white/5 rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
              {PRESET_ADDONS.map((preset) => {
                const installed = isUrlInstalled(preset.url)

                return (
                  <div
                    key={preset.name}
                    className="flex items-center justify-between p-3.5 hover:bg-white/[0.04] transition-all group/row"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-white tracking-tight">
                          {preset.name}
                        </span>
                        <span className="text-[11px] text-white/50">
                          {preset.tag}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {installed ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Active
                          </span>
                          <button
                            type="button"
                            disabled
                            title="Cinemeta is the core showcase metadata provider and cannot be removed"
                            className="text-[11px] text-white/25 px-2 py-1 rounded-lg cursor-not-allowed"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title="Custom add-on installation is disabled in showcase mode"
                          className="text-xs font-semibold text-white/40 bg-white/5 px-3.5 py-1 rounded-full border border-white/10 cursor-not-allowed"
                        >
                          + Install
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
