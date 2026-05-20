import { useState, useEffect, useRef } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import api from '../../services/api'
import { useNotification } from '../../context/NotificationContext'
import { generateTransactionReport } from '../../utils/excelReport'

const formatRp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID')

const getBulanName = (bln) => {
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  return bulan[bln - 1] || bln
}

export default function AdminIuran() {
  const [periode, setPeriode] = useState('SEMUA')
  const [statusFilter, setStatusFilter] = useState('SEMUA')
  const [dataIuran, setDataIuran] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBukti, setSelectedBukti] = useState(null)
  const [showRekamModal, setShowRekamModal] = useState(false)
  const [wargaList, setWargaList] = useState([])
  const [rekamData, setRekamData] = useState({ wargaId: '', jumlahBulan: 1, tipe: 'warga', jumlah: '' })
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectId, setRejectId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [tipeFilter, setTipeFilter] = useState('SEMUA')
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generateData, setGenerateData] = useState({ tipe: 'warga', bulan: new Date().getMonth() + 1, tahun: new Date().getFullYear() })
  const [wargaSearch, setWargaSearch] = useState('')
  const [showWargaDropdown, setShowWargaDropdown] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportFilters, setExportFilters] = useState({ bulan: 'SEMUA', tahun: new Date().getFullYear().toString() })
  const [showNoDataModal, setShowNoDataModal] = useState(false)
  const wargaDropdownRef = useRef(null)
  const { showAlert, showConfirm } = useNotification()

  // Close dropdown when clicking outside
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
      const res = await api.get('/iuran')
      setDataIuran(res.data)
    } catch (error) {
      console.error('Failed to fetch iuran', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    fetchWarga()
  }, [])

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

  const handleVerifikasi = async (id, action) => {
    if (action === 'tolak') {
      setRejectId(id)
      setRejectReason('')
      setShowRejectModal(true)
      return
    }

    try {
      setIsProcessing(true)
      await api.put(`/iuran/${id}/verifikasi`, { action })
      await showAlert('Pembayaran diterima!')
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
      await api.put(`/iuran/${rejectId}/verifikasi`, { action: 'tolak', alasan: rejectReason })
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

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!(await showConfirm(`Buat tagihan ${generateData.tipe === 'warga' ? 'Iuran Bulanan (Rp 10.000/KK)' : 'Iuran Makam (Rp 10.000 x jumlah orang)'} untuk SEMUA warga?`))) return
    try {
      setIsProcessing(true)
      await api.post('/iuran/generate', generateData)
      await showAlert('Tagihan berhasil digenerate')
      setShowGenerateModal(false)
      setGenerateData({ tipe: 'warga', bulan: new Date().getMonth() + 1, tahun: new Date().getFullYear() })
      fetchData()
    } catch (error) {
      console.error('Generate error', error)
      showAlert(error.response?.data?.message || 'Gagal generate tagihan')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBayarOffline = async (id) => {
    if (!(await showConfirm('Tandai tagihan ini lunas dibayar offline?'))) return
    try {
      setIsProcessing(true)
      await api.put(`/iuran/${id}/offline`)
      await showAlert('Tagihan berhasil dilunaskan')
      fetchData()
    } catch (error) {
      console.error('Offline bayar error', error)
      showAlert('Gagal melunaskan tagihan')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRekamBayar = async (e) => {
    e.preventDefault()
    if (!rekamData.wargaId) return showAlert('Pilih warga terlebih dahulu')
    
    try {
      setIsProcessing(true)
      await api.post('/iuran/offline-advance', rekamData)
      await showAlert('Pembayaran offline berhasil dicatat')
      setShowRekamModal(false)
      setRekamData({ wargaId: '', jumlahBulan: 1, tipe: 'warga', jumlah: '' })
      fetchData()
    } catch (error) {
      console.error('Rekam bayar error', error)
      showAlert(error.response?.data?.message || 'Gagal mencatat pembayaran')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleKirimPengingat = async () => {
    if (!(await showConfirm('Kirim pengingat tagihan ke semua warga yang belum bayar bulan ini?'))) return
    try {
      setIsProcessing(true)
      const res = await api.post('/iuran/kirim-pengingat')
      await showAlert(res.data.message)
    } catch (error) {
      console.error('Pengingat error', error)
      showAlert('Gagal mengirim pengingat')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExport = () => {
    if (dataIuran.length === 0) {
      showAlert('Tidak ada data untuk diekspor')
      return
    }
    // Set default export filters to the current month and year
    const currentMonth = new Date().getMonth() + 1
    setExportFilters({
      bulan: currentMonth.toString(),
      tahun: new Date().getFullYear().toString()
    })
    setShowExportModal(true)
  }

  const handleExportSubmit = (e) => {
    e.preventDefault()
    let filtered = [...dataIuran]
    if (exportFilters.bulan !== 'SEMUA') {
      filtered = filtered.filter(i => i.bulan === parseInt(exportFilters.bulan))
    }
    if (exportFilters.tahun !== 'SEMUA') {
      filtered = filtered.filter(i => i.tahun === parseInt(exportFilters.tahun))
    }
    
    if (filtered.length === 0) {
      setShowExportModal(false)
      setShowNoDataModal(true)
      return
    }
    
    generateTransactionReport(filtered, wargaList, exportFilters.bulan, exportFilters.tahun)
    setShowExportModal(false)
  }

  const pendingItems = dataIuran.filter(i => i.status === 'pending')
  
  const periodeOptions = ['SEMUA', ...new Set(dataIuran.map(i => `${getBulanName(i.bulan)} ${i.tahun}`))].sort((a, b) => {
     if (a === 'SEMUA') return -1;
     return 0;
  })

  const filteredDataRaw = dataIuran.filter(item => {
    const itemPeriode = `${getBulanName(item.bulan)} ${item.tahun}`
    const matchPeriode = periode === 'SEMUA' || itemPeriode === periode
    const matchStatus = statusFilter === 'SEMUA' || item.status === statusFilter.toLowerCase()
    const matchTipe = tipeFilter === 'SEMUA' || item.tipe === tipeFilter.toLowerCase()
    return matchPeriode && matchStatus && matchTipe
  })

  // Grouping logic for table
  const groupedData = {}
  filteredDataRaw.forEach(item => {
    const key = item.transaksiId || `NON-${item.id}`
    if (!groupedData[key]) {
      groupedData[key] = {
        ...item,
        jumlah: 0,
        bulanList: [],
        isGrouped: !!item.transaksiId
      }
    }
    groupedData[key].jumlah += Number(item.jumlah)
    groupedData[key].bulanList.push({ bulan: item.bulan, tahun: item.tahun })
  })

  const transaksiData = Object.values(groupedData).map(item => {
    item.bulanList.sort((a, b) => (a.tahun - b.tahun) || (a.bulan - b.bulan))
    let periodeStr = `${getBulanName(item.bulanList[0].bulan)} ${item.bulanList[0].tahun}`
    if (item.bulanList.length > 1) {
      const last = item.bulanList[item.bulanList.length - 1]
      periodeStr += ` - ${getBulanName(last.bulan)} ${last.tahun}`
    }
    return { ...item, periodeDisplay: periodeStr }
  }).reverse()

  const totalEstimasi = dataIuran.reduce((sum, item) => sum + Number(item.jumlah), 0)
  const totalTerbayar = dataIuran.filter(i => i.status === 'lunas').reduce((sum, item) => sum + Number(item.jumlah), 0)
  const totalBelum = totalEstimasi - totalTerbayar

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto max-w-full">
        {/* Header Section */}
        <header className="mb-lg flex flex-col md:flex-row md:items-end justify-between gap-md">
          <div>
            <h1 className="font-display-bold text-headline-md md:text-display-bold uppercase">Kelola Iuran</h1>
            <p className="font-body-lg text-zinc-600">
              Manajemen tagihan rutin dan konfirmasi pembayaran warga.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <button onClick={() => setShowGenerateModal(true)} disabled={isProcessing} className="bg-primary text-white border-4 border-black px-4 py-2 md:px-6 md:py-3 font-headline-md uppercase neubrutal-shadow active-press flex items-center gap-2 text-sm md:text-base disabled:opacity-50">
              <span className="material-symbols-outlined">add_card</span>
              Buat Tagihan
            </button>
            <button 
              onClick={() => {
                setShowRekamModal(true)
                setWargaSearch('')
                setRekamData({ wargaId: '', jumlahBulan: 1, tipe: 'warga', jumlah: '' })
              }}
              className="bg-secondary-container text-black border-4 border-black px-4 py-2 md:px-6 md:py-3 font-headline-md uppercase neubrutal-shadow active-press flex items-center gap-2 text-sm md:text-base"
            >
              <span className="material-symbols-outlined">history_edu</span>
              Rekam Bayar
            </button>
          </div>
        </header>

        {/* Grid Layout */}
        <div className="grid grid-cols-12 gap-4 md:gap-gutter">
          {/* Quick Stats Column */}
          <div className="col-span-12 lg:col-span-4 space-y-gutter">
            <div className="neubrutalist-card bg-white p-4 md:p-md">
              <h3 className="font-headline-md uppercase border-b-4 border-black pb-2 mb-4">
                Ringkasan Keseluruhan
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-primary-container text-white border-2 border-black neubrutal-shadow">
                  <p className="text-xs uppercase font-bold opacity-80">Total Tagihan (Estimasi)</p>
                  <p className="text-2xl md:text-headline-lg">{formatRp(totalEstimasi)}</p>
                </div>
                <div className="p-4 bg-secondary-container text-black border-2 border-black neubrutal-shadow">
                  <p className="text-xs uppercase font-bold opacity-70">Sudah Terbayar</p>
                  <p className="text-2xl md:text-headline-lg">{formatRp(totalTerbayar)}</p>
                </div>
                <div className="p-4 bg-tertiary-fixed text-black border-2 border-black neubrutal-shadow">
                  <p className="text-xs uppercase font-bold opacity-70">Belum Terbayar</p>
                  <p className="text-2xl md:text-headline-lg">{formatRp(totalBelum)}</p>
                </div>
              </div>
            </div>

            {/* Filter Card */}
            <div className="neubrutalist-card bg-zinc-100 p-4 md:p-md">
              <h3 className="font-headline-md uppercase mb-4">Filter Pencarian</h3>
              <div className="space-y-4">
                <div>
                  <label className="block font-label-bold uppercase mb-1">Periode</label>
                  <select
                    className="w-full border-4 border-black p-3 font-bold bg-white focus:ring-0 outline-none appearance-none cursor-pointer"
                    value={periode}
                    onChange={(e) => setPeriode(e.target.value)}
                  >
                    {periodeOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-label-bold uppercase mb-1">Status</label>
                  <div className="flex flex-wrap gap-2">
                    {['SEMUA', 'PENDING', 'LUNAS', 'BELUM_BAYAR'].map(st => (
                      <button
                        key={st}
                        onClick={() => setStatusFilter(st)}
                        className={`px-3 py-2 border-2 border-black font-black text-[10px] uppercase transition-all ${
                          statusFilter === st 
                            ? 'bg-primary text-white neubrutal-shadow-sm translate-x-[2px] translate-y-[2px]' 
                            : 'bg-white hover:bg-zinc-100'
                        }`}
                      >
                        {st.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block font-label-bold uppercase mb-1">Tipe Iuran</label>
                  <div className="flex flex-wrap gap-2">
                    {['SEMUA', 'WARGA', 'MAKAM'].map(tp => (
                      <button
                        key={tp}
                        onClick={() => setTipeFilter(tp)}
                        className={`px-3 py-2 border-2 border-black font-black text-[10px] uppercase transition-all ${
                          tipeFilter === tp 
                            ? 'bg-primary text-white neubrutal-shadow-sm translate-x-[2px] translate-y-[2px]' 
                            : 'bg-white hover:bg-zinc-100'
                        }`}
                      >
                        {tp}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pt-4 border-t-2 border-black/10">
                  <button 
                    onClick={handleKirimPengingat}
                    disabled={isProcessing}
                    className="w-full bg-error text-white border-4 border-black p-3 font-headline-md uppercase neubrutal-shadow active-press flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">notifications_active</span>
                    Kirim Pengingat
                  </button>
                </div>
              </div>

              {/* New Information Card */}
              <div className="neubrutalist-card bg-white p-4 md:p-6 mt-gutter">
                <div className="w-12 h-12 bg-tertiary-fixed border-4 border-black flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-2xl">info</span>
                </div>
                <h4 className="font-headline-md uppercase mb-2 text-sm">Panduan Pengelolaan</h4>
                <p className="text-xs font-body-md text-zinc-600 leading-relaxed">
                  Gunakan fitur <b>Export</b> untuk mendapatkan laporan bulanan dalam format Excel profesional. Pastikan semua konfirmasi pending diperiksa setiap hari.
                </p>
                <button 
                  onClick={() => setShowGuideModal(true)}
                  className="mt-4 w-full py-2 border-2 border-black font-black text-[10px] uppercase hover:bg-zinc-100 transition-colors"
                >
                  Pelajari Lebih Lanjut
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Column */}
          <div className="col-span-12 lg:col-span-8 space-y-gutter">
            {/* Pending Confirmations */}
            <div className="neubrutalist-card bg-primary-fixed overflow-hidden">
              <div className="bg-black text-white p-4 flex justify-between items-center">
                <h2 className="font-headline-md uppercase flex items-center gap-2 text-sm md:text-base">
                  <span className="material-symbols-outlined">pending_actions</span>
                  Konfirmasi Pending ({pendingItems.length})
                </h2>
                <button className="font-label-bold underline decoration-2 text-xs">Lihat Semua</button>
              </div>
              <div className="p-4 space-y-3">
                {pendingItems.length === 0 && (
                  <p className="text-center font-bold text-xs uppercase py-2">Tidak ada tagihan pending.</p>
                )}
                {pendingItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white border-4 border-black p-4 neubrutal-shadow flex flex-col md:flex-row justify-between items-center gap-4"
                  >
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="w-12 h-12 bg-tertiary-fixed border-2 border-black flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-2xl">receipt_long</span>
                      </div>
                      <div>
                        <p className="font-headline-md leading-tight text-sm md:text-base">{item.warga?.user?.nama}</p>
                        <p className="text-xs font-bold uppercase text-zinc-500">{item.tipe === 'warga' ? 'Iuran Warga' : 'Iuran Makam'} {getBulanName(item.bulan)} {item.tahun}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                      <p className="font-headline-md text-primary text-sm md:text-base">{formatRp(item.jumlah)}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedBukti(item.buktiBayar)}
                          className="p-2 border-2 border-black bg-white hover:bg-primary hover:text-white transition-colors neubrutal-shadow-sm active:translate-y-1 active:shadow-none"
                          title="Lihat Bukti"
                        >
                          <span className="material-symbols-outlined">visibility</span>
                        </button>
                        <button
                          onClick={() => handleVerifikasi(item.id, 'terima')}
                          disabled={isProcessing}
                          className="p-2 border-2 border-black bg-secondary-container hover:bg-black hover:text-white transition-colors neubrutal-shadow-sm active:translate-y-1 active:shadow-none"
                          title="Terima"
                        >
                          <span className="material-symbols-outlined">check_circle</span>
                        </button>
                        <button
                          onClick={() => handleVerifikasi(item.id, 'tolak')}
                          disabled={isProcessing}
                          className="p-2 border-2 border-black bg-error text-white hover:bg-black transition-colors neubrutal-shadow-sm active:translate-y-1 active:shadow-none"
                          title="Tolak"
                        >
                          <span className="material-symbols-outlined">cancel</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Transactions List */}
            <div className="neubrutalist-card bg-white">
              <div className="p-4 border-b-4 border-black bg-zinc-100 flex justify-between items-center">
                <h2 className="font-headline-md uppercase text-sm md:text-base">Transaksi / Data Tagihan</h2>
                <button 
                  onClick={handleExport}
                  className="font-label-bold uppercase flex items-center gap-1 border-2 border-black px-2 py-1 bg-white hover:bg-tertiary-fixed text-xs neubrutal-shadow-sm active-press"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  Export
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-zinc-100 border-b-4 border-black">
                    <tr>
                      <th className="p-4 font-label-bold uppercase text-xs">Nama Warga</th>
                      <th className="p-4 font-label-bold uppercase text-xs">Tipe</th>
                      <th className="p-4 font-label-bold uppercase text-xs">Periode</th>
                      <th className="p-4 font-label-bold uppercase text-xs">Jumlah</th>
                      <th className="p-4 font-label-bold uppercase text-xs">Metode</th>
                      <th className="p-4 font-label-bold uppercase text-xs">Status</th>
                      <th className="p-4 font-label-bold uppercase text-xs">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="p-4 text-center font-bold text-xs uppercase">Memuat...</td>
                      </tr>
                    ) : (
                      transaksiData.map((row) => (
                        <tr key={row.id} className="border-b-2 border-black hover:bg-yellow-50">
                          <td className="p-4 font-bold text-sm">{row.warga?.user?.nama}</td>
                          <td className="p-4">
                            <span className={`inline-block px-2 py-0.5 border-2 border-black text-[10px] font-black uppercase ${row.tipe === 'warga' ? 'bg-primary-container text-white' : 'bg-tertiary-fixed text-black'}`}>
                              {row.tipe === 'warga' ? 'Warga' : 'Makam'}
                            </span>
                          </td>
                          <td className="p-4 text-sm">{row.periodeDisplay || `${getBulanName(row.bulan)} ${row.tahun}`}</td>
                          <td className="p-4 font-bold text-sm">{formatRp(row.jumlah)}</td>
                          <td className="p-4">
                            <span
                              className={`inline-block px-3 py-1 border-2 text-[10px] font-black uppercase whitespace-nowrap ${
                                row.metode && row.metode.toLowerCase().includes('transfer')
                                  ? 'bg-primary text-white border-black'
                                  : 'bg-white border-black'
                              }`}
                            >
                              {row.metode || '-'}
                            </span>
                          </td>
                          <td className="p-4">
                            {row.status === 'lunas' ? (
                              <span className="px-2 py-1 bg-secondary-container border-2 border-black text-[10px] font-black uppercase">
                                Lunas
                              </span>
                            ) : row.status === 'pending' ? (
                              <span className="px-2 py-1 bg-tertiary-fixed border-2 border-black text-[10px] font-black uppercase text-black">
                                Pending
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-error border-2 border-black text-[10px] font-black uppercase text-white">
                                Belum
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {row.status === 'belum_bayar' && (
                              <button
                                onClick={() => handleBayarOffline(row.id)}
                                disabled={isProcessing}
                                className="font-bold text-[10px] uppercase underline text-primary cursor-pointer hover:text-black flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-sm">payments</span>
                                Bayar Offline
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Management Tools Section Removed */}

        {/* Modal Lihat Bukti */}
        {selectedBukti && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white border-4 border-black w-full max-w-xl neubrutal-shadow flex flex-col">
              <div className="p-4 border-b-4 border-black flex justify-between items-center bg-surface-bright">
                <h2 className="font-display-bold text-xl uppercase">Bukti Pembayaran</h2>
                <button onClick={() => setSelectedBukti(null)} className="hover:text-error transition-colors">
                  <span className="material-symbols-outlined text-3xl">close</span>
                </button>
              </div>
              <div className="p-6 flex justify-center bg-zinc-100">
                <img 
                  src={selectedBukti?.startsWith('http') ? selectedBukti : `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${selectedBukti}`} 
                  alt="Bukti Transfer" 
                  className="max-h-[70vh] object-contain border-4 border-black shadow-lg"
                  onError={(e) => {
                    e.target.src = 'https://placehold.co/400x600?text=Bukti+Tidak+Ditemukan';
                  }}
                />
              </div>
              <div className="p-4 border-t-4 border-black bg-white flex justify-end">
                <button 
                  onClick={() => setSelectedBukti(null)}
                  className="px-6 py-2 border-4 border-black font-label-bold uppercase hover:bg-surface-variant transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Buat Tagihan Massal */}
        {showGenerateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white border-4 border-black w-full max-w-lg neubrutal-shadow flex flex-col">
              <div className="p-4 border-b-4 border-black flex justify-between items-center bg-primary text-white">
                <h2 className="font-display-bold text-xl uppercase">Buat Tagihan Massal</h2>
                <button onClick={() => setShowGenerateModal(false)}>
                  <span className="material-symbols-outlined text-3xl">close</span>
                </button>
              </div>
              <form onSubmit={handleGenerate}>
                <div className="p-6 space-y-4">
                  <p className="text-xs font-bold text-zinc-500 uppercase bg-tertiary-fixed border-2 border-black p-3">
                    Tagihan akan dibuat untuk SEMUA warga sekaligus.
                  </p>
                  <div>
                    <label className="block font-label-bold uppercase mb-2">Tipe Iuran</label>
                    <select
                      required
                      className="w-full border-4 border-black p-3 font-bold bg-white focus:ring-0 outline-none"
                      value={generateData.tipe}
                      onChange={(e) => setGenerateData({...generateData, tipe: e.target.value})}
                    >
                      <option value="warga">Iuran Bulanan Warga</option>
                      <option value="makam">Iuran Makam Bulanan</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-label-bold uppercase mb-2">Bulan</label>
                      <select
                        required
                        className="w-full border-4 border-black p-3 font-bold bg-white focus:ring-0 outline-none"
                        value={generateData.bulan}
                        onChange={(e) => setGenerateData({...generateData, bulan: parseInt(e.target.value)})}
                      >
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(b => (
                          <option key={b} value={b}>{getBulanName(b)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-label-bold uppercase mb-2">Tahun</label>
                      <input
                        type="number"
                        required
                        min="2020"
                        max="2099"
                        className="w-full border-4 border-black p-3 font-bold bg-white focus:ring-0 outline-none"
                        value={generateData.tahun}
                        onChange={(e) => setGenerateData({...generateData, tahun: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div className="bg-tertiary-fixed border-2 border-black p-3">
                    <p className="text-xs font-bold uppercase">Nominal Otomatis:</p>
                    <p className="text-sm mt-1">
                      {generateData.tipe === 'warga' 
                        ? '• Rp 10.000 per KK' 
                        : '• Rp 10.000 × (Kepala Keluarga + Anggota)'}
                    </p>
                  </div>
                </div>
                <div className="p-4 border-t-4 border-black bg-white flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowGenerateModal(false)}
                    className="px-6 py-2 border-4 border-black font-label-bold uppercase hover:bg-zinc-100 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="px-6 py-2 bg-primary text-white border-4 border-black font-label-bold uppercase neubrutal-shadow active-press disabled:opacity-50"
                  >
                    {isProcessing ? 'Memproses...' : 'Generate Tagihan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Rekam Bayar Offline */}
        {showRekamModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white border-4 border-black w-full max-w-lg neubrutal-shadow flex flex-col">
              <div className="p-4 border-b-4 border-black flex justify-between items-center bg-secondary-container">
                <h2 className="font-display-bold text-xl uppercase">Rekam Bayar Offline</h2>
                <button onClick={() => setShowRekamModal(false)} className="hover:text-error transition-colors">
                  <span className="material-symbols-outlined text-3xl">close</span>
                </button>
              </div>
              <form onSubmit={handleRekamBayar}>
                <div className="p-6 space-y-4">
                  <div className="relative" ref={wargaDropdownRef}>
                    <label className="block font-label-bold uppercase mb-2">Pilih Warga</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Ketik nama atau nomor KK..."
                        className="w-full border-4 border-black p-3 font-bold bg-white focus:ring-0 outline-none"
                        value={wargaSearch}
                        onChange={(e) => {
                          setWargaSearch(e.target.value)
                          setShowWargaDropdown(true)
                          if (!e.target.value) setRekamData({...rekamData, wargaId: ''})
                        }}
                        onFocus={() => setShowWargaDropdown(true)}
                      />
                      {rekamData.wargaId && (
                        <button
                          type="button"
                          onClick={() => {
                            setWargaSearch('')
                            setRekamData({...rekamData, wargaId: ''})
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-error"
                        >
                          <span className="material-symbols-outlined">close</span>
                        </button>
                      )}
                    </div>
                    {showWargaDropdown && (
                      <div className="absolute z-50 w-full bg-white border-4 border-black border-t-0 max-h-48 overflow-y-auto">
                        {wargaList
                          .filter(w => {
                            const search = wargaSearch.toLowerCase()
                            return w.user?.nama?.toLowerCase().includes(search) || 
                                   w.user?.nomorKK?.toLowerCase().includes(search)
                          })
                          .slice(0, 20)
                          .map(w => (
                            <div
                              key={w.id}
                              className="p-3 hover:bg-zinc-100 cursor-pointer border-b border-zinc-200 last:border-b-0"
                              onClick={() => {
                                setRekamData({...rekamData, wargaId: w.id})
                                setWargaSearch(`${w.user?.nama} - ${w.user?.nomorKK}`)
                                setShowWargaDropdown(false)
                              }}
                            >
                              <p className="font-bold text-sm">{w.user?.nama}</p>
                              <p className="text-xs text-zinc-500">{w.user?.nomorKK}</p>
                            </div>
                          ))}
                        {wargaList.filter(w => {
                          const search = wargaSearch.toLowerCase()
                          return w.user?.nama?.toLowerCase().includes(search) || 
                                 w.user?.nomorKK?.toLowerCase().includes(search)
                        }).length === 0 && (
                          <div className="p-3 text-center text-zinc-400 italic">Tidak ditemukan</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block font-label-bold uppercase mb-2">Tipe Iuran</label>
                    <select 
                      required
                      className="w-full border-4 border-black p-3 font-bold bg-white focus:ring-0 outline-none"
                      value={rekamData.tipe}
                      onChange={(e) => setRekamData({...rekamData, tipe: e.target.value})}
                    >
                      <option value="warga">Iuran Bulanan Warga</option>
                      <option value="makam">Iuran Makam Bulanan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-label-bold uppercase mb-2">Jumlah Bulan</label>
                    <input 
                      type="number"
                      min="1"
                      required
                      className="w-full border-4 border-black p-3 font-bold bg-white focus:ring-0 outline-none"
                      value={rekamData.jumlahBulan}
                      onChange={(e) => setRekamData({...rekamData, jumlahBulan: e.target.value})}
                    />
                    <p className="text-xs font-bold text-zinc-500 mt-2 uppercase">
                      * Pembayaran akan melunaskan tagihan lama yang belum bayar, lalu sisa bulannya akan menjadi tagihan baru di masa depan.
                    </p>
                  </div>
                  <div>
                    <label className="block font-label-bold uppercase mb-2">Nominal per Bulan (Rp)</label>
                    <input 
                      type="number"
                      min="1"
                      required
                      placeholder="Contoh: 50000"
                      className="w-full border-4 border-black p-3 font-bold bg-white focus:ring-0 outline-none"
                      value={rekamData.jumlah}
                      onChange={(e) => setRekamData({...rekamData, jumlah: e.target.value})}
                    />
                  </div>
                </div>
                <div className="p-4 border-t-4 border-black bg-white flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowRekamModal(false)}
                    className="px-6 py-2 border-4 border-black font-label-bold uppercase hover:bg-zinc-100 transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    disabled={isProcessing}
                    className="px-6 py-2 bg-primary text-white border-4 border-black font-label-bold uppercase neubrutal-shadow active-press disabled:opacity-50"
                  >
                    {isProcessing ? 'Memproses...' : 'Simpan Pembayaran'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Alasan Penolakan */}
        {showRejectModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <div className="bg-white border-4 border-black w-full max-w-md neubrutal-shadow-lg flex flex-col animate-in zoom-in-95 duration-200">
              <div className="p-4 border-b-4 border-black flex justify-between items-center bg-error text-white">
                <h2 className="font-display-bold text-xl uppercase">Tolak Pembayaran</h2>
                <button onClick={() => setShowRejectModal(false)}>
                  <span className="material-symbols-outlined text-3xl">close</span>
                </button>
              </div>
              <div className="p-6">
                <label className="block font-label-bold uppercase mb-2">Alasan Penolakan</label>
                <textarea 
                  className="w-full border-4 border-black p-3 font-bold bg-white focus:ring-0 outline-none min-h-[120px] resize-none"
                  placeholder="Contoh: Bukti transfer tidak jelas atau nominal tidak sesuai"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <p className="text-[10px] font-bold text-zinc-400 mt-2 uppercase italic">
                  * Alasan ini akan muncul di notifikasi dan riwayat warga.
                </p>
              </div>
              <div className="p-4 border-t-4 border-black bg-zinc-50 flex justify-end gap-3">
                <button 
                  onClick={() => setShowRejectModal(false)}
                  className="px-6 py-2 border-4 border-black font-label-bold uppercase hover:bg-white transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={submitReject}
                  disabled={isProcessing}
                  className="px-6 py-2 bg-black text-white border-4 border-black font-label-bold uppercase neubrutal-shadow active-press disabled:opacity-50"
                >
                  {isProcessing ? 'Memproses...' : 'Kirim Penolakan'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Panduan Penggunaan */}
        {showGuideModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div className="bg-white border-4 border-black w-full max-w-2xl max-h-[90vh] overflow-y-auto neubrutal-shadow-lg flex flex-col">
              <div className="p-4 border-b-4 border-black flex justify-between items-center bg-tertiary-fixed">
                <h2 className="font-display-bold text-xl uppercase">Panduan Pengelolaan Iuran</h2>
                <button onClick={() => setShowGuideModal(false)}>
                  <span className="material-symbols-outlined text-3xl">close</span>
                </button>
              </div>
              <div className="p-6 space-y-6">
                <section>
                  <h3 className="font-headline-md text-primary mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined">download</span>
                    1. Export Laporan Profesional
                  </h3>
                  <p className="text-sm font-body-md text-zinc-600">
                    Klik tombol <b>Export</b> pada tabel transaksi untuk mengunduh laporan Excel. Laporan ini sudah dilengkapi dengan format warna profesional, validasi data otomatis, dan ringkasan pivot table di sheet kedua.
                  </p>
                </section>

                <section>
                  <h3 className="font-headline-md text-primary mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined">verified</span>
                    2. Verifikasi Pembayaran Online
                  </h3>
                  <p className="text-sm font-body-md text-zinc-600">
                    Warga yang membayar via transfer akan muncul di kotak <b>Konfirmasi Pending</b>. Periksa bukti bayar (ikon mata), lalu klik <b>Terima</b> (centang) atau <b>Tolak</b> (silang). Jika ditolak, Anda wajib memberikan alasan.
                  </p>
                </section>

                <section>
                  <h3 className="font-headline-md text-primary mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined">notifications_active</span>
                    3. Pengingat Tagihan
                  </h3>
                  <p className="text-sm font-body-md text-zinc-600">
                    Klik <b>Kirim Pengingat</b> di sidebar untuk mengirimkan notifikasi ke semua warga yang belum melunasi iuran bulan berjalan. Fitur ini akan otomatis membuat record tagihan baru jika belum ada.
                  </p>
                </section>

                <section>
                  <h3 className="font-headline-md text-primary mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined">history_edu</span>
                    4. Rekam Bayar Offline
                  </h3>
                  <p className="text-sm font-body-md text-zinc-600">
                    Gunakan <b>Rekam Bayar</b> di header untuk mencatat warga yang membayar tunai secara langsung. Anda bisa memilih jumlah bulan (misal: bayar 6 bulan sekaligus), dan sistem akan otomatis melunasi tagihan lama serta membuat tagihan baru ke depan.
                  </p>
                </section>
              </div>
              <div className="p-4 border-t-4 border-black bg-zinc-50 flex justify-end">
                <button 
                  onClick={() => setShowGuideModal(false)}
                  className="px-8 py-3 bg-black text-white border-4 border-black font-label-bold uppercase neubrutal-shadow active-press"
                 >
                  Saya Mengerti
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Export Pilihan Periode */}
        {showExportModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white border-4 border-black w-full max-w-md neubrutal-shadow flex flex-col">
              <div className="p-4 border-b-4 border-black flex justify-between items-center bg-tertiary-fixed text-black">
                <h2 className="font-display-bold text-xl uppercase flex items-center gap-2">
                  <span className="material-symbols-outlined">download</span>
                  Export Laporan
                </h2>
                <button onClick={() => setShowExportModal(false)} className="hover:text-error transition-colors">
                  <span className="material-symbols-outlined text-3xl">close</span>
                </button>
              </div>
              <form onSubmit={handleExportSubmit}>
                <div className="p-6 space-y-4">
                  <p className="text-xs font-bold text-zinc-600 uppercase bg-zinc-100 border-2 border-black p-3">
                    Silakan pilih periode bulan dan tahun data iuran yang ingin diekspor ke Excel.
                  </p>
                  <div>
                    <label className="block font-label-bold uppercase mb-2">Pilih Bulan</label>
                    <select
                      required
                      className="w-full border-4 border-black p-3 font-bold bg-white focus:ring-0 outline-none cursor-pointer"
                      value={exportFilters.bulan}
                      onChange={(e) => setExportFilters({...exportFilters, bulan: e.target.value})}
                    >
                      <option value="SEMUA">Semua Bulan (Keseluruhan)</option>
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(b => (
                        <option key={b} value={b.toString()}>{getBulanName(b)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-label-bold uppercase mb-2">Pilih Tahun</label>
                    <select
                      required
                      className="w-full border-4 border-black p-3 font-bold bg-white focus:ring-0 outline-none cursor-pointer"
                      value={exportFilters.tahun}
                      onChange={(e) => setExportFilters({...exportFilters, tahun: e.target.value})}
                    >
                      <option value="SEMUA">Semua Tahun</option>
                      {[2024, 2025, 2026, 2027, 2028].map(y => (
                        <option key={y} value={y.toString()}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="p-4 border-t-4 border-black bg-zinc-50 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowExportModal(false)}
                    className="px-6 py-2 border-4 border-black font-label-bold uppercase hover:bg-white transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-primary text-white border-4 border-black font-label-bold uppercase neubrutal-shadow active-press"
                  >
                    Export ke Excel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Peringatan Data Kosong */}
        {showNoDataModal && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white border-4 border-black w-full max-w-md neubrutal-shadow-lg flex flex-col overflow-hidden">
              <div className="p-4 border-b-4 border-black flex justify-between items-center bg-error text-white">
                <h2 className="font-display-bold text-xl uppercase flex items-center gap-2">
                  <span className="material-symbols-outlined text-2xl animate-bounce">warning</span>
                  Data Tidak Ditemukan!
                </h2>
                <button onClick={() => setShowNoDataModal(false)} className="hover:text-black transition-colors">
                  <span className="material-symbols-outlined text-3xl">close</span>
                </button>
              </div>
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-error-container border-4 border-black flex items-center justify-center mx-auto rounded-none neubrutal-shadow-sm">
                  <span className="material-symbols-outlined text-4xl text-error">database_off</span>
                </div>
                <div>
                  <h3 className="font-headline-md uppercase text-lg">Tidak Ada Data Transaksi</h3>
                  <p className="text-sm font-body-md text-zinc-600 mt-2">
                    Maaf, data transaksi iuran untuk periode <b>{exportFilters.bulan !== 'SEMUA' ? getBulanName(parseInt(exportFilters.bulan)) : ''} {exportFilters.tahun !== 'SEMUA' ? exportFilters.tahun : 'Keseluruhan'}</b> belum dibuat atau belum ada catatan pembayarannya.
                  </p>
                </div>
              </div>
              <div className="p-4 border-t-4 border-black bg-zinc-50 flex flex-col sm:flex-row gap-3 justify-center">
                <button 
                  onClick={() => {
                    setShowNoDataModal(false)
                    setShowExportModal(true)
                  }}
                  className="flex-1 px-4 py-2 border-2 border-black bg-white font-label-bold uppercase neubrutal-shadow-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all text-xs"
                >
                  Pilih Bulan Lain
                </button>
                <button 
                  onClick={() => {
                    setShowNoDataModal(false)
                    setShowGenerateModal(true)
                  }}
                  className="flex-1 px-4 py-2 border-2 border-black bg-primary text-white font-label-bold uppercase neubrutal-shadow-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all text-xs"
                >
                  Buat Tagihan Baru
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
