import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import api from '../../services/api'

const navItems = [
  { label: 'Dashboard', path: '/warga', icon: 'dashboard' },
  { label: 'Tagihan', path: '/warga/tagihan', icon: 'payments' },
  { label: 'Riwayat', path: '/warga/riwayat', icon: 'history' },
  { label: 'Makam', path: '/warga/makam', icon: 'church' },
  { label: 'Kuitansi', path: '/warga/kuitansi', icon: 'receipt_long' },
  { label: 'Setelan', path: '/warga/setelan', icon: 'settings' },
]


const mobileNavItems = [
  { label: 'Dash', path: '/warga', icon: 'dashboard' },
  { label: 'Bill', path: '/warga/tagihan', icon: 'payments' },
  { label: 'Hist', path: '/warga/riwayat', icon: 'history' },
  { label: 'Makam', path: '/warga/makam', icon: 'church' },
  { label: 'Receipt', path: '/warga/kuitansi', icon: 'receipt_long' },
  { label: 'Set', path: '/warga/setelan', icon: 'settings' },
]

export default function WargaLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path) => location.pathname === path

  const handleLogout = () => {
    localStorage.clear()
    navigate('/')
  }

  const [notifications, setNotifications] = useState([])
  const [showNotif, setShowNotif] = useState(false)

  const fetchNotifs = async () => {
    try {
      const res = await api.get('/notifications')
      setNotifications(res.data)
    } catch (error) {
      console.error('Failed to fetch notifs', error)
    }
  }

  useEffect(() => {
    fetchNotifs()
    const interval = setInterval(fetchNotifs, 60000) // Polling every minute
    return () => clearInterval(interval)
  }, [])

  const unreadCount = notifications.filter(n => !n.isRead).length

  const handleMarkRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`)
      fetchNotifs()
    } catch (error) {
      console.error('Failed to mark read', error)
    }
  }

  const handleReadAll = async () => {
    try {
      await api.put('/notifications/read-all')
      fetchNotifs()
    } catch (error) {
      console.error('Failed to mark all read', error)
    }
  }

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex justify-between items-center px-4 md:px-6 h-20 w-full z-50 fixed top-0 left-0">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <div className="bg-black text-white px-3 py-1 border-2 border-black rotate-[-1deg] neubrutal-shadow-sm">
            <h1 className="font-['Inter'] font-black uppercase tracking-tight text-sm md:text-base leading-tight">
              IURAN MAKAM <span className="text-primary-fixed">RT 03</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4 shrink-0 relative">
          <div className="relative">
            <button 
              onClick={() => setShowNotif(!showNotif)}
              className="material-symbols-outlined cursor-pointer hover:bg-tertiary-fixed p-2 border-2 border-transparent hover:border-black transition-all"
            >
              notifications
            </button>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-error text-white text-[8px] font-black flex items-center justify-center border-2 border-black rounded-full">
                {unreadCount}
              </span>
            )}

            {/* Notification Dropdown */}
            {showNotif && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setShowNotif(false)} />
                <div className="absolute right-0 mt-2 w-80 bg-white border-4 border-black neubrutal-shadow-lg z-[70] animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-3 border-b-4 border-black flex justify-between items-center bg-zinc-100">
                    <h3 className="font-headline-md text-xs uppercase">Notifikasi</h3>
                    {unreadCount > 0 && (
                      <button onClick={handleReadAll} className="text-[10px] font-black uppercase underline hover:text-primary">Baca Semua</button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <span className="material-symbols-outlined text-zinc-300 text-4xl mb-2">notifications_off</span>
                        <p className="text-xs font-bold uppercase text-zinc-400">Tidak ada notifikasi</p>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          className={`p-3 border-b-2 border-black last:border-b-0 hover:bg-zinc-50 transition-colors ${!n.isRead ? 'bg-primary-container/10' : ''}`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <p className="font-black text-[10px] uppercase text-primary">{n.title}</p>
                            <span className="text-[8px] font-bold text-zinc-400">{new Date(n.createdAt).toLocaleDateString()}</span>
                          </div>
                          <p className="text-xs leading-tight mb-2">{n.message}</p>
                          {!n.isRead && (
                            <button 
                              onClick={() => handleMarkRead(n.id)}
                              className="text-[8px] font-black uppercase bg-black text-white px-2 py-0.5 border border-black hover:bg-primary transition-colors"
                            >
                              Tandai Dibaca
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <Link to="/warga/setelan" className="material-symbols-outlined cursor-pointer hover:bg-tertiary-fixed p-2 border-2 border-transparent hover:border-black transition-all">
            account_circle
          </Link>
        </div>
      </header>

      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col h-screen w-64 border-r-4 border-black fixed left-0 top-0 bg-white pt-24 pb-6 overflow-y-auto z-40">
        <div className="px-6 mb-8">
          <div className="flex items-center gap-3 p-3 border-2 border-black bg-surface-container-low neubrutal-shadow">
            <div className="w-10 h-10 bg-tertiary-fixed border-2 border-black flex items-center justify-center">
              <span className="material-symbols-outlined">person</span>
            </div>
            <div>
              <p className="font-['Inter'] font-bold text-xs uppercase">{localStorage.getItem('nama') || 'Nama Warga'}</p>
              <p className="text-[10px] uppercase opacity-60 font-bold">WARGA RT 03</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`m-2 flex items-center gap-3 p-3 border-2 border-black transition-all font-['Inter'] font-bold text-sm uppercase ${
                isActive(item.path)
                  ? 'bg-primary text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-white hover:bg-emerald-400 hover:text-black active:translate-x-1 active:translate-y-1 active:shadow-none'
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto px-2 space-y-1 border-t-4 border-black pt-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 font-['Inter'] font-bold text-sm uppercase hover:bg-error hover:text-white text-left"
          >
            <span className="material-symbols-outlined">logout</span>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="pt-28 pb-24 md:pb-12 md:pl-72 px-4 md:px-6 overflow-x-hidden">
        {children}

        <footer className="mt-16 md:mt-32 pb-8 border-t-4 border-black pt-8 flex flex-col items-center gap-2 text-center">
          <p className="font-label-bold uppercase text-[10px] md:text-xs">
            © 2026 Iuran Makam RT 03 - Limo. DIBUAT OLEH <a href="https://ahmdmzki.web.id" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary transition-colors">ahmdmzki.web.id</a>
          </p>
          <p className="text-[9px] uppercase font-bold text-zinc-400">
            Portal Warga - Sistem Informasi Iuran Lingkungan
          </p>
        </footer>
      </main>

      {/* Bottom Navigation for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t-4 border-black z-50 flex justify-around items-center h-20 px-2 shadow-[0px_-4px_0px_0px_rgba(0,0,0,1)]">
        {mobileNavItems.map((item) => (
          <Link
            key={item.label}
            to={item.path}
            className={`flex flex-col items-center gap-1 transition-all p-2 ${
              isActive(item.path) ? 'text-primary' : 'text-black'
            }`}
          >
            <span
              className="material-symbols-outlined"
              style={isActive(item.path) ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : {}}
            >
              {item.icon}
            </span>
            <span className="text-[10px] font-black uppercase">{item.label}</span>
          </Link>
        ))}
      </nav>

    </div>
  )
}
