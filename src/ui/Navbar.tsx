import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useProfileStore, AVATAR_OPTIONS } from '@/profiles/profileStore'
import { useUIStore } from '@/app/uiStore'
import { Logo } from '@/ui/Logo'

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/movies', label: 'Movies' },
  { to: '/shows', label: 'TV Shows' },
  { to: '/my-list', label: 'My List' },
] as const

const MOBILE_NAV_ITEMS = [
  {
    to: '/',
    end: true,
    label: 'Home',
    icon: (
      <svg className="w-4 h-4 fill-current mb-0.5 relative z-10" viewBox="0 0 24 24">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
      </svg>
    ),
  },
  {
    to: '/movies',
    end: false,
    label: 'Movies',
    icon: (
      <svg className="w-4 h-4 fill-current mb-0.5 relative z-10" viewBox="0 0 24 24">
        <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
      </svg>
    ),
  },
  {
    to: '/shows',
    end: false,
    label: 'Series',
    icon: (
      <svg className="w-4 h-4 fill-current mb-0.5 relative z-10" viewBox="0 0 24 24">
        <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" />
      </svg>
    ),
  },
  {
    to: '/my-list',
    end: false,
    label: 'My List',
    icon: (
      <svg className="w-4 h-4 fill-current mb-0.5 relative z-10" viewBox="0 0 24 24">
        <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z" />
      </svg>
    ),
  },
  {
    to: '/search',
    end: false,
    label: 'Search',
    icon: (
      <svg className="w-4 h-4 fill-current mb-0.5 relative z-10" viewBox="0 0 24 24">
        <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
      </svg>
    ),
  },
]

