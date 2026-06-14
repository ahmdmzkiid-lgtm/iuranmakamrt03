import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import WargaLayout from '../../components/warga/WargaLayout'
import api from '../../services/api'

const formatRp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID')

const getBulanName = (bln) => {
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  return bulan[bln - 1] || bln
}

export default function WargaDashboard() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [dataIuran, setDataIuran] = useState([])
  const [loading, setLoading] = useState(true)
  const [showGuideModal, setShowGuideModal] = useState(false)

  useEffect(() => {
    const showGuide = localStorage.getItem('showUserGuide') === 'true'
    if (showGuide) {
      setShowGuideModal(true)
      localStorage.removeItem('showUserGuide')
    }
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [summaryRes, iuranRes] = await Promise.all([
          api.get('/iuran/summary'),
          api.get('/iuran')
        ])
        setSummary(summaryRes.data)
        setDataIuran(iuranRes.data)
        if (summaryRes.data.warga?.nama) {
          localStorage.setItem('nama', summaryRes.data.warga.nama)
        }
      } catch (error) {
        console.error('Failed to fetch data', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const riwayatLunas = dataIuran
    .filter(i => i.status === 'lunas' || i.status === 'pending')
    .slice(0, 3)
    .map(item => ({
      tanggal: item.tanggalBayar ? new Date(item.tanggalBayar).toLocaleDateString('id-ID') : '-',
      deskripsi: item.tipe === 'warga'
        ? `Iuran Makam Bulan ${getBulanName(item.bulan)} ${item.tahun}`
        : `Iuran Perluasan Makam (${item.jumlahBulan} Bulan)`,
      metode: item.metode || '-',
      jumlah: formatRp(item.jumlah),
      status: item.status
    }))

  const makamProgressPercent = summary?.warga 
    ? Math.min(100, Math.round((summary.warga.bulanMakamTerbayar / summary.warga.targetBulanMakam) * 100))
    : 0

  return (
    <WargaLayout>
      <div className="max-w-7xl mx-auto max-w-full">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display-bold text-3xl md:text-4xl uppercase mb-1">
            Dashboard Warga
          </h1>
          <p className="font-body-lg text-zinc-600">
            Halo {summary?.warga?.nama || 'Warga'}, selamat datang kembali di portal RT 03.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
          {/* Status Panel Utama */}
          <div className="md:col-span-8 space-y-6">
            {/* Row 1: Iuran Warga & Makam Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Iuran Makam Bulanan status */}
              <div className="bg-secondary-container border-4 border-black p-4 neubrutal-shadow flex flex-col justify-between h-48">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="bg-white border-2 border-black px-2 py-0.5 text-[9px] font-black uppercase">
                      Iuran Makam (Bulanan)
                    </span>
                    {summary?.iuranWarga?.sudahBayar ? (
                      <span className="bg-secondary text-white border-2 border-black px-2 py-0.5 text-[9px] font-black uppercase">
                        Lunas
                      </span>
                    ) : (
                      <span className="bg-error text-white border-2 border-black px-2 py-0.5 text-[9px] font-black uppercase">
                        Belum Bayar
                      </span>
                    )}
                  </div>
                  <h3 className="font-display-bold uppercase text-xs text-zinc-600 mt-4">Bulan {getBulanName(new Date().getMonth() + 1)}</h3>
                  <p className="font-display-bold text-2xl mt-1">{formatRp(summary?.iuranWarga?.tarif || 10000)}</p>
                </div>
                <button
                  onClick={() => navigate('/warga/tagihan')}
                  className="w-full bg-white border-2 border-black hover:bg-zinc-50 py-2 text-xs font-black uppercase text-center cursor-pointer"
                >
                  {summary?.iuranWarga?.sudahBayar ? 'Lihat Detail' : 'Bayar Sekarang'}
                </button>
              </div>

              {/* Progress Perluasan Makam */}
              <div className="bg-tertiary-fixed border-4 border-black p-4 neubrutal-shadow flex flex-col justify-between h-48">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="bg-white border-2 border-black px-2 py-0.5 text-[9px] font-black uppercase">
                      Iuran Perluasan Makam (35 Bulan)
                    </span>
                    {summary?.warga?.makamLunas ? (
                      <span className="bg-secondary text-white border-2 border-black px-2 py-0.5 text-[9px] font-black uppercase">
                        Lunas 35 Bln
                      </span>
                    ) : (
                      <span className="bg-primary text-white border-2 border-black px-2 py-0.5 text-[9px] font-black uppercase">
                        {summary?.warga?.bulanMakamTerbayar}/35 Bulan
                      </span>
                    )}
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-white border-2 border-black h-4 mt-6 overflow-hidden relative">
                    <div 
                      className="bg-primary h-full border-r-2 border-black transition-all"
                      style={{ width: `${makamProgressPercent}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-black">
                      {makamProgressPercent}%
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-zinc-600 mt-2 uppercase">
                    {summary?.warga?.jumlahOrang} Orang KK • Sisa {summary?.warga?.sisaBulanMakam} bulan wajib bayar
                  </p>
                </div>
                <button
                  onClick={() => navigate('/warga/tagihan')}
                  className="w-full bg-white border-2 border-black hover:bg-zinc-50 py-2 text-xs font-black uppercase text-center cursor-pointer"
                >
                  {summary?.warga?.makamLunas ? 'Lihat Detail' : 'Bayar Cicilan'}
                </button>
              </div>
            </div>

            {/* Quick Action Button Big */}
            <button
              onClick={() => navigate('/warga/tagihan')}
              className="w-full bg-primary text-white border-4 border-black p-4 md:p-6 font-display-bold uppercase text-lg neubrutal-shadow-lg active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
              Menu Pembayaran Iuran
            </button>
          </div>

          {/* Profil KK Panel */}
          <div className="md:col-span-4 bg-white border-4 border-black p-4 md:p-6 neubrutal-shadow-lg">
            <div className="border-b-4 border-black pb-4 mb-4">
              <h3 className="font-headline-md uppercase text-base">Kartu Keluarga</h3>
            </div>
            <div className="space-y-4">
              <div>
                <p className="font-label-bold text-xs uppercase text-zinc-500">Nama Kepala Keluarga</p>
                <p className="font-body-lg uppercase font-bold text-sm md:text-base">{summary?.warga?.nama || 'Nama Warga'}</p>
              </div>
              <div>
                <p className="font-label-bold text-xs uppercase text-zinc-500">Jumlah Tanggungan Makam</p>
                <p className="font-body-lg font-bold text-sm md:text-base">{summary?.warga?.jumlahOrang} Jiwa</p>
                <p className="text-[10px] text-zinc-500 font-bold uppercase mt-0.5">(Kepala Keluarga + Anggota)</p>
              </div>
              <div>
                <p className="font-label-bold text-xs uppercase text-zinc-500">Iuran Perluasan Makam per Bulan</p>
                <p className="font-body-lg font-bold text-sm md:text-base">
                  {summary ? formatRp(summary.warga.jumlahOrang * 10000) : '...'}
                </p>
              </div>
              <div className="pt-4 border-t-2 border-black/10">
                <button onClick={() => navigate('/warga/setelan')} className="w-full bg-zinc-100 hover:bg-zinc-200 text-black border-2 border-black py-2 text-xs font-label-bold uppercase neubrutal-shadow-sm active-press cursor-pointer">
                  Update Anggota Keluarga
                </button>
              </div>
            </div>
          </div>

          {/* Riwayat Pembayaran */}
          <div className="md:col-span-12">
            <div className="bg-white border-4 border-black neubrutal-shadow-lg">
              <div className="border-b-4 border-black p-4 flex justify-between items-center bg-zinc-100">
                <h3 className="font-headline-md uppercase text-sm md:text-base">
                  Riwayat Transaksi Terakhir
                </h3>
                <button onClick={() => navigate('/warga/riwayat')} className="font-label-bold uppercase text-primary underline text-xs">
                  Lihat Semua
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-black text-white border-b-2 border-black">
                    <tr>
                      <th className="p-3 font-black uppercase text-xs">Tanggal</th>
                      <th className="p-3 font-black uppercase text-xs">Deskripsi</th>
                      <th className="p-3 font-black uppercase text-xs">Metode</th>
                      <th className="p-3 font-black uppercase text-right text-xs">Jumlah</th>
                      <th className="p-3 font-black uppercase text-xs text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="5" className="p-4 text-center text-sm font-bold uppercase">Memuat...</td>
                      </tr>
                    ) : riwayatLunas.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-4 text-center text-sm font-bold uppercase text-zinc-500">Belum ada riwayat pembayaran</td>
                      </tr>
                    ) : (
                      riwayatLunas.map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-b-2 border-black/10 hover:bg-secondary-container transition-colors font-bold"
                        >
                          <td className="p-3 text-xs">{row.tanggal}</td>
                          <td className="p-3 text-xs uppercase">{row.deskripsi}</td>
                          <td className="p-3 text-xs uppercase">{row.metode}</td>
                          <td className="p-3 text-right text-xs font-display-bold">
                            {row.jumlah}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2 py-0.5 border border-black text-[9px] font-black uppercase ${
                              row.status === 'lunas' ? 'bg-secondary text-white' : 'bg-tertiary-fixed text-black'
                            }`}>
                              {row.status}
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
        </div>
      </div>

      {showGuideModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border-4 border-black w-full max-w-2xl max-h-[85vh] neubrutal-shadow-lg flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b-4 border-black flex justify-between items-center bg-tertiary-fixed text-black sticky top-0 z-10">
              <h2 className="font-display-bold text-lg uppercase flex items-center gap-2">
                <span className="material-symbols-outlined text-2xl animate-bounce">explore</span>
                Panduan Pemakaian Warga Baru
              </h2>
              <button 
                onClick={() => setShowGuideModal(false)} 
                className="flex items-center justify-center border-2 border-black bg-white p-1 hover:bg-error hover:text-white"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              <div className="bg-secondary-container border-2 border-black p-4 mb-4 neubrutal-shadow-sm">
                <p className="font-body-md text-sm text-black">
                  👋 <span className="font-display-bold uppercase">Selamat datang di Aplikasi Iuran Makam RT 03!</span> <br />
                  Akun Anda telah diaktifkan dengan password baru. Berikut langkah utama untuk membayar iuran:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border-2 border-black bg-white p-4 neubrutal-shadow-sm flex gap-3 items-start">
                  <div className="bg-primary text-white border border-black w-8 h-8 flex items-center justify-center shrink-0 font-display-bold text-sm">
                    1
                  </div>
                  <div>
                    <h3 className="font-headline-md uppercase text-xs mb-1">Cek Iuran</h3>
                    <p className="text-[10px] text-zinc-600 font-bold leading-tight">
                      Cek status iuran bulanan warga (Rp 10.000) dan cicilan makam (Rp 10.000 / Jiwa) di menu pembayaran.
                    </p>
                  </div>
                </div>

                <div className="border-2 border-black bg-white p-4 neubrutal-shadow-sm flex gap-3 items-start">
                  <div className="bg-secondary text-white border border-black w-8 h-8 flex items-center justify-center shrink-0 font-display-bold text-sm">
                    2
                  </div>
                  <div>
                    <h3 className="font-headline-md uppercase text-xs mb-1">Upload Bukti</h3>
                    <p className="text-[10px] text-zinc-600 font-bold leading-tight">
                      Lakukan transfer bank, lalu unggah struk pembayaran Anda agar disetujui oleh Bendahara RT.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t-4 border-black bg-zinc-50 flex justify-end">
              <button 
                onClick={() => setShowGuideModal(false)}
                className="w-full sm:w-auto px-6 py-2.5 border-2 border-black bg-primary text-white font-display-bold uppercase neubrutal-shadow active-press flex items-center justify-center gap-2"
              >
                Mulai Gunakan Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </WargaLayout>
  )
}
