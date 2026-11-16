import { useState } from 'react'
import type { MediaItem } from '@/types'
import { useUIStore } from '@/app/uiStore'

interface PosterCardProps {
  item?: MediaItem
  skeleton?: boolean
  progress?: number
  onRemove?: () => void
}

export function PosterCard({ item, skeleton, progress: _progress, onRemove }: PosterCardProps) {
  const openModal = useUIStore((s) => s.openModal)
  const [imgError, setImgError] = useState(false)

  if (skeleton || !item) {
    return (
      <div className="w-full animate-pulse">
        <div className="aspect-[2/3] sm:aspect-video w-full rounded-xl bg-white/10" />
      </div>
    )
  }

  const mobileImageUrl = item.poster || item.thumbnail || item.backdrop || ''
  const hasDedicatedBackdrop = Boolean(item.backdrop && item.backdrop !== item.poster)
  const desktopImageUrl = hasDedicatedBackdrop ? item.backdrop! : mobileImageUrl
  const showFallback = (!mobileImageUrl && !desktopImageUrl) || imgError

  return (
    <div
      onClick={() => openModal(item.type, item.id)}
      className="group flex flex-col text-left cursor-pointer select-none transition-transform duration-300 w-full"
    >
      {/* Aspect Ratio: Portrait 2:3 on mobile (classic movie poster), 16:9 Landscape on desktop */}
      <div className="relative aspect-[2/3] sm:aspect-video w-full rounded-xl overflow-hidden bg-gradient-to-br from-[#262424] to-[#141414] border border-white/10 shadow-lg transition-all duration-300 group-hover:scale-105 group-hover:ring-2 group-hover:ring-white group-hover:shadow-2xl group-hover:shadow-black/90">
        {!showFallback ? (
          <>
            {/* Mobile Vertical Poster (Portrait) */}
            <img
              src={mobileImageUrl}
              alt={item.title}
              loading="lazy"
              decoding="async"
              onError={() => setImgError(true)}
              className="sm:hidden w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
            />
            {/* Desktop Landscape / Backdrop */}
            <img
              src={desktopImageUrl}
              alt={item.title}
              loading="lazy"
              decoding="async"
              onError={() => setImgError(true)}
              className="hidden sm:block w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
            />
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 sm:p-4 text-center bg-[#1a1a1a]">
            <span className="text-sm sm:text-lg font-bold text-white tracking-wider uppercase line-clamp-2">
              {item.title}
            </span>
          </div>
        )}

        {/* Desktop Content Title / Logo Overlay (Hidden on Mobile, Visible on Desktop) */}
        {!showFallback && (
          <div className="hidden sm:flex absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 via-black/45 to-transparent pointer-events-none z-20 items-end">
            {item.logo ? (
              <img
                src={item.logo}
                alt={item.title}
                className="max-h-7 max-w-[85%] object-contain drop-shadow-md"
              />
            ) : (
              <span className="text-xs font-semibold text-white/95 truncate drop-shadow-md tracking-tight">
                {item.title}
              </span>
            )}
          </div>
        )}

        {/* Remove from Continue Watching Button */}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onRemove()
            }}
            className="absolute top-2 right-2 z-30 w-7 h-7 rounded-full bg-black/85 hover:bg-red-600 text-white flex items-center justify-center backdrop-blur-md border border-white/25 transition-all opacity-80 sm:opacity-0 sm:group-hover:opacity-100 hover:scale-110 active:scale-90 shadow-lg cursor-pointer"
            title="Remove from Continue Watching"
            aria-label="Remove item"
          >
            <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
