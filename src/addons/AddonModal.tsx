import { useState, useEffect } from 'react'
import { useUIStore } from '@/app/uiStore'
import {
  getSavedAddonUrls,
  addAddon,
  removeAddon,
  clearAllAddons,
  initProviders,
} from '@/data'
import type { AddonManifest } from '@/types'

const PRESET_ADDONS = [
  {
    name: 'Cinemeta',
    url: 'https://v3-cinemeta.strem.io',
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
  try {
    const res = await fetch(target)
    if (res.ok) return (await res.json()) as AddonManifest
  } catch {
    // fallback to proxy
  }
  const proxyRes = await fetch(`/addon-proxy?url=${encodeURIComponent(target)}`)
  if (!proxyRes.ok) throw new Error('HTTP ' + proxyRes.status)
  return (await proxyRes.json()) as AddonManifest
}

export function AddonModal() {
  const isOpen = useUIStore((s) => s.addonModalOpen)
  const closeModal = useUIStore((s) => s.closeAddonModal)

  const [inputUrl, setInputUrl] = useState('')
  const [installing, setInstalling] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null)
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
      setFeedback(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleInstall = async (urlToInstall?: string) => {
    const target = (urlToInstall || inputUrl).trim()
    if (!target) return

    setInstalling(true)
    setFeedback(null)

    try {
      const manifest = await addAddon(target)
      initProviders()
      await loadInstalled()
      if (!urlToInstall) setInputUrl('')
      setFeedback({ text: `${manifest.name || 'Addon'} activated` })
    } catch (err: any) {
      setFeedback({ text: err.message || 'Unable to connect to addon manifest', error: true })
    } finally {
      setInstalling(false)
    }
  }

  const handleRemove = (url: string) => {
    removeAddon(url)
    initProviders()
    loadInstalled()
  }

  const handleClearAll = () => {
    clearAllAddons()
    initProviders()
    loadInstalled()
    setFeedback({ text: 'All add-ons cleared (Zero state)' })
  }

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
          <div className="flex items-center justify-between pb-5 border-b border-white/10">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
                Addons
              </h2>
              <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/15">
                {installedAddons.length} Active
              </span>
              {installedAddons.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-0.5 rounded-full border border-red-500/25 transition-all cursor-pointer active:scale-95"
                  title="Remove all addons and reset to zero"
                >
                  Clear All
                </button>
              )}
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

          {/* Minimalist Install Input Field */}
          <div className="mt-5">
            <div className="relative flex items-center">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://.../manifest.json or stremio://..."
                className="w-full bg-white/[0.06] hover:bg-white/[0.09] focus:bg-white/[0.12] text-white placeholder-white/35 text-xs sm:text-sm pl-4 pr-24 py-2.5 rounded-full border border-white/20 focus:border-white/50 focus:outline-none transition-all shadow-inner"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleInstall()
                }}
              />
              <button
                type="button"
                onClick={() => handleInstall()}
                disabled={installing || !inputUrl.trim()}
                className="absolute right-1.5 bg-white hover:bg-neutral-200 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-black font-bold text-xs px-4 py-1.5 rounded-full shadow-lg transition-all cursor-pointer"
              >
                {installing ? 'Verifying...' : '+ Install'}
              </button>
            </div>

            {feedback && (
              <p
                className={`text-xs mt-2.5 px-3 py-1.5 rounded-xl border animate-in fade-in duration-200 ${
                  feedback.error
                    ? 'text-red-400 bg-red-500/10 border-red-500/20'
                    : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                }`}
              >
                {feedback.error ? '✕ ' : '✓ '}
                {feedback.text}
              </p>
            )}
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
                            onClick={() => handleRemove(preset.url)}
                            className="text-[11px] text-white/50 hover:text-red-400 hover:bg-white/10 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                            title="Remove addon"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleInstall(preset.url)}
                          disabled={installing}
                          className="text-xs font-semibold text-white bg-white/10 hover:bg-white/20 active:scale-95 px-3.5 py-1 rounded-full border border-white/20 transition-all cursor-pointer"
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

          {/* Custom Installed Addons (if user installed other URLs) */}
          {installedAddons.filter((a) => !PRESET_ADDONS.some((p) => p.url === a.url)).length > 0 && (
            <div className="mt-5 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2">
                Custom Installed
              </p>
              <div className="divide-y divide-white/5 rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
                {installedAddons
                  .filter((a) => !PRESET_ADDONS.some((p) => p.url === a.url))
                  .map((addon) => (
                    <div
                      key={addon.url}
                      className="flex items-center justify-between p-3.5 hover:bg-white/[0.04] transition-all group/custom"
                    >
                      <div className="flex flex-col min-w-0 pr-3">
                        <span className="font-bold text-sm text-white truncate">
                          {addon.manifest?.name || addon.url.replace(/^https?:\/\//, '')}
                        </span>
                        <span className="text-[10px] text-white/40 font-mono truncate">
                          {addon.url}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemove(addon.url)}
                        className="text-[11px] text-white/50 hover:text-red-400 px-2.5 py-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
