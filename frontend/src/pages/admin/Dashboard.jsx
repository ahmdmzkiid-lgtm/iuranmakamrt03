import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { Link } from 'react-router-dom'
import api from '../../services/api'

const formatRp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID')

const getBulanName = (bln) => {
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  return bulan[bln - 1] || bln
}

const shortcuts = [
  { label: 'Kelola Warga', path: '/admin/warga', icon: 'groups', desc: 'Data & status penduduk', color: 'bg-white' },
  { label: 'Kelola Iuran', path: '/admin/iuran', icon: 'payments', desc: 'Sistem iuran baru', color: 'bg-secondary-container' },
  { label: 'Notifikasi', path: '/admin/notifikasi', icon: 'notifications_active', desc: 'Kirim notifikasi push', color: 'bg-primary-container', textColor: 'text-white' },
  { label: 'Setelan', path: '/admin/setelan', icon: 'settings', desc: 'Konfigurasi sistem', color: 'bg-tertiary-fixed' },
]

export default function AdminDashboard() {
  const [statistik, setStatistik] = useState(null)
  const [dataIuran, setDataIuran] = useState([])
  const [loading, setLoading] = useState(true)

  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [statsRes, iuranRes] = await Promise.all([
          api.get('/iuran/statistik'),
          api.get('/iuran')
        ])
        setStatistik(statsRes.data)
        setDataIuran(iuranRes.data)
      } catch (error) {
        console.error('Failed to fetch dashboard data', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const pendingItems = dataIuran.filter(i => i.status === 'pending')

  const quickStats = [
    { label: 'KK Aktif', value: loading ? '...' : (statistik?.totalWarga?.toString() || '0'), icon: 'groups', bg: 'bg-primary-container', text: 'text-white' },
    { label: `Iuran Warga ${getBulanName(currentMonth)}`, value: loading ? '...' : `${statistik?.iuranWarga?.sudahBayar || 0} / ${statistik?.totalWarga || 0} KK`, icon: 'payments', bg: 'bg-secondary-container', text: 'text-black' },
    { label: 'Pending Verifikasi', value: loading ? '...' : (statistik?.pendingVerifikasi?.toString() || '0'), icon: 'pending_actions', bg: 'bg-tertiary-fixed', text: 'text-black' },
    { label: 'Total Dana Makam', value: loading ? '...' : formatRp(statistik?.iuranMakam?.totalPendapatan || 0), icon: 'receipt_long', bg: 'bg-white', text: 'text-black' },
  ]

  const aktivitas = dataIuran
    .filter(i => i.status !== 'belum_bayar' && i.status !== 'ditolak')
    .slice(0, 4)
    .map(i => ({
      waktu: i.tanggalBayar ? new Date(i.tanggalBayar).toLocaleDateString('id-ID') : '-',
      judul: `${i.warga?.user?.nama || 'Warga'} membayar ${i.tipe === 'warga' ? 'Iuran Warga' : 'Iuran Makam'}`,
      detail: `${formatRp(i.jumlah)} • ${i.metode || 'Transfer'}`
    }))

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto max-w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display-bold text-3xl md:text-4xl uppercase leading-none">Dashboard Admin</h1>
            <p className="font-body-lg text-zinc-600 mt-2">
              Ringkasan administrasi portal Iuran Makam & Warga RT 03.
            </p>
          </div>
          <div className="text-right hidden md:block">
            <p className="font-label-bold text-xs uppercase text-zinc-500">Periode Aktif</p>
            <p className="font-headline-md uppercase">{getBulanName(currentMonth)} {currentYear}</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {quickStats.map((stat) => (
            <div key={stat.label} className={`border-4 border-black p-4 md:p-6 neubrutal-shadow ${stat.bg}`}>
              <span className={`material-symbols-outlined text-2xl md:text-3xl mb-2 block ${stat.text}`}>{stat.icon}</span>
              <p className={`font-display-bold text-lg md:text-2xl ${stat.text}`}>{stat.value}</p>
              <p className={`font-label-bold text-[10px] md:text-xs uppercase opacity-70 mt-1 ${stat.text}`}>{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-8 mb-24 md:mb-0">
          {/* Left: Activity Feed */}
          <div className="w-full lg:w-[58%] space-y-6">
            <div className="bg-white border-4 border-black p-4 md:p-6 neubrutal-shadow">
              <h2 className="font-headline-md uppercase border-b-4 border-black pb-3 mb-4">Aktivitas Terbaru</h2>
              <div>
                {loading ? (
                  <p className="text-center py-4 font-bold text-xs uppercase text-zinc-500">Memuat...</p>
                ) : aktivitas.length === 0 ? (
                  <p className="text-center py-4 font-bold text-xs uppercase text-zinc-500">Belum ada aktivitas pembayaran</p>
                ) : (
                  aktivitas.map((a, i) => (
                    <div key={i} className="flex gap-4 py-3 border-b-2 border-zinc-200 last:border-b-0">
                      <div className="w-20 shrink-0">
                        <p className="font-label-bold text-[10px] uppercase text-zinc-500">{a.waktu}</p>
                      </div>
                      <div className="w-2 h-2 mt-1 rounded-full bg-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold text-sm md:text-base">{a.judul}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{a.detail}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 pt-4 border-t-2 border-black text-center">
                <Link to="/admin/iuran" className="font-label-bold uppercase text-xs hover:underline">Lihat Semua Transaksi</Link>
              </div>
            </div>
          </div>

          {/* Right: Shortcuts & Actions */}
          <div className="w-full lg:w-[42%] space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {shortcuts.map((s) => (
                <Link
                  key={s.label}
                  to={s.path}
                  className={`border-4 border-black p-4 neubrutal-shadow hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all block ${s.color} ${s.textColor || 'text-black'}`}
                >
                  <span className="material-symbols-outlined text-3xl mb-2">{s.icon}</span>
                  <h4 className="font-headline-md uppercase text-sm">{s.label}</h4>
                  <p className="text-xs opacity-70 mt-1">{s.desc}</p>
                </Link>
              ))}
            </div>

            <div className="bg-primary-fixed border-4 border-black p-4 md:p-6 neubrutal-shadow">
              <h3 className="font-headline-md uppercase mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">notifications_active</span>
                Butuh Tindakan
              </h3>
              <div className="space-y-3">
                <div className="bg-white border-2 border-black p-3 flex justify-between items-center gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm">{pendingItems.length} Konfirmasi Pembayaran</p>
                    <p className="text-[10px] text-zinc-500 uppercase">Menunggu verifikasi</p>
                  </div>
                  <Link to="/admin/iuran" className="bg-primary text-white border-2 border-black px-3 py-1 font-label-bold uppercase text-[10px] shrink-0">
                    Lihat
                  </Link>
                </div>

                <div className="bg-white border-2 border-black p-3 flex justify-between items-center gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm">{statistik?.iuranWarga?.belumBayar || 0} Warga Belum Bayar</p>
                    <p className="text-[10px] text-zinc-500 uppercase">Iuran Warga Bulan Ini</p>
                  </div>
                  <Link to="/admin/notifikasi" className="bg-tertiary-fixed text-black border-2 border-black px-3 py-1 font-label-bold uppercase text-[10px] shrink-0">
                    Kirim Notif
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
