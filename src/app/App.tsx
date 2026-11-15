import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { Layout } from './Layout'
import { ProfileGate } from '../profiles/ProfileGate'

// Lazy-loaded pages (keeps bundle small)
const Home = lazy(() => import('../pages/Home').then(m => ({ default: m.Home })))
const Movies = lazy(() => import('../pages/Movies').then(m => ({ default: m.Movies })))
const Shows = lazy(() => import('../pages/Shows').then(m => ({ default: m.Shows })))
const Search = lazy(() => import('../pages/Search').then(m => ({ default: m.Search })))
const MyList = lazy(() => import('../pages/MyList').then(m => ({ default: m.MyList })))
const Player = lazy(() => import('../player/PlayerPage').then(m => ({ default: m.PlayerPage })))

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#141414]">
      <div className="w-10 h-10 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <ProfileGate>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={
              <Suspense fallback={<PageFallback />}><Home /></Suspense>
            } />
            <Route path="/movies" element={
              <Suspense fallback={<PageFallback />}><Movies /></Suspense>
            } />
            <Route path="/shows" element={
              <Suspense fallback={<PageFallback />}><Shows /></Suspense>
            } />
            <Route path="/search" element={
              <Suspense fallback={<PageFallback />}><Search /></Suspense>
            } />
            <Route path="/my-list" element={
              <Suspense fallback={<PageFallback />}><MyList /></Suspense>
            } />
          </Route>
          <Route path="/play/:type/:id" element={
            <Suspense fallback={<PageFallback />}><Player /></Suspense>
          } />
        </Routes>
      </ProfileGate>
    </BrowserRouter>
  )
}
