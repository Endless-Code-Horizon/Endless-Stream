import { Outlet } from 'react-router-dom'
import { Navbar } from '../ui/Navbar'
import { DetailsModal } from '../details/DetailsModal'
import { AddonModal } from '../addons/AddonModal'

export function Layout() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Navbar />
      <main>
        <Outlet />
      </main>
      <DetailsModal />
      <AddonModal />
      <footer className="py-8 text-center text-xs text-white/30 tracking-wider">
        <p>© {new Date().getFullYear()} Endless Stream · All Rights Reserved</p>
      </footer>
    </div>
  )
}
