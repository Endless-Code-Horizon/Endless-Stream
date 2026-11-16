import { useEffect, useRef, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useUIStore } from '@/app/uiStore'
import { useMeta, useCatalog } from '@/data'
import { useProfileStore } from '@/profiles/profileStore'
import { useWatchlistStore } from '@/profiles/watchlistStore'

export function DetailsModal() {
  const modalMedia = useUIStore((s) => s.modalMedia)
  const closeModal = useUIStore((s) => s.closeModal)
  const openModal = useUIStore((s) => s.openModal)
  const activeProfile = useProfileStore((s) => s.getActiveProfile())
  const { isInList, addToList, removeFromList } = useWatchlistStore()

  const modalRef = useRef<HTMLDivElement>(null)
  const seasonDropdownRef = useRef<HTMLDivElement>(null)
  const [selectedSeason, setSelectedSeason] = useState(1)
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false)
  const [isLiked, setIsLiked] = useState(false)

  const { data: media, loading } = useMeta(
    modalMedia?.type || 'movie',
    modalMedia?.id || ''
  )

  // Fetch catalog for "More Like This" section
  const { data: catalogItems } = useCatalog(
    modalMedia?.type || 'movie',
    'popular'
  )

  const moreLikeThis = useMemo(() => {
    if (!catalogItems || !media) return []
    const mediaGenres = (media.genres || []).map((g) => g.toLowerCase().trim())

    // Filter out the current title completely
    const candidates = catalogItems.filter(
      (item) => item.id !== media.id && item.title.toLowerCase() !== media.title.toLowerCase()
    )

    // Score candidates based on genuine genre overlap
    const scored = candidates.map((item) => {
      let score = 0
      const itemGenres = (item.genres || []).map((g) => g.toLowerCase().trim())

      // Direct genre overlap matches
      for (const g of itemGenres) {
        if (mediaGenres.includes(g)) {
          score += 5
        }
      }

      // Subtitle genre badge overlap (e.g. "Action", "Drama")
      if (item.subtitle) {
        const subLower = item.subtitle.toLowerCase()
        for (const mg of mediaGenres) {
          if (subLower.includes(mg)) {
            score += 3
          }
        }
      }

      // Bonus for same media type
      if (item.type === media.type) {
        score += 1
      }

      // Additional tiebreaker: item rating
      score += (item.rating || 0) * 0.1

      return { item, score }
    })

    // Sort descending by genre match score
    scored.sort((a, b) => b.score - a.score)

    return scored.map((s) => s.item).slice(0, 6)
  }, [catalogItems, media])

  const inWatchlist =
    activeProfile && media ? isInList(activeProfile.id, media.id) : false

  const handleToggleWatchlist = () => {
    if (!activeProfile || !media) return
    if (inWatchlist) {
      removeFromList(activeProfile.id, media.id)
    } else {
      addToList(activeProfile.id, {
        mediaId: media.id,
        mediaType: media.type,
        title: media.title,
        poster: media.poster,
        backdrop: media.backdrop,
      })
    }
  }

  // Keyboard navigation & Esc to close
  useEffect(() => {
    if (!modalMedia) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modalMedia, closeModal])

  // Click outside to close season dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        seasonDropdownRef.current &&
        !seasonDropdownRef.current.contains(e.target as Node)
      ) {
        setIsSeasonDropdownOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reset states on title change
  useEffect(() => {
    setSelectedSeason(1)
    setIsSeasonDropdownOpen(false)
    setIsLiked(false)
  }, [modalMedia?.id])

  if (!modalMedia) return null

  const durationFormatted = () => {
    if (!media) return ''
    if (media.type === 'series') {
      const seasonCount = media.seasons?.length || 0
      if (seasonCount > 1) {
        return `${seasonCount} Seasons`
      }
      const epCount =
        media.seasons?.[0]?.episodes.length ||
        (media.runtime ? `${media.runtime}m` : '10 Episodes')
      return typeof epCount === 'number' ? `${epCount} Episodes` : epCount
    }
    if (media.runtime) {
      const h = Math.floor(media.runtime / 60)
      const m = media.runtime % 60
      return h > 0 ? `${h}h ${m}m` : `${m}m`
    }
    return '1h 45m'
  }

  // Mood / tone tags based on genres
  const getMoodTags = (genres: string[] = []) => {
    if (genres.includes('Fantasy') || genres.includes('Sci-Fi')) {
      return 'Mind-Bending, Imaginative, Dark'
    }
    if (genres.includes('Comedy') || genres.includes('Animation')) {
      return 'Charming, Feel-Good, Witty'
    }
    if (genres.includes('Action') || genres.includes('Thriller')) {
      return 'Suspenseful, Gritty, Adrenaline Rush'
    }
    return 'Compelling, Emotional, Captivating'
  }

  // Dynamic promotional hook / tagline
  const getTagline = () => {
    if (!media) return ''
    return media.subtitle || (media.genres && media.genres.length > 0 ? media.genres.slice(0, 3).join(' · ') : '')
  }

  const content = (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden bg-black/80 backdrop-blur-md flex justify-center items-end sm:items-center p-0 sm:p-4 md:p-6 sm:py-10 transition-opacity duration-500 animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal()
      }}
    >
      {/* Living Creature Modal Wrapper (Spring entrance & ambient breathing glow) */}
      <div className="relative w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto overflow-x-hidden sm:my-auto animate-modal-spring rounded-t-3xl sm:rounded-2xl">
        {/* Living Ambient Glow Aura behind modal */}
        <div className="absolute -inset-2.5 rounded-3xl bg-gradient-to-tr from-white/10 via-white/20 to-white/10 blur-2xl opacity-60 animate-glass-glow pointer-events-none hidden sm:block" />

        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          className="relative w-full bg-[#181818] text-white rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(255,255,255,0.08)] border-t sm:border border-white/20 select-none"
        >
          {/* Mobile Drag Indicator Bar */}
          <div className="sm:hidden pt-3 pb-1 flex justify-center">
            <div className="w-12 h-1 bg-white/30 rounded-full" />
          </div>

          {/* Circular Floating Close Button (Top Right) */}
          <button
            type="button"
            onClick={closeModal}
            className="absolute top-3 sm:top-4 right-3 sm:right-4 z-40 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#181818]/90 hover:bg-[#2c2c2c] flex items-center justify-center text-white text-sm sm:text-base font-bold transition-all hover:scale-110 active:scale-95 border border-white/20 cursor-pointer shadow-2xl"
            aria-label="Close"
          >
            ✕
          </button>

          {loading || !media ? (
            <div className="p-20 flex flex-col items-center justify-center min-h-[440px]">
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-white/60 font-medium tracking-wide">Loading title details...</p>
            </div>
          ) : (
            <div>
              {/* Netflix-Style Hero Banner Section with Video Preview Support */}
              <div className="relative h-64 sm:h-96 md:h-[440px] w-full overflow-hidden bg-black">
                {/* Fallback Backdrop Artwork */}
                {media.backdrop || media.poster || media.thumbnail ? (
                  <img
                    src={media.backdrop || media.poster || media.thumbnail}
                    alt={media.title}
                    className="w-full h-full object-cover filter brightness-[0.88]"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-zinc-900 to-black" />
                )}

                {/* Cinematic Netflix Vignette Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/45 to-transparent pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#181818]/70 via-transparent to-transparent w-full md:w-3/5 pointer-events-none" />

                {/* Banner Controls & Title Overlay */}
                <div className="absolute bottom-4 sm:bottom-10 left-4 sm:left-12 right-4 sm:right-12 z-20">
                  {/* Title (or Transparent Logo) */}
                  {media.logo ? (
                    <img
                      src={media.logo}
                      alt={media.title}
                      className="max-h-16 sm:max-h-28 max-w-[240px] sm:max-w-sm object-contain mb-3 sm:mb-4 drop-shadow-2xl"
                    />
                  ) : (
                    <h2 className="text-2xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-white drop-shadow-2xl mb-3 sm:mb-4 font-sans">
                      {media.title}
                    </h2>
                  )}

                  {/* Action Buttons Row */}
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    {/* Big Play Button */}
                    <Link
                      to={
                        media.type === 'series'
                          ? `/play/${media.type}/${media.id}?s=${selectedSeason}&e=1`
                          : `/play/${media.type}/${media.id}`
                      }
                      onClick={closeModal}
                      className="flex items-center gap-2 bg-white hover:bg-white/90 active:scale-95 text-black font-bold text-xs sm:text-base px-5 sm:px-7 py-2 sm:py-2.5 rounded-md transition-all shadow-2xl cursor-pointer"
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      <span>Play</span>
                    </Link>

                    {/* Add to Watchlist Circle Button */}
                    <button
                      type="button"
                      onClick={handleToggleWatchlist}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-white/40 bg-[#2a2a2a]/70 hover:border-white hover:bg-[#2a2a2a] text-white flex items-center justify-center text-xl transition-all active:scale-95 cursor-pointer shadow-lg"
                      title={inWatchlist ? 'Remove from My List' : 'Add to My List'}
                      aria-label={inWatchlist ? 'Remove from My List' : 'Add to My List'}
                    >
                      {inWatchlist ? (
                        <span className="text-sm sm:text-base font-bold">✓</span>
                      ) : (
                        <span className="text-xl sm:text-2xl leading-none font-light mb-0.5">+</span>
                      )}
                    </button>

                    {/* Thumbs Up (Like) Circle Button */}
                    <button
                      type="button"
                      onClick={() => setIsLiked(!isLiked)}
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 transition-all active:scale-95 cursor-pointer shadow-lg flex items-center justify-center ${
                        isLiked
                          ? 'border-white bg-white text-black'
                          : 'border-white/40 bg-[#2a2a2a]/70 hover:border-white hover:bg-[#2a2a2a] text-white'
                      }`}
                      title={isLiked ? 'Rated' : 'I like this'}
                      aria-label={isLiked ? 'Rated' : 'I like this'}
                    >
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Netflix Two-Column Content Details Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8 px-4 sm:px-12 py-4 sm:py-7">
                {/* Left Column: Metadata Badges, Tagline & Full Synopsis */}
                <div className="md:col-span-2 space-y-4">
                  {/* Minimal & Premium Metadata Badge Row (Release Year, HD, Subtitles, TV-MA, Runtime) */}
                  <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm">
                    {/* Release Year */}
                    {media.year && (
                      <span className="text-white/90 font-semibold">{media.year}</span>
                    )}

                    {/* Age Content Rating */}
                    <span className="text-[10px] sm:text-[11px] uppercase font-bold text-white/80 bg-white/5 border border-white/20 px-2 py-0.5 rounded tracking-wider">
                      TV-MA
                    </span>

                    {/* Runtime / Duration */}
                    <span className="text-white/70 font-medium">
                      {durationFormatted()}
                    </span>

                    {/* HD Badge */}
                    <span className="text-[10px] uppercase font-bold text-white/90 bg-white/5 border border-white/20 px-1.5 py-0.5 rounded tracking-wider">
                      HD
                    </span>

                    {/* Subtitles (CC) Badge */}
                    <span className="text-[10px] uppercase font-bold text-white/90 bg-white/5 border border-white/20 px-1.5 py-0.5 rounded tracking-wider flex items-center gap-1">
                      <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                        <path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z" />
                      </svg>
                      <span>Subtitles</span>
                    </span>

                    {/* Star Rating */}
                    {media.rating && (
                      <span className="text-xs font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/25 flex items-center gap-1">
                        <span>★</span>
                        <span>{media.rating.toFixed(1)}</span>
                      </span>
                    )}
                  </div>

                  {/* Bold Promo Hook / Tagline */}
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {getTagline()}
                  </h3>

                  {/* Full Overview Synopsis */}
                  <p className="text-white/85 text-sm sm:text-base leading-relaxed font-normal">
                    {media.overview || 'No synopsis available for this title.'}
                  </p>
                </div>

                {/* Right Column: Cast, Genres & Mood (like Netflix) */}
                <div className="md:col-span-1 space-y-3.5 text-xs sm:text-sm">
                  {/* Cast */}
                  {media.cast && media.cast.length > 0 && (
                    <div>
                      <span className="text-white/45">Cast: </span>
                      <span className="text-white/90 leading-snug">
                        {media.cast
                          .slice(0, 5)
                          .map((c) => c.name)
                          .join(', ')}
                        {media.cast.length > 5 && (
                          <span className="italic text-white/50">, more</span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Genres */}
                  {media.genres && media.genres.length > 0 && (
                    <div>
                      <span className="text-white/45">Genres: </span>
                      <span className="text-white/90 leading-snug">
                        {media.genres.join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Mood: "This show is" / "This movie is" */}
                  <div>
                    <span className="text-white/45">
                      {media.type === 'series' ? 'This show is: ' : 'This movie is: '}
                    </span>
                    <span className="text-white/90 leading-snug">
                      {getMoodTags(media.genres)}
                    </span>
                  </div>
                </div>
              </div>

              {/* TV SHOWS: Episodes List Section (Optimized for Series) */}
              {media.type === 'series' && media.seasons && media.seasons.length > 0 && (
                <div className="px-4 sm:px-12 pt-3 sm:pt-4 pb-6 sm:pb-8 border-t border-white/10">
                  {/* Episodes Header with Season Selector */}
                  <div className="flex items-center justify-between mb-4 sm:mb-5">
                    <h3 className="text-lg sm:text-2xl font-bold tracking-tight text-white">
                      Episodes
                    </h3>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-white/70 hidden sm:inline">
                        {media.title}
                      </span>
                      {media.seasons.length > 1 ? (
                        <div className="relative" ref={seasonDropdownRef}>
                          <button
                            type="button"
                            onClick={() => setIsSeasonDropdownOpen(!isSeasonDropdownOpen)}
                            className="flex items-center gap-2 bg-[#252525] hover:bg-[#303030] active:scale-95 text-white text-xs sm:text-sm font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-white/20 transition-all cursor-pointer shadow-lg"
                            aria-expanded={isSeasonDropdownOpen}
                          >
                            <span>Season {selectedSeason}</span>
                            <svg
                              className={`w-3.5 h-3.5 fill-current text-white/70 transition-transform duration-200 ${
                                isSeasonDropdownOpen ? 'rotate-180' : ''
                              }`}
                              viewBox="0 0 24 24"
                            >
                              <path d="M7 10l5 5 5-5z" />
                            </svg>
                          </button>

                          {isSeasonDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-52 bg-[#1e1e1e]/98 backdrop-blur-2xl border border-white/20 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                              {media.seasons.map((s) => {
                                const isSelected = s.season === selectedSeason
                                return (
                                  <button
                                    key={s.season}
                                    type="button"
                                    onClick={() => {
                                      setSelectedSeason(s.season)
                                      setIsSeasonDropdownOpen(false)
                                    }}
                                    className={`w-full flex items-center justify-between px-4 py-2.5 text-xs sm:text-sm transition-colors cursor-pointer ${
                                      isSelected
                                        ? 'bg-white/15 text-white font-bold'
                                        : 'text-white/70 hover:text-white hover:bg-white/10 font-medium'
                                    }`}
                                  >
                                    <span>Season {s.season}</span>
                                    <span className="text-[11px] text-white/50">
                                      {s.episodes.length} {s.episodes.length === 1 ? 'episode' : 'episodes'}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs uppercase font-bold text-white/70 bg-[#252525] px-3.5 py-1.5 rounded-lg border border-white/15">
                          Season 1
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Netflix-style Episodes List */}
                  <div className="divide-y divide-white/10">
                    {media.seasons
                      .find((s) => s.season === selectedSeason)
                      ?.episodes.map((ep) => (
                        <Link
                          key={ep.episode}
                          to={`/play/series/${media.id}?s=${selectedSeason}&e=${ep.episode}`}
                          onClick={closeModal}
                          className="flex items-start gap-3 sm:gap-6 py-4 sm:py-5 px-1.5 sm:px-4 rounded-2xl hover:bg-white/[0.06] transition-all cursor-pointer group"
                        >
                          {/* Episode Number */}
                          <span className="text-base sm:text-2xl font-extrabold text-white/40 group-hover:text-white w-5 sm:w-8 text-center shrink-0 transition-colors pt-1 sm:pt-1.5">
                            {ep.episode}
                          </span>

                          {/* 16:9 Thumbnail Preview */}
                          <div className="relative w-28 sm:w-40 aspect-video rounded-lg overflow-hidden bg-neutral-900 shrink-0 border border-white/10 shadow-md">
                            <img
                              src={ep.thumbnail || media.backdrop || media.poster}
                              alt={ep.title}
                              onError={(e) => {
                                const target = e.currentTarget
                                if (media.backdrop && target.src !== media.backdrop) {
                                  target.src = media.backdrop
                                } else if (media.poster && target.src !== media.poster) {
                                  target.src = media.poster
                                }
                              }}
                              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                            />
                            {/* Play overlay icon */}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/95 text-black flex items-center justify-center shadow-xl">
                                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current translate-x-0.5" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </div>
                            </div>
                          </div>

                          {/* Title, Runtime & Full Overview (No truncation or vertical chop) */}
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-baseline justify-between gap-2 mb-1.5">
                              <h4 className="font-bold text-white text-xs sm:text-base group-hover:text-white transition-colors leading-snug">
                                {ep.title}
                              </h4>
                              <span className="text-[11px] sm:text-xs text-white/50 font-medium shrink-0 ml-2 tabular-nums">
                                {media.runtime ? `${media.runtime}m` : '50m'}
                              </span>
                            </div>
                            {ep.overview && (
                              <p className="text-xs sm:text-sm text-white/70 leading-relaxed font-normal whitespace-normal break-words">
                                {ep.overview}
                              </p>
                            )}
                          </div>
                        </Link>
                      ))}
                  </div>
                </div>
              )}

              {/* "More Like This" Recommendations Grid */}
              {moreLikeThis.length > 0 && (
                <div className="px-4 sm:px-12 pt-5 sm:pt-6 pb-8 border-t border-white/10">
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-4">
                    More Like This
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                    {moreLikeThis.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => openModal(item.type, item.id)}
                        className="bg-[#242424] rounded-xl overflow-hidden border border-white/10 hover:border-white/30 transition-all cursor-pointer group flex flex-col"
                      >
                        {/* Thumbnail with duration tag */}
                        <div className="relative aspect-video w-full bg-neutral-900 overflow-hidden">
                          <img
                            src={item.thumbnail || item.backdrop || item.poster}
                            alt={item.title}
                            onError={(e) => {
                              const target = e.currentTarget
                              if (item.poster && target.src !== item.poster) {
                                target.src = item.poster
                              }
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-white/80">
                            {item.type === 'series' ? 'TV' : 'HD'}
                          </div>
                        </div>

                        {/* Card Content */}
                        <div className="p-3.5 flex flex-col flex-1 justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              {item.rating ? (
                                <span className="text-amber-400 font-bold text-xs flex items-center gap-1">
                                  <span>★</span>
                                  <span>{item.rating.toFixed(1)}</span>
                                </span>
                              ) : item.year ? (
                                <span className="text-white/60 font-semibold text-xs">
                                  {item.year}
                                </span>
                              ) : (
                                <span className="text-white/60 font-semibold text-xs">
                                  {item.subtitle || 'Featured'}
                                </span>
                              )}
                              <span className="text-[10px] text-white/80 border border-white/30 px-1 rounded">
                                {item.type === 'series' ? 'TV-MA' : 'PG-13'}
                              </span>
                            </div>

                            <h4 className="font-bold text-white text-sm truncate group-hover:text-white mb-1">
                              {item.title}
                            </h4>

                            <p className="text-xs text-white/55 line-clamp-2 leading-relaxed">
                              {item.subtitle || (item.genres && item.genres.length > 0 ? item.genres.slice(0, 2).join(' · ') : '')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
