import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSearch } from '@/data'
import { Grid } from '@/ui/Grid'

const POPULAR_SEARCHES = [
  'Dune',
  'Interstellar',
  'Sci-Fi',
  'Fantasy',
  'Animation',
  'Action',
]

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  const [query, setQuery] = useState(initialQuery)

  const { data: results, loading } = useSearch(query)

  // Sync state to URL smoothly
  useEffect(() => {
    if (query.trim()) {
      setSearchParams({ q: query }, { replace: true })
    } else {
      setSearchParams({}, { replace: true })
    }
  }, [query, setSearchParams])

  const isIdle = !query.trim()

  return (
    <div
      className={`px-4 sm:px-12 md:px-16 lg:px-20 pb-24 min-h-screen bg-[#0a0a0a] transition-all duration-500 ease-out ${
        isIdle ? 'pt-32 sm:pt-48 md:pt-52' : 'pt-24 sm:pt-32'
      }`}
    >
      {/* Apple-style Animated Glassy Search Capsule */}
      <div className="max-w-2xl sm:max-w-3xl mx-auto mb-10 transition-all duration-500">
        <div className="relative group/search">
          {/* Subtle Ambient Glassy Glow Halo (breathes with smooth animation when idle) */}
          <div
            className={`absolute -inset-2 rounded-full bg-gradient-to-r from-white/15 via-white/35 to-white/15 pointer-events-none transition-all duration-700 ${
              isIdle ? 'animate-glass-glow opacity-80' : 'opacity-20 blur-md'
            }`}
          />
          <div
            className={`absolute -inset-4 rounded-full bg-cyan-400/10 blur-2xl pointer-events-none transition-opacity duration-700 ${
              isIdle ? 'opacity-60' : 'opacity-10'
            }`}
          />

          {/* Frosted Glass Input Capsule */}
          <div className="relative flex items-center w-full bg-white/[0.08] hover:bg-white/[0.12] focus-within:bg-white/[0.14] backdrop-blur-2xl border border-white/25 focus-within:border-white/50 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_24px_rgba(255,255,255,0.06)] focus-within:shadow-[0_0_40px_rgba(255,255,255,0.18)] transition-all duration-300 overflow-hidden">
            {/* Specular Light Sheen Animation */}
            <div className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none animate-glass-sheen" />

            {/* Crisp Minimalist Search SVG Icon */}
            <span className="absolute left-4 sm:left-6 text-white/50 group-focus-within/search:text-white transition-colors pointer-events-none z-10">
              <svg
                className="w-4 h-4 sm:w-6 sm:h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>

            {/* Search Input */}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies, TV shows, genres..."
              className="w-full bg-transparent text-white placeholder-white/40 text-sm sm:text-lg px-4 py-3.5 sm:py-4.5 pl-11 sm:pl-16 pr-11 sm:pr-14 rounded-full focus:outline-none transition-all relative z-10 font-normal tracking-wide"
              autoFocus
            />

            {/* Clear Input Button */}
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3.5 sm:right-5 text-white/50 hover:text-white bg-white/10 hover:bg-white/20 active:scale-90 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all cursor-pointer z-10 shadow-sm text-xs sm:text-sm"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Idle State: Popular Quick Searches */}
        {isIdle && (
          <div className="mt-8 text-center animate-in fade-in duration-500">
            <p className="text-xs uppercase tracking-widest font-semibold text-white/40 mb-3.5">
              Popular Searches
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg mx-auto">
              {POPULAR_SEARCHES.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setQuery(term)}
                  className="bg-white/[0.06] hover:bg-white/[0.14] active:scale-95 text-white/70 hover:text-white text-xs sm:text-sm font-medium px-4 py-2 rounded-full border border-white/15 backdrop-blur-md transition-all cursor-pointer shadow-md"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results Display */}
      {isIdle ? null : loading && results.length === 0 ? (
        <Grid items={[]} loading={true} />
      ) : results.length === 0 ? (
        <div className="text-center py-20 text-white/50 animate-in fade-in duration-300">
          <p className="text-xl font-semibold mb-1">No results found for "{query}"</p>
          <p className="text-sm text-white/40">Check your spelling or try another title.</p>
        </div>
      ) : (
        <div className="animate-in fade-in duration-300">
          <h2 className="text-sm uppercase tracking-wider text-white/50 mb-6 font-semibold">
            Results for <span className="text-white">"{query}"</span>
          </h2>
          <Grid items={results} loading={false} />
        </div>
      )}
    </div>
  )
}
