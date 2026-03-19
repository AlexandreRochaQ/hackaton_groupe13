import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Sidebar from './Sidebar.jsx'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — always visible on desktop, toggled on mobile */}
      <div className={`${sidebarOpen ? 'flex' : 'hidden'} md:flex z-30 md:z-auto fixed md:static h-full`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <main className="flex-1 min-h-0 overflow-auto">
        {/* Mobile top bar with hamburger */}
        <div className="md:hidden flex items-center gap-3 px-4 h-12 border-b border-slate-200 bg-white sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-500 hover:text-slate-700"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-slate-700">DocFlow</span>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