export function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isScrolled, setIsScrolled] = useState(false)
  const openAddonModal = useUIStore((s) => s.openAddonModal)

  const activeProfile = useProfileStore((s) => s.getActiveProfile())
  const selectProfile = useProfileStore((s) => s.selectProfile)

  const avatar = AVATAR_OPTIONS.find((a) => a.id === activeProfile?.avatar) || AVATAR_OPTIONS[0]
  const isSearchActive = location.pathname === '/search'

  // Scroll listener: logo stays in its place at page top, fades when scrolling down
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 25)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      {/* 1. DESKTOP & TABLET TOP NAVBAR (>= md) */}
      <header className="fixed top-3 sm:top-5 left-0 right-0 z-50 hidden md:flex items-center justify-between px-6 sm:px-12 pointer-events-none">
        {/* Brand Logo Mark (Stays in its place at top, fades out on deep scroll) */}
        <div
          className={`pointer-events-auto flex items-center transition-all duration-300 ${
            isScrolled ? 'opacity-0 -translate-y-3 pointer-events-none' : 'opacity-100 translate-y-0'
          }`}
        >
          <NavLink
            to="/"
            className="cursor-pointer transition-transform hover:scale-105 active:scale-95"
            aria-label="Endless Stream Home"
          >
            <Logo size="md" />
          </NavLink>
        </div>

        {/* Floating Living Apple TV+ Capsule Navigation Bar (Strict Mathematically Top-Centered) */}
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-auto group/navbar">
          {/* Living Ambient Aura Behind Capsule */}
          <div className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-white/10 via-white/30 to-white/10 blur-xl opacity-40 group-hover/navbar:opacity-90 group-hover/navbar:scale-105 group-hover/navbar:blur-2xl transition-all duration-700 pointer-events-none" />

          <nav className="relative flex items-center bg-[#181818]/80 hover:bg-[#1e1e1e]/92 backdrop-blur-3xl border border-white/15 hover:border-white/35 rounded-full p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.7),0_0_15px_rgba(255,255,255,0.05)] hover:shadow-[0_22px_60px_rgba(0,0,0,0.85),0_0_35px_rgba(255,255,255,0.15)] hover:scale-[1.025] hover:-translate-y-0.5 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
            <div className="flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  className={({ isActive }) =>
                    `relative text-sm font-medium px-5 py-2 rounded-full transition-all duration-300 select-none overflow-hidden ${
                      isActive
                        ? 'bg-gradient-to-b from-white via-white to-neutral-200 text-black font-bold shadow-[0_0_18px_rgba(255,255,255,0.45)] group-hover/navbar:shadow-[0_0_28px_rgba(255,255,255,0.8),0_0_12px_rgba(255,255,255,0.95)] group-hover/navbar:scale-[1.02]'
                        : 'text-white/75 hover:text-white hover:bg-white/10 hover:scale-105'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/70 to-transparent rounded-t-full pointer-events-none" />
                      )}
                      <span className="relative z-10">{link.label}</span>
                    </>
                  )}
                </NavLink>
              ))}

              {/* Search Button */}
              <button
                type="button"
                onClick={() => navigate('/search')}
                className={`relative px-3 py-2 rounded-full transition-all duration-300 cursor-pointer overflow-hidden ${
                  isSearchActive
                    ? 'bg-gradient-to-b from-white via-white to-neutral-200 text-black shadow-[0_0_18px_rgba(255,255,255,0.45)] group-hover/navbar:shadow-[0_0_28px_rgba(255,255,255,0.8),0_0_12px_rgba(255,255,255,0.95)]'
                    : 'text-white/75 hover:text-white hover:bg-white/10 hover:scale-105'
                }`}
                title="Search"
                aria-label="Search"
              >
                {isSearchActive && (
                  <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/70 to-transparent rounded-t-full pointer-events-none" />
                )}
                <svg className="w-4 h-4 fill-current relative z-10" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                </svg>
              </button>

              {/* Stremio Addons Trigger */}
              <button
                type="button"
                onClick={openAddonModal}
                className="relative px-2.5 py-2 rounded-full text-white/75 hover:text-white hover:bg-white/10 hover:scale-105 transition-all duration-300 cursor-pointer"
                title="Stremio Addons & Streams"
                aria-label="Stremio Addons"
              >
                <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </button>
            </div>

            <div className="h-4 w-px bg-white/20 mx-1.5" />

            {/* Profile Avatar Button (Tap to open Profile Page directly, no dropdown menu) */}
            <button
              type="button"
              onClick={() => selectProfile('')}
              className="flex items-center gap-1.5 p-0.5 rounded-full hover:ring-2 hover:ring-white/60 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
              title="Manage Profiles"
              aria-label="Manage Profiles"
            >
              <div className="w-7 h-7 rounded-full overflow-hidden bg-black/60 border border-white/25 shadow-md">
                <img
                  src={avatar?.image || '/avatars/lion.jpg'}
                  alt={activeProfile?.name || 'Profile'}
                  className="w-full h-full object-cover"
                />
              </div>
            </button>
          </nav>
        </div>
      </header>

      {/* 2. MOBILE TOP HEADER (< md) */}
      <header className="fixed top-0 left-0 right-0 z-40 md:hidden flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/90 via-black/60 to-transparent backdrop-blur-md">
        <NavLink to="/" className="flex items-center gap-2 cursor-pointer" aria-label="Home">
          <Logo size="sm" />
        </NavLink>

        <div className="flex items-center gap-2">
          {/* Addons quick trigger */}
          <button
            type="button"
            onClick={openAddonModal}
            className="p-2 rounded-full text-white/80 hover:text-white bg-white/10 backdrop-blur-lg border border-white/10"
            aria-label="Addons"
          >
            <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </button>

          {/* Profile Avatar */}
          <button
            type="button"
            onClick={() => selectProfile('')}
            className="w-8 h-8 rounded-full overflow-hidden border border-white/25 shadow-md"
            title="Profile"
          >
            <img
              src={avatar?.image || '/avatars/lion.jpg'}
              alt={activeProfile?.name || 'Profile'}
              className="w-full h-full object-cover"
            />
          </button>
        </div>
      </header>

      {/* 3. MOBILE LIVING CREATURE BOTTOM TAB BAR (< md) */}
      <div className="fixed bottom-3 left-3 right-3 z-50 md:hidden pointer-events-auto">
        {/* Living Ambient Aura Behind Mobile Capsule */}
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-white/10 via-white/25 to-white/10 blur-xl opacity-60 pointer-events-none" />

        <nav className="relative bg-[#161616]/92 backdrop-blur-2xl border border-white/20 rounded-full px-2 py-1.5 shadow-[0_12px_36px_rgba(0,0,0,0.85),0_0_20px_rgba(255,255,255,0.08)] flex items-center justify-around">
          {MOBILE_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center py-1.5 px-3 sm:px-4 rounded-full transition-all duration-300 select-none overflow-hidden ${
                  isActive
                    ? 'bg-gradient-to-b from-white via-white to-neutral-200 text-black font-bold shadow-[0_0_20px_rgba(255,255,255,0.7),0_0_8px_rgba(255,255,255,0.95)] scale-[1.03]'
                    : 'text-white/60 hover:text-white hover:bg-white/10 active:scale-95'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/70 to-transparent rounded-t-full pointer-events-none" />
                  )}
                  {item.icon}
                  <span className="text-[10px] tracking-tight relative z-10 leading-none">
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  )
}
