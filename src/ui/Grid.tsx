import { useState, useRef, useEffect } from 'react'
import type { MediaItem } from '@/types'
import { PosterCard } from './PosterCard'
import { useUIStore } from '@/app/uiStore'

interface GridProps {
  items: MediaItem[]
  loading?: boolean
  itemsPerPage?: number
}

export function Grid({ items, loading, itemsPerPage = 60 }: GridProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

  // Reset page when items array completely changes
  useEffect(() => {
    setCurrentPage(1)
  }, [items.length])

  if (loading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-5 w-full">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] sm:aspect-video w-full rounded-xl bg-white/10 animate-pulse" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center select-none animate-in fade-in duration-300">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mb-4 text-white/50 shadow-inner">
          <svg className="w-7 h-7 stroke-current stroke-1.5 fill-none" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-white/90 mb-1">Total Freedom: Clean Slate</p>
        <p className="text-xs sm:text-sm text-white/50 max-w-md mb-6 leading-relaxed">
          No add-ons or scrapers are pre-bundled. Install any Stremio catalog or community streaming add-on to populate your library.
        </p>
        <button
          type="button"
          onClick={() => useUIStore.getState().openAddonModal()}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-black font-semibold text-xs sm:text-sm hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/10 cursor-pointer"
        >
          <span>Open Addon Manager</span>
          <span>→</span>
        </button>
      </div>
    )
  }

  const totalPages = Math.ceil(items.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedItems = items.slice(startIndex, startIndex + itemsPerPage)

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    if (containerRef.current) {
      const top = containerRef.current.getBoundingClientRect().top + window.scrollY - 100
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  return (
    <div ref={containerRef} className="space-y-8 w-full">
      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-5 w-full">
        {paginatedItems.map((item) => (
          <PosterCard key={item.id} item={item} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 pb-2 border-t border-white/10 select-none">
          <p className="text-xs sm:text-sm text-white/50 font-medium">
            Showing <span className="text-white font-semibold">{startIndex + 1}–{Math.min(startIndex + itemsPerPage, items.length)}</span> of <span className="text-white font-semibold">{items.length}</span> titles
          </p>

          <nav className="flex items-center gap-1.5 bg-[#141414]/80 backdrop-blur-xl border border-white/10 rounded-full p-1 shadow-lg">
            <button
              type="button"
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-full text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
            >
              ‹ Prev
            </button>

            {Array.from({ length: totalPages }).map((_, idx) => {
              const pageNum = idx + 1
              // Show window around currentPage
              if (
                totalPages > 7 &&
                pageNum !== 1 &&
                pageNum !== totalPages &&
                Math.abs(pageNum - currentPage) > 2
              ) {
                if (pageNum === 2 || pageNum === totalPages - 1) {
                  return (
                    <span key={pageNum} className="text-white/30 text-xs px-1">
                      …
                    </span>
                  )
                }
                return null
              }

              const isActive = pageNum === currentPage
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => handlePageChange(pageNum)}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                    isActive
                      ? 'bg-white text-black shadow-md scale-105'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}

            <button
              type="button"
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-full text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
            >
              Next ›
            </button>
          </nav>
        </div>
      )}
    </div>
  )
}
