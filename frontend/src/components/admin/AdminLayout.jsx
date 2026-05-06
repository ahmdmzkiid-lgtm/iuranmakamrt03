import { Link, useLocation, useNavigate } from 'react-router-dom'

const navItems = [
  { label: 'Dashboard', path: '/admin', icon: 'dashboard' },
  { label: 'Residents', path: '/admin/warga', icon: 'groups' },
  { label: 'Makam', path: '/admin/makam', icon: 'church' },
  { label: 'Fees', path: '/admin/iuran', icon: 'payments' },
  { label: 'Settings', path: '/admin/setelan', icon: 'settings' },
]

const topNavItems = [
  { label: 'Dashboard', path: '/admin' },
  { label: 'Residents', path: '/admin/warga' },
  { label: 'Makam', path: '/admin/makam' },
  { label: 'Fees', path: '/admin/iuran' },
]

const mobileNavItems = [
  { label: 'Dash', path: '/admin', icon: 'dashboard' },
  { label: 'Resident', path: '/admin/warga', icon: 'groups' },
  { label: 'Makam', path: '/admin/makam', icon: 'church' },
  { label: 'Fees', path: '/admin/iuran', icon: 'payments' },
]

export default function AdminLayout({ children, activeLabel = 'Dashboard' }) {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path) => location.pathname === path

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    navigate('/')
  }

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen">
      {/* TopAppBar */}
      <header className="bg-white border-b-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex justify-between items-center px-4 md:px-6 h-20 w-full z-50 fixed top-0 left-0">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <div className="bg-black text-white px-3 py-1 border-2 border-black rotate-[-1deg] neubrutal-shadow-sm">
            <h1 className="font-['Inter'] font-black uppercase tracking-tight text-sm md:text-base leading-tight">
              IURAN MAKAM <span className="text-primary-fixed">RT 03</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-6 shrink-0">
          <div className="hidden md:flex items-center gap-4 border-2 border-black bg-white px-3 py-1 neubrutal-shadow">
            <span className="material-symbols-outlined">search</span>
            <input
              className="border-none focus:ring-0 text-label-bold bg-transparent outline-none"
              placeholder="Cari data..."
              type="text"
            />
          </div>
          <div className="flex items-center gap-1 md:gap-3">
            <button className="material-symbols-outlined text-black hover:bg-tertiary-fixed p-1 md:p-2 transition-colors">
              notifications
            </button>
            <Link to="/admin/setelan" className="material-symbols-outlined text-black hover:bg-tertiary-fixed p-1 md:p-2 transition-colors">
              account_circle
            </Link>
          </div>
        </div>
      </header>

      <div className="flex pt-20">
        {/* SideNavBar */}
        <aside className="hidden md:flex h-screen w-64 border-r-4 border-black fixed left-0 top-0 flex-col pt-24 pb-6 overflow-y-auto bg-white shadow-[4px_0px_0px_0px_rgba(0,0,0,1)] z-40">
          <div className="px-4 mb-8">
            <div className="flex items-center gap-3 p-3 border-2 border-black bg-white neubrutal-shadow">
              <div className="w-10 h-10 bg-surface-container border-2 border-black flex items-center justify-center">
                <span className="material-symbols-outlined">person</span>
              </div>
              <div>
                <p className="font-label-bold text-xs uppercase">ADMIN</p>
                <p className="text-[10px] uppercase font-bold text-zinc-500">RT 03</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 px-2 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`border-2 border-black flex items-center gap-3 p-3 font-['Inter'] font-bold text-sm uppercase transition-all ${
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
          <div className="px-2 mt-auto pt-6 border-t-2 border-black space-y-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 p-3 font-['Inter'] font-bold text-sm uppercase bg-zinc-100 text-black border-2 border-black hover:bg-error hover:text-white transition-all text-left"
            >
              <span className="material-symbols-outlined">logout</span>
              Logout
            </button>
          </div>
        </aside>

        {/* Main Content Canvas */}
        <main className="flex-1 ml-0 md:ml-64 p-4 md:p-gutter pb-24 md:pb-4 bg-surface overflow-x-hidden">
          {children}
          
          <footer className="mt-12 md:mt-24 pb-8 border-t-4 border-black pt-8 flex flex-col items-center gap-2 text-center">
            <p className="font-label-bold uppercase text-[10px] md:text-xs">
              © 2026 Iuran Makam RT 03 - Limo. DIBUAT OLEH <a href="https://ahmdmzki.web.id" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary transition-colors">ahmdmzki.web.id</a>
            </p>
            <p className="text-[9px] uppercase font-bold text-zinc-400">
              Sistem Informasi Pengelolaan Iuran Lingkungan
            </p>
          </footer>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t-4 border-black z-50 flex justify-around items-center h-20 px-2 shadow-[0px_-4px_0px_0px_rgba(0,0,0,1)]">
        {mobileNavItems.map((item) => (
          <Link
            key={item.path}
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
