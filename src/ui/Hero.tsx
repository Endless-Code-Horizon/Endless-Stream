import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useUIStore } from '@/app/uiStore'
import type { MediaItem } from '@/types'

interface HeroProps {
  items: MediaItem[]
  autoPlayInterval?: number
}

export function Hero({ items, autoPlayInterval = 12000 }: HeroProps) {
  const openModal = useUIStore((s) => s.openModal)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const timerRef = useRef<number | null>(null)
  const touchStartXRef = useRef<number | null>(null)

  const count = items.length
  const currentItem = items[currentIndex]

  const nextSlide = useCallback(() => {
    if (count <= 1) return
    setCurrentIndex((prev) => (prev + 1) % count)
  }, [count])

  const prevSlide = useCallback(() => {
    if (count <= 1) return
    setCurrentIndex((prev) => (prev - 1 + count) % count)
  }, [count])

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
  }

  // Mobile Touch Swipe Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX
    setIsPaused(true)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current !== null) {
      const diff = e.changedTouches[0].clientX - touchStartXRef.current
      if (diff > 45) {
        prevSlide()
      } else if (diff < -45) {
        nextSlide()
      }
      touchStartXRef.current = null
    }
    setIsPaused(false)
  }

  // Slide Carousel Auto-Timer
  useEffect(() => {
    if (isPaused || count <= 1) return

    timerRef.current = window.setInterval(() => {
      nextSlide()
    }, autoPlayInterval)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPaused, count, nextSlide, autoPlayInterval, currentIndex])

  if (!items || items.length === 0) return null

  return (
    <section
      className="relative w-full h-[76vh] sm:h-[82vh] min-h-[480px] sm:min-h-[580px] max-h-[900px] overflow-hidden select-none group/hero"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Slides / Visual Layer */}
      {items.map((item, idx) => {
        const bgImage = item.backdrop || item.thumbnail || item.poster
        const isActive = idx === currentIndex

        return (
          <div
            key={item.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            {/* Cinematic Backdrop Image */}
            {bgImage ? (
              <img
                src={bgImage}
                alt={item.title}
                className="w-full h-full object-cover object-center filter brightness-[0.85]"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-[#2c1c11] via-[#1a1410] to-[#0a0a0a]" />
            )}

            {/* Apple TV+ Cinematic Vignette Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/35 to-black/60 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/95 via-[#0a0a0a]/45 to-transparent w-full md:w-3/5 pointer-events-none" />
          </div>
        )
      })}

      {/* Hero Content (Active Slide Details) */}
      <div className="relative z-20 h-full flex flex-col justify-end px-4 sm:px-12 md:px-16 lg:px-20 pb-24 sm:pb-36 max-w-2xl">
        {/* Transparent Title Logo or Minimal Typography */}
        {currentItem.logo ? (
          <img
            key={`logo-${currentItem.id}`}
            src={currentItem.logo}
            alt={currentItem.title}
            className="max-h-14 sm:max-h-24 md:max-h-28 max-w-[240px] sm:max-w-sm object-contain mb-2 sm:mb-3 drop-shadow-xl animate-in fade-in duration-500"
          />
        ) : (
          <h1
            key={`title-${currentItem.id}`}
            className="text-2xl sm:text-6xl md:text-7xl font-black text-white tracking-[0.14em] uppercase drop-shadow-2xl mb-1.5 sm:mb-2 font-sans animate-in fade-in slide-in-from-left-4 duration-500"
          >
            {currentItem.title}
          </h1>
        )}

        {/* Apple-style Meta Pills Row (Rating, Year, Subtitle) */}
        <div className="flex items-center gap-2.5 sm:gap-3 text-xs sm:text-sm font-semibold text-white/90 mb-3 sm:mb-4">
          <span className="bg-white/15 px-2.5 py-0.5 rounded text-[10px] sm:text-[11px] uppercase tracking-wider backdrop-blur-md border border-white/20">
            TV-MA
          </span>
          {currentItem.year && (
            <span className="text-white/70">{currentItem.year}</span>
          )}
          {currentItem.subtitle && (
            <span className="text-white/50 hidden sm:inline">
              · {currentItem.subtitle}
            </span>
          )}
          {currentItem.rating && (
            <span className="text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded text-xs border border-amber-400/30">
              ★ {currentItem.rating.toFixed(1)}
            </span>
          )}
        </div>

        {/* Action Buttons: Play + More Info */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 pt-1">
          <Link
            to={`/play/${currentItem.type}/${currentItem.id}`}
            className="flex items-center gap-1.5 sm:gap-2 bg-white text-black hover:bg-neutral-200 active:scale-95 px-5 sm:px-8 py-2 sm:py-3 rounded-full font-bold text-xs sm:text-base transition-all duration-300 shadow-[0_4px_24px_rgba(255,255,255,0.25)] hover:shadow-[0_6px_32px_rgba(255,255,255,0.45)] hover:scale-105 cursor-pointer"
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 fill-current"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
            <span>Play</span>
          </Link>

          <button
            type="button"
            onClick={() => openModal(currentItem.type, currentItem.id)}
            className="flex items-center gap-1.5 sm:gap-2 bg-white/15 hover:bg-white/25 active:scale-95 text-white backdrop-blur-2xl px-4 sm:px-7 py-2 sm:py-3 rounded-full font-semibold text-xs sm:text-base border border-white/20 hover:border-white/40 transition-all duration-300 shadow-lg cursor-pointer"
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>More Info</span>
          </button>
        </div>
      </div>

      {/* Left/Right Subtle Navigation Arrows */}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={prevSlide}
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 items-center justify-center rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-md border border-white/15 opacity-0 group-hover/hero:opacity-100 transition-all hover:scale-110 cursor-pointer shadow-xl text-lg font-bold"
            aria-label="Previous slide"
          >
            ‹
          </button>

          <button
            type="button"
            onClick={nextSlide}
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 items-center justify-center rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-md border border-white/15 opacity-0 group-hover/hero:opacity-100 transition-all hover:scale-110 cursor-pointer shadow-xl text-lg font-bold"
            aria-label="Next slide"
          >
            ›
          </button>
        </>
      )}

      {/* Bottom Center: Interactive Apple-style Carousel Dots */}
      {count > 1 && (
        <div className="absolute bottom-8 sm:bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2.5 z-30">
          {items.map((_, idx) => {
            const isActive = idx === currentIndex
            return (
              <button
                key={idx}
                type="button"
                onClick={() => goToSlide(idx)}
                className={`transition-all duration-300 rounded-full cursor-pointer ${
                  isActive
                    ? 'w-7 h-1.5 bg-white shadow-md'
                    : 'w-2 h-2 bg-white/40 hover:bg-white/70'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
