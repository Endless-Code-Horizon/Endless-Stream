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
        <div className="aspect-video w-full rounded-xl bg-white/10" />
      </div>
    )
  }

  const hasDedicatedBackdrop = Boolean(item.backdrop && item.backdrop !== item.poster)
  const imageUrl = hasDedicatedBackdrop ? item.backdrop! : (item.poster || item.thumbnail || '')
  const showFallback = !imageUrl || imgError

  return (
    <div
      onClick={() => openModal(item.type, item.id)}
      className="group flex flex-col text-left cursor-pointer select-none transition-transform duration-300 w-full"
    >
      {/* 16:9 Landscape Thumbnail Container */}
      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-gradient-to-br from-[#262424] to-[#141414] border border-white/10 shadow-lg transition-all duration-300 group-hover:scale-105 group-hover:ring-2 group-hover:ring-white group-hover:shadow-2xl group-hover:shadow-black/90">
        {!showFallback ? (
          <img
            src={imageUrl}
            alt={item.title}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-[#1a1a1a]">
            <span className="text-xl font-bold text-white tracking-widest uppercase">
              {item.title}
            </span>
          </div>
        )}

        {/* Transparent Title Logo or Inset Typography (Apple TV+ style) */}
        {item.logo ? (
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-start pointer-events-none z-20">
            <img
              src={item.logo}
              alt=""
              className="max-h-8 max-w-[70%] object-contain drop-shadow-md"
            />
          </div>
        ) : null}

        {/* Small Endless Stream badge in corner */}
        <div className="absolute bottom-2.5 right-2.5 z-20 flex items-center gap-1 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] text-white/80 font-medium">
          <span>∞</span>
        </div>

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
