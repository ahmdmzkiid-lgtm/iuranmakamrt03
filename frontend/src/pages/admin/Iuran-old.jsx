import { useState, useEffect, useRef, useMemo } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import api from '../../services/api'
import { useNotification } from '../../context/NotificationContext'

const formatRp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID')

const getBulanName = (bln) => {
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  return bulan[bln - 1] || bln
}

export default function AdminIuran() {
  const [activeTab, setActiveTab] = useState('warga') // 'warga' | 'makam' | 'pending'
  const [dataIuran, setDataIuran] = useState([])
  const [wargaProgress, setWargaProgress] = useState([])
  const [statistik, setStatistik] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedBukti, setSelectedBukti] = useState(null)
  const [showRekamModal, setShowRekamModal] = useState(false)
  const [wargaList, setWargaList] = useState([])
  const [rekamData, setRekamData] = useState({ 
    wargaId: '', 
    tipe: 'semua', // 'warga' | 'makam' | 'semua'
    jumlahBulanMakam: 1,
    bulanWarga: new Date().getMonth() + 1,
    tahunWarga: new Date().getFullYear()
  })
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectId, setRejectId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [wargaSearch, setWargaSearch] = useState('')
  const [showWargaDropdown, setShowWargaDropdown] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 10
  const wargaDropdownRef = useRef(null)
  const { showAlert, showConfirm } = useNotification()

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wargaDropdownRef.current && !wargaDropdownRef.current.contains(e.target)) {
        setShowWargaDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [iuranRes, progressRes, statsRes] = await Promise.all([
        api.get('/iuran'),
        api.get('/iuran/progress'),
        api.get('/iuran/statistik')
      ])
      setDataIuran(iuranRes.data)
      setWargaProgress(progressRes.data)
      setStatistik(statsRes.data)
    } catch (error) {
      console.error('Failed to fetch data', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchWarga = async () => {
    try {
      const res = await api.get('/warga')
      const sortedWarga = [...res.data].sort((a, b) => {
        const nameA = a.user?.nama || ''
        const nameB = b.user?.nama || ''
        return nameA.localeCompare(nameB, 'id', { sensitivity: 'base' })
      })
      setWargaList(sortedWarga)
    } catch (error) {
      console.error('Failed to fetch warga', error)
    }
  }

  useEffect(() => {
    fetchData()
    fetchWarga()
  }, [])

  const handleVerifikasi = async (id, isTransaksi = false, action) => {
    if (action === 'tolak') {
      setRejectId(id)
      setRejectReason('')
      setShowRejectModal(true)
      return
    }

    try {
      setIsProcessing(true)
      if (isTransaksi) {
        await api.put(`/iuran/verifikasi-transaksi/${id}`, { action })
      } else {
        await api.put(`/iuran/${id}/verifikasi`, { action })
      }
      await showAlert('Pembayaran berhasil diverifikasi!')
      fetchData()
    } catch (error) {
      console.error('Verifikasi error', error)
      showAlert('Gagal memverifikasi pembayaran')
    } finally {
      setIsProcessing(false)
    }
  }

  const submitReject = async () => {
    if (!rejectReason) return showAlert('Mohon isi alasan penolakan')
    try {
      setIsProcessing(true)
      // Cek apakah id yang ditolak adalah transaksiId (string) atau iuranId (number)
      const isTx = typeof rejectId === 'string'
      if (isTx) {
        await api.put(`/iuran/verifikasi-transaksi/${rejectId}`, { action: 'tolak', alasan: rejectReason })
      } else {
        await api.put(`/iuran/${rejectId}/verifikasi`, { action: 'tolak', alasan: rejectReason })
      }
      await showAlert('Pembayaran ditolak.')
      setShowRejectModal(false)
      fetchData()
    } catch (error) {
      console.error('Reject error', error)
      showAlert('Gagal menolak pembayaran')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRekamBayar = async (e) => {
    e.preventDefault()
    if (!rekamData.wargaId) return showAlert('Pilih warga terlebih dahulu')

    try {
      setIsProcessing(true)
      let endpoint = '/iuran/admin/bayar-semua'
      let payload = {
        wargaId: rekamData.wargaId,
        jumlahBulanMakam: rekamData.jumlahBulanMakam,
        bulanWarga: rekamData.bulanWarga,
        tahunWarga: rekamData.tahunWarga
      }

      if (rekamData.tipe === 'warga') {
        endpoint = '/iuran/admin/bayar-warga'
        payload = {
          wargaId: rekamData.wargaId,
          bulan: rekamData.bulanWarga,
          tahun: rekamData.tahunWarga
        }
      } else if (rekamData.tipe === 'makam') {
        endpoint = '/iuran/admin/bayar-makam'
        payload = {
          wargaId: rekamData.wargaId,
          jumlahBulan: rekamData.jumlahBulanMakam
        }
      }

      await api.post(endpoint, payload)
      await showAlert('Pembayaran offline berhasil dicatat!')
      setShowRekamModal(false)
      setRekamData({
        wargaId: '',
        tipe: 'semua',
        jumlahBulanMakam: 1,
        bulanWarga: new Date().getMonth() + 1,
        tahunWarga: new Date().getFullYear()
      })
      setWargaSearch('')
      fetchData()
    } catch (error) {
      console.error('Rekam bayar error', error)
      showAlert(error.response?.data?.message || 'Gagal mencatat pembayaran')
    } finally {
      setIsProcessing(false)
    }
  }

  // Group pending items by transaksiId or individual id
  const pendingTransactions = useMemo(() => {
    const pendingList = dataIuran.filter(i => i.status === 'pending')
    const grouped = {}

    pendingList.forEach(item => {
      const key = item.transaksiId || `SINGLE-${item.id}`
      if (!grouped[key]) {
        grouped[key] = {
          id: key,
          isTx: !!item.transaksiId,
          warga: item.warga,
          items: [],
          total: 0,
          buktiBayar: item.buktiBayar,
          metode: item.metode,
          tanggalBayar: item.tanggalBayar
        }
      }
      grouped[key].items.push(item)
      grouped[key].total += Number(item.jumlah)
    })

    return Object.values(grouped)
  }, [dataIuran])

  const filteredWargaProgress = useMemo(() => {
    if (!wargaSearch) return wargaProgress
    return wargaProgress.filter(w => 
      w.nama.toLowerCase().includes(wargaSearch.toLowerCase()) || 
      w.nomorKK?.includes(wargaSearch)
    )
  }, [wargaProgress, wargaSearch])

  const filteredHistory = useMemo(() => {
    return dataIuran.filter(i => 
      i.status === 'lunas' || i.status === 'ditolak'
    ).filter(i => {
      if (activeTab === 'pending') return false
      return i.tipe === activeTab
    })
  }, [dataIuran, activeTab])

  // Pagination for History
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredHistory.slice(start, start + PAGE_SIZE)
  }, [filteredHistory, currentPage])

  const totalPages = Math.ceil(filteredHistory.length / PAGE_SIZE) || 1

  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab])

  const selectedWargaLabel = useMemo(() => {
    const selected = wargaList.find(w => w.id === parseInt(rekamData.wargaId))
    return selected ? `${selected.user?.nama} (${selected.user?.nomorKK})` : ''
  }, [rekamData.wargaId, wargaList])

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        {/* Header Section */}
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display-bold text-3xl md:text-4xl uppercase leading-none">Kelola Pembayaran</h1>
            <p className="font-body-md text-zinc-600 mt-2">
              Sistem iuran bulanan warga dan pembayaran makam (36 bulan wajib bayar).
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => {
                setShowRekamModal(true)
                setWargaSearch('')
                setRekamData({
                  wargaId: '',
                  tipe: 'semua',
                  jumlahBulanMakam: 1,
                  bulanWarga: new Date().getMonth() + 1,
                  tahunWarga: new Date().getFullYear()
                })
              }}
              className="bg-primary text-white border-4 border-black px-6 py-3 font-headline-md uppercase neubrutal-shadow active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center gap-2 text-sm md:text-base cursor-pointer"
            >
              <span className="material-symbols-outlined">payments</span>
              Rekam Bayar Offline
            </button>
          </div>
        </header>

        {/* Statistik Cards */}
        {statistik && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-primary-container text-white border-4 border-black p-4 neubrutal-shadow">
              <p className="text-xs uppercase font-bold opacity-80">Total Warga</p>
              <p className="text-3xl font-display-bold mt-1">{statistik.totalWarga} KK</p>
            </div>
            <div className="bg-secondary-container text-black border-4 border-black p-4 neubrutal-shadow">
              <p className="text-xs uppercase font-bold opacity-70">Iuran Warga Bulan Ini</p>
              <p className="text-3xl font-display-bold mt-1">{statistik.iuranWarga?.sudahBayar} / {statistik.totalWarga} KK</p>
              <p className="text-xs font-bold mt-2 text-zinc-600">Pendapatan: {formatRp(statistik.iuranWarga?.pendapatan)}</p>
            </div>
            <div className="bg-tertiary-fixed text-black border-4 border-black p-4 neubrutal-shadow">
              <p className="text-xs uppercase font-bold opacity-70">Makam Lunas (36 Bln)</p>
              <p className="text-3xl font-display-bold mt-1">{statistik.iuranMakam?.wargaLunas36Bulan} KK</p>
              <p className="text-xs font-bold mt-2 text-zinc-600">Total Masuk: {formatRp(statistik.iuranMakam?.totalPendapatan)}</p>
            </div>
            <div className="bg-white text-black border-4 border-black p-4 neubrutal-shadow">
              <p className="text-xs uppercase font-bold opacity-70">Pending Konfirmasi</p>
              <p className="text-3xl font-display-bold mt-1 text-primary">{statistik.pendingVerifikasi}</p>
              <p className="text-xs font-bold mt-2 text-zinc-500">Butuh Verifikasi Segera</p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b-4 border-black mb-6 gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('warga')}
            className={`px-6 py-3 font-headline-md uppercase text-sm md:text-base border-4 border-b-0 border-black transition-all ${
              activeTab === 'warga' 
                ? 'bg-primary-container text-white translate-y-1' 
                : 'bg-white hover:bg-zinc-100'
            }`}
          >
            Iuran Warga (Bulanan)
          </button>
          <button
            onClick={() => setActiveTab('makam')}
            className={`px-6 py-3 font-headline-md uppercase text-sm md:text-base border-4 border-b-0 border-black transition-all ${
              activeTab === 'makam' 
                ? 'bg-tertiary-fixed text-black translate-y-1' 
                : 'bg-white hover:bg-zinc-100'
            }`}
          >
            Iuran Makam (36 Bulan)
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-3 font-headline-md uppercase text-sm md:text-base border-4 border-b-0 border-black transition-all relative ${
              activeTab === 'pending' 
                ? 'bg-black text-white translate-y-1' 
                : 'bg-white hover:bg-zinc-100'
            }`}
          >
            Pending Verifikasi
            {pendingTransactions.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-error text-white text-[10px] w-6 h-6 rounded-full flex items-center justify-center border-2 border-black font-bold">
                {pendingTransactions.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'pending' ? (
          /* PENDING TAB */
          <div className="space-y-4">
            {pendingTransactions.length === 0 ? (
              <div className="bg-zinc-100 border-4 border-black p-8 text-center font-headline-md uppercase text-sm">
                Tidak ada pembayaran pending verifikasi.
              </div>
            ) : (
              pendingTransactions.map(tx => (
                <div key={tx.id} className="bg-white border-4 border-black p-4 md:p-6 neubrutal-shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-zinc-100 border-2 border-black flex items-center justify-center shrink-0 mt-1">
                      <span className="material-symbols-outlined text-2xl">receipt_long</span>
                    </div>
                    <div>
                      <p className="font-display-bold text-lg leading-tight">{tx.warga?.user?.nama}</p>
                      <p className="text-xs font-bold text-zinc-500 uppercase mt-1">No. KK: {tx.warga?.user?.nomorKK}</p>
                      <div className="mt-2 space-y-1">
                        {tx.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <span className={`inline-block px-1.5 py-0.5 border border-black font-bold text-[9px] uppercase ${item.tipe === 'warga' ? 'bg-primary-container text-white' : 'bg-tertiary-fixed'}`}>
                              {item.tipe === 'warga' ? 'Warga' : 'Makam'}
                            </span>
                            <span className="font-medium text-zinc-700">
                              {item.tipe === 'warga' 
                                ? `Bulan ${getBulanName(item.bulan)} ${item.tahun}`
                                : `Makam ${item.jumlahBulan} Bulan (${item.jumlahOrang} Orang)`}
                            </span>
                            <span className="font-bold">- {formatRp(item.jumlah)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:items-end gap-3 w-full md:w-auto border-t-2 md:border-t-0 border-black/10 pt-4 md:pt-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs uppercase text-zinc-400 font-bold">Total Transfer</span>
                      <p className="text-xl font-display-bold text-primary">{formatRp(tx.total)}</p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                      <button
                        onClick={() => setSelectedBukti(tx.buktiBayar)}
                        className="flex-1 md:flex-none px-3 py-2 border-2 border-black bg-white hover:bg-zinc-100 font-bold text-xs uppercase flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        Bukti
                      </button>
                      <button
                        onClick={() => handleVerifikasi(tx.id, tx.isTx, 'terima')}
                        disabled={isProcessing}
                        className="flex-1 md:flex-none px-4 py-2 border-2 border-black bg-secondary-container hover:bg-secondary-container/90 font-bold text-xs uppercase flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        Setujui
                      </button>
                      <button
                        onClick={() => handleVerifikasi(tx.id, tx.isTx, 'tolak')}
                        disabled={isProcessing}
                        className="flex-1 md:flex-none px-4 py-2 border-2 border-black bg-error text-white hover:bg-error/90 font-bold text-xs uppercase flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">cancel</span>
                        Tolak
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'warga' ? (
          /* WARGA TAB (Bulanan) */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Progress per KK */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white border-4 border-black neubrutal-shadow">
                <div className="p-4 border-b-4 border-black bg-zinc-100 flex items-center justify-between">
                  <h3 className="font-headline-md uppercase text-sm">Status Bulan Ini ({getBulanName(new Date().getMonth() + 1)})</h3>
                  <input
                    type="text"
                    placeholder="Cari warga..."
                    value={wargaSearch}
                    onChange={(e) => setWargaSearch(e.target.value)}
                    className="border-2 border-black p-1.5 text-xs focus:ring-0 outline-none w-48 bg-white"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-50 border-b-2 border-black">
                      <tr>
                        <th className="p-3 font-label-bold uppercase text-xs">Warga / KK</th>
                        <th className="p-3 font-label-bold uppercase text-xs text-center">Iuran Warga</th>
                        <th className="p-3 font-label-bold uppercase text-xs text-center">Sisa Makam</th>
                        <th className="p-3 font-label-bold uppercase text-xs text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWargaProgress.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="p-4 text-center text-xs font-bold uppercase text-zinc-500">Tidak ada data warga</td>
                        </tr>
                      ) : (
                        filteredWargaProgress.map(w => (
                          <tr key={w.id} className="border-b border-black/10 hover:bg-zinc-50">
                            <td className="p-3">
                              <p className="font-bold text-sm">{w.nama}</p>
                              <p className="text-[10px] font-medium text-zinc-500 mt-0.5">KK: {w.nomorKK}</p>
                            </td>
                            <td className="p-3 text-center">
                              {w.wargaBulanIniLunas ? (
                                <span className="inline-block px-2 py-0.5 border border-black bg-secondary-container text-[9px] font-black uppercase text-black">
                                  LUNAS
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 border border-black bg-error text-[9px] font-black uppercase text-white">
                                  BELUM
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center font-bold text-sm">
                              {w.makamLunas ? (
                                <span className="inline-block px-2 py-0.5 border border-black bg-secondary-container text-[9px] font-black uppercase text-black">
                                  LUNAS 36 BLN
                                </span>
                              ) : (
                                <span className="font-mono text-xs">{w.sisaBulanMakam} bulan</span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <span className="text-xs font-bold uppercase text-zinc-500">
                                {w.jumlahOrang} Orang
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right: History Iuran Warga */}
            <div className="space-y-4">
              <div className="bg-white border-4 border-black neubrutal-shadow">
                <div className="p-4 border-b-4 border-black bg-zinc-100">
                  <h3 className="font-headline-md uppercase text-sm">Riwayat Laporan Lunas</h3>
                </div>
                <div className="divide-y border-b border-black">
                  {paginatedHistory.length === 0 ? (
                    <div className="p-4 text-center text-xs font-bold text-zinc-500 uppercase">Belum ada riwayat</div>
                  ) : (
                    paginatedHistory.map(row => (
                      <div key={row.id} className="p-3 hover:bg-zinc-50 flex justify-between items-center gap-3">
                        <div>
                          <p className="font-bold text-xs">{row.warga?.user?.nama}</p>
                          <p className="text-[9px] font-bold text-zinc-500 mt-0.5">
                            Bulan {getBulanName(row.bulan)} {row.tahun} • {row.metode || 'Offline'}
                          </p>
                        </div>
                        <p className="font-mono font-bold text-xs shrink-0">{formatRp(row.jumlah)}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="p-3 flex justify-between items-center bg-zinc-50">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-2 py-1 border border-black font-bold text-[10px] uppercase bg-white disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <span className="text-[10px] font-bold">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-2 py-1 border border-black font-bold text-[10px] uppercase bg-white disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* MAKAM TAB (36 Bulan) */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Progress makam per KK */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white border-4 border-black neubrutal-shadow">
                <div className="p-4 border-b-4 border-black bg-zinc-100 flex items-center justify-between">
                  <h3 className="font-headline-md uppercase text-sm">Progress Iuran Makam Warga</h3>
                  <input
                    type="text"
                    placeholder="Cari warga..."
                    value={wargaSearch}
                    onChange={(e) => setWargaSearch(e.target.value)}
                    className="border-2 border-black p-1.5 text-xs focus:ring-0 outline-none w-48 bg-white"
                  />
                </div>
                <div className="divide-y">
                  {filteredWargaProgress.length === 0 ? (
                    <div className="p-8 text-center text-xs font-bold uppercase text-zinc-500">Tidak ada data warga</div>
                  ) : (
                    filteredWargaProgress.map(w => {
                      const percentage = Math.min(100, Math.round((w.bulanMakamTerbayar / 36) * 100))
                      return (
                        <div key={w.id} className="p-4 hover:bg-zinc-50 flex flex-col md:flex-row justify-between md:items-center gap-4">
                          <div className="flex-1">
                            <div className="flex items-baseline justify-between">
                              <p className="font-bold text-sm">{w.nama}</p>
                              <span className="text-xs font-mono font-bold text-zinc-600">
                                {w.bulanMakamTerbayar} / 36 bulan
                              </span>
                            </div>
                            <p className="text-[10px] font-medium text-zinc-500 mt-0.5">
                              Jumlah anggota keluarga: {w.jumlahOrang} Orang • Total Iuran: {formatRp(36 * w.jumlahOrang * 10000)}
                            </p>
                            
                            {/* Progress Bar */}
                            <div className="w-full bg-zinc-200 border-2 border-black h-4 mt-2 overflow-hidden relative">
                              <div 
                                className="bg-tertiary-fixed h-full border-r-2 border-black transition-all duration-300"
                                style={{ width: `${percentage}%` }}
                              />
                              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-black">
                                {percentage}%
                              </span>
                            </div>
                          </div>
                          
                          <div className="shrink-0 text-right">
                            {w.makamLunas ? (
                              <span className="inline-block px-3 py-1 border-2 border-black bg-secondary-container text-[10px] font-black uppercase text-black">
                                LUNAS MAKAM
                              </span>
                            ) : (
                              <p className="text-xs font-bold text-error">Sisa: {w.sisaBulanMakam} bulan lagi</p>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right: History Cicilan Makam */}
            <div className="space-y-4">
              <div className="bg-white border-4 border-black neubrutal-shadow">
                <div className="p-4 border-b-4 border-black bg-zinc-100">
                  <h3 className="font-headline-md uppercase text-sm">Riwayat Pembayaran Makam</h3>
                </div>
                <div className="divide-y border-b border-black">
                  {paginatedHistory.length === 0 ? (
                    <div className="p-4 text-center text-xs font-bold text-zinc-500 uppercase">Belum ada riwayat</div>
                  ) : (
                    paginatedHistory.map(row => (
                      <div key={row.id} className="p-3 hover:bg-zinc-50 flex justify-between items-center gap-3">
                        <div>
                          <p className="font-bold text-xs">{row.warga?.user?.nama}</p>
                          <p className="text-[9px] font-bold text-zinc-500 mt-0.5">
                            Bayar {row.jumlahBulan} bulan ({row.jumlahOrang} Orang) • {row.metode || 'Offline'}
                          </p>
                        </div>
                        <p className="font-mono font-bold text-xs shrink-0">{formatRp(row.jumlah)}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="p-3 flex justify-between items-center bg-zinc-50">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-2 py-1 border border-black font-bold text-[10px] uppercase bg-white disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <span className="text-[10px] font-bold">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-2 py-1 border border-black font-bold text-[10px] uppercase bg-white disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Lihat Bukti */}
        {selectedBukti && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white border-4 border-black w-full max-w-xl neubrutal-shadow flex flex-col max-h-[85vh]">
              <div className="p-4 border-b-4 border-black flex justify-between items-center bg-zinc-100">
                <h2 className="font-display-bold text-xl uppercase">Bukti Pembayaran</h2>
                <button onClick={() => setSelectedBukti(null)} className="hover:text-error transition-colors">
                  <span className="material-symbols-outlined text-3xl">close</span>
                </button>
              </div>
              <div className="p-6 flex justify-center bg-zinc-50 flex-1 overflow-y-auto">
                <img 
                  src={selectedBukti} 
                  alt="Bukti Transfer" 
                  className="max-h-[60vh] object-contain border-4 border-black shadow-lg bg-white"
                  onError={(e) => {
                    e.target.src = 'https://placehold.co/400x600?text=Bukti+Tidak+Ditemukan';
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal Reject / Penolakan */}
        {showRejectModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white border-4 border-black w-full max-w-md neubrutal-shadow">
              <div className="p-4 border-b-4 border-black bg-error text-white">
                <h2 className="font-display-bold text-lg uppercase">Tolak Pembayaran</h2>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block font-label-bold uppercase mb-2">Alasan Penolakan</label>
                  <textarea
                    rows="3"
                    className="w-full border-4 border-black p-3 font-medium bg-white focus:ring-0 outline-none"
                    placeholder="Misal: Bukti pembayaran buram / salah upload"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowRejectModal(false)}
                    className="flex-1 py-3 border-4 border-black font-headline-md uppercase text-sm hover:bg-zinc-100"
                  >
                    Batal
                  </button>
                  <button
                    onClick={submitReject}
                    disabled={isProcessing}
                    className="flex-1 py-3 bg-error text-white border-4 border-black font-headline-md uppercase text-sm hover:bg-error/90"
                  >
                    {isProcessing ? 'Proses...' : 'Kirim Penolakan'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Rekam Bayar Offline */}
        {showRekamModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white border-4 border-black w-full max-w-lg neubrutal-shadow">
              <div className="p-4 border-b-4 border-black bg-primary text-white flex justify-between items-center">
                <h2 className="font-display-bold text-xl uppercase">Rekam Bayar Offline</h2>
                <button onClick={() => setShowRekamModal(false)}>
                  <span className="material-symbols-outlined text-3xl">close</span>
                </button>
              </div>
              <form onSubmit={handleRekamBayar} className="p-6 space-y-4">
                {/* Warga Dropdown Search */}
                <div className="relative" ref={wargaDropdownRef}>
                  <label className="block font-label-bold uppercase mb-2">Pilih Warga / KK</label>
                  <div 
                    onClick={() => setShowWargaDropdown(true)}
                    className="border-4 border-black p-3 font-bold bg-white flex justify-between items-center cursor-pointer"
                  >
                    <span>{selectedWargaLabel || 'Pilih Warga...'}</span>
                    <span className="material-symbols-outlined">arrow_drop_down</span>
                  </div>
                  
                  {showWargaDropdown && (
                    <div className="absolute left-0 right-0 z-50 mt-1 bg-white border-4 border-black max-h-60 overflow-y-auto neubrutal-shadow">
                      <div className="p-2 border-b-2 border-black bg-zinc-50">
                        <input
                          type="text"
                          placeholder="Ketik nama warga..."
                          value={wargaSearch}
                          onChange={(e) => setWargaSearch(e.target.value)}
                          className="w-full border-2 border-black p-2 text-sm focus:ring-0 outline-none bg-white font-medium"
                        />
                      </div>
                      {wargaList
                        .filter(w => w.user?.nama?.toLowerCase().includes(wargaSearch.toLowerCase()))
                        .map(w => (
                          <div
                            key={w.id}
                            onClick={() => {
                              setRekamData({ ...rekamData, wargaId: w.id.toString() })
                              setShowWargaDropdown(false)
                            }}
                            className="p-3 hover:bg-zinc-100 cursor-pointer font-bold text-sm border-b last:border-0"
                          >
                            {w.user?.nama} <span className="text-xs font-normal text-zinc-500">(KK: {w.user?.nomorKK})</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Jenis Iuran */}
                <div>
                  <label className="block font-label-bold uppercase mb-2">Jenis Iuran yang Dibayar</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'warga', label: 'Iuran Warga' },
                      { id: 'makam', label: 'Iuran Makam' },
                      { id: 'semua', label: 'Keduanya' }
                    ].map(j => (
                      <button
                        key={j.id}
                        type="button"
                        onClick={() => setRekamData({ ...rekamData, tipe: j.id })}
                        className={`py-2 border-2 border-black font-bold text-xs uppercase ${
                          rekamData.tipe === j.id ? 'bg-primary text-white' : 'bg-white hover:bg-zinc-50'
                        }`}
                      >
                        {j.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form fields based on selected Type */}
                {(rekamData.tipe === 'warga' || rekamData.tipe === 'semua') && (
                  <div className="grid grid-cols-2 gap-4 border-2 border-black p-3 bg-zinc-50">
                    <p className="col-span-2 text-[10px] font-black uppercase text-zinc-400">Periode Iuran Warga (Rp 10.000)</p>
                    <div>
                      <label className="block font-label-bold uppercase text-[10px] mb-1">Bulan</label>
                      <select
                        className="w-full border-2 border-black p-2 text-xs font-bold bg-white"
                        value={rekamData.bulanWarga}
                        onChange={(e) => setRekamData({ ...rekamData, bulanWarga: parseInt(e.target.value) })}
                      >
                        {[...Array(12)].map((_, i) => (
                          <option key={i+1} value={i+1}>{getBulanName(i+1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-label-bold uppercase text-[10px] mb-1">Tahun</label>
                      <select
                        className="w-full border-2 border-black p-2 text-xs font-bold bg-white"
                        value={rekamData.tahunWarga}
                        onChange={(e) => setRekamData({ ...rekamData, tahunWarga: parseInt(e.target.value) })}
                      >
                        {[2024, 2025, 2026, 2027].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {(rekamData.tipe === 'makam' || rekamData.tipe === 'semua') && (
                  <div className="border-2 border-black p-3 bg-zinc-50">
                    <p className="text-[10px] font-black uppercase text-zinc-400 mb-2">Iuran Makam (Rp 10.000 / Orang / Bulan)</p>
                    <label className="block font-label-bold uppercase text-[10px] mb-1">Bayar Berapa Bulan?</label>
                    <input
                      type="number"
                      min="1"
                      max="36"
                      className="w-full border-2 border-black p-2 text-xs font-bold bg-white"
                      value={rekamData.jumlahBulanMakam}
                      onChange={(e) => setRekamData({ ...rekamData, jumlahBulanMakam: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-secondary-container text-black border-4 border-black py-3 font-headline-md uppercase text-sm neubrutal-shadow active-press disabled:opacity-50"
                >
                  {isProcessing ? 'Memproses...' : 'Simpan Pembayaran'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
