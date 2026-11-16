import { useRef, useState, useCallback, useEffect } from 'react'
import type { MediaItem } from '@/types'
import { PosterCard } from './PosterCard'

interface RowProps {
  title: string
  items: MediaItem[]
  loading?: boolean
}

export function Row({ title, items, loading }: RowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 10)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll, { passive: true })
    const observer = new ResizeObserver(checkScroll)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      observer.disconnect()
    }
  }, [checkScroll, items])

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.75
    el.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    })
  }

  if (loading) {
    return (
      <div className="py-6 px-6 sm:px-12 md:px-16 lg:px-20">
        <h2 className="text-white text-lg sm:text-xl font-bold tracking-tight mb-4">
          {title}
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] sm:aspect-video rounded-xl bg-white/10 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <div className="py-5 sm:py-6 px-4 sm:px-12 md:px-16 lg:px-20 group/row relative select-none">
      {/* Apple TV+ style row header */}
      <h2 className="text-white text-base sm:text-xl font-bold tracking-tight mb-3 sm:mb-4">
        {title}
      </h2>

      <div className="relative">
        {/* Left Arrow */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll('left')}
            className="hidden md:flex absolute -left-5 top-1/3 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center bg-black/60 hover:bg-black/90 text-white rounded-full backdrop-blur-xl border border-white/20 shadow-xl transition-all hover:scale-110 cursor-pointer"
            aria-label="Scroll left"
          >
            ‹
          </button>
        )}

        {/* 6-Column Responsive Unified Row / Carousel */}
        <div
          ref={scrollRef}
          className="flex gap-3 sm:gap-5 overflow-x-auto scrollbar-hide py-1 snap-x snap-mandatory"
        >
          {items.map((item) => (
            <div
              key={item.id}
              className="flex-shrink-0 w-[125px] sm:w-[240px] md:w-[260px] lg:w-[calc((100%-100px)/6)] min-w-[110px] snap-start"
            >
              <PosterCard item={item} />
            </div>
          ))}
        </div>

        {/* Right Arrow */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll('right')}
            className="hidden md:flex absolute -right-5 top-1/3 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center bg-black/60 hover:bg-black/90 text-white rounded-full backdrop-blur-xl border border-white/20 shadow-xl transition-all hover:scale-110 cursor-pointer"
            aria-label="Scroll right"
          >
            ›
          </button>
        )}
      </div>
    </div>
  )
}
