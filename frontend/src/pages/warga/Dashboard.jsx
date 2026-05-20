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
  const [dataIuran, setDataIuran] = useState([])
  const [profil, setProfil] = useState(null)
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
        const [resIuran, resProfil] = await Promise.all([
          api.get('/iuran'),
          api.get('/warga/me')
        ])
        setDataIuran(resIuran.data)
        setProfil(resProfil.data)
        if (resProfil.data.user?.nama) {
          localStorage.setItem('nama', resProfil.data.user.nama)
        }
      } catch (error) {
        console.error('Failed to fetch data', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const belumBayar = dataIuran.filter(i => i.status === 'belum_bayar')
  const belumBayarWarga = belumBayar.filter(i => i.tipe === 'warga')
  const belumBayarMakam = belumBayar.filter(i => i.tipe === 'makam')
  const jumlahAnggota = Array.isArray(profil?.anggotaKeluarga) ? profil.anggotaKeluarga.length : 0
  const totalBelumBayar = belumBayar.reduce((sum, i) => sum + Number(i.jumlah), 0)
  
  const riwayatLunas = dataIuran
    .filter(i => i.status === 'lunas' || i.status === 'pending')
    .slice(0, 3)
    .map(item => ({
      tanggal: item.tanggalBayar ? new Date(item.tanggalBayar).toLocaleDateString('id-ID') : '-',
      deskripsi: `${item.tipe === 'warga' ? 'Iuran Warga' : 'Iuran Makam'} ${getBulanName(item.bulan)}`,
      metode: item.metode || '-',
      jumlah: formatRp(item.jumlah),
      status: item.status
    }))

  return (
    <WargaLayout>
      <div className="max-w-7xl mx-auto max-w-full">
        {/* Header */}
        <div className="mb-lg">
          <h1 className="font-display-bold text-headline-md md:text-display-bold uppercase mb-xs">
            Dashboard Warga RT 03
          </h1>
          <p className="font-body-lg text-zinc-600">
            Halo, selamat datang kembali di portal RT 03.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-gutter">
          {/* Payment Status Card */}
          <div className="md:col-span-8 bg-secondary-container border-4 border-black p-4 md:p-md neubrutal-shadow-lg flex flex-col justify-between min-h-[280px] md:min-h-[300px]">
            <div>
              <div className="flex justify-between items-start mb-md flex-wrap gap-2">
                <div className="bg-white border-2 border-black px-3 md:px-4 py-1 font-label-bold uppercase text-[10px] md:text-xs">
                  Status Pembayaran
                </div>
                {belumBayar.length > 0 ? (
                  <div className="bg-error text-white border-2 border-black px-3 md:px-4 py-1 font-label-bold uppercase text-[10px] md:text-xs">
                    {belumBayar.length} Tagihan Belum Lunas
                  </div>
                ) : (
                  <div className="bg-secondary text-white border-2 border-black px-3 md:px-4 py-1 font-label-bold uppercase text-[10px] md:text-xs">
                    Semua Lunas
                  </div>
                )}
              </div>
              <div className="mb-lg">
                <h2 className="font-display-bold uppercase text-xs md:text-sm text-black">Total Tagihan Belum Bayar</h2>
                <p className="font-display-bold text-4xl md:text-6xl mt-2 text-black">
                  {loading ? '...' : formatRp(totalBelumBayar)}
                </p>
                <div className="flex flex-wrap gap-3 mt-2">
                  {belumBayarWarga.length > 0 && (
                    <span className="text-[10px] font-black uppercase bg-white/50 border border-black px-2 py-0.5">
                      Iuran Warga: {belumBayarWarga.length} bln
                    </span>
                  )}
                  {belumBayarMakam.length > 0 && (
                    <span className="text-[10px] font-black uppercase bg-white/50 border border-black px-2 py-0.5">
                      Iuran Makam: {belumBayarMakam.length} bln
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/warga/tagihan')}
              className="w-full bg-primary text-white border-4 border-black p-4 md:p-6 font-display-bold uppercase text-base md:text-headline-md neubrutal-shadow-lg active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3 md:gap-4"
            >
              <span className="material-symbols-outlined">account_balance_wallet</span>
              Cek Tagihan
            </button>
          </div>

          {/* Profile Summary Card */}
          <div className="md:col-span-4 bg-white border-4 border-black p-4 md:p-md neubrutal-shadow-lg">
            <div className="border-b-4 border-black pb-4 mb-4">
              <h3 className="font-headline-md uppercase">Informasi Warga</h3>
            </div>
            <div className="space-y-4">
              <div>
                <p className="font-label-bold text-xs uppercase text-zinc-500">Nama Warga</p>
                <p className="font-body-lg uppercase font-bold">{profil?.user?.nama || 'Nama Warga'}</p>
              </div>
              <div>
                <p className="font-label-bold text-xs uppercase text-zinc-500">Tagihan Belum Bayar</p>
                <p className="font-body-lg">{belumBayar.length} tagihan</p>
              </div>
              <div>
                <p className="font-label-bold text-xs uppercase text-zinc-500">Jumlah Anggota Keluarga</p>
                <p className="font-body-lg">{jumlahAnggota} orang</p>
              </div>
              <div className="pt-4">
                <button onClick={() => navigate('/warga/setelan')} className="w-full bg-tertiary-fixed text-black border-2 border-black py-2 font-label-bold uppercase neubrutal-shadow active:translate-y-1 active:shadow-none">
                  Update Data Diri
                </button>
              </div>
            </div>
          </div>

          {/* Latest History Section */}
          <div className="md:col-span-12">
            <div className="bg-white border-4 border-black neubrutal-shadow-lg">
              <div className="border-b-4 border-black p-4 md:p-md flex justify-between items-center bg-zinc-100 flex-wrap gap-2">
                <h3 className="font-headline-md uppercase text-base md:text-headline-md">
                  Riwayat Pembayaran Terakhir
                </h3>
                <button onClick={() => navigate('/warga/kuitansi')} className="font-label-bold uppercase text-primary underline text-xs md:text-sm">
                  Lihat Semua
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-black text-white border-b-4 border-black">
                    <tr>
                      <th className="p-3 md:p-md font-black uppercase border-r-2 border-white text-xs">Tanggal</th>
                      <th className="p-3 md:p-md font-black uppercase border-r-2 border-white text-xs">Deskripsi</th>
                      <th className="p-3 md:p-md font-black uppercase border-r-2 border-white text-xs">Metode</th>
                      <th className="p-3 md:p-md font-black uppercase border-r-2 border-white text-right text-xs">Jumlah</th>
                      <th className="p-3 md:p-md font-black uppercase text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="5" className="p-4 text-center text-sm">Memuat data...</td>
                      </tr>
                    ) : riwayatLunas.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-4 text-center text-sm">Belum ada riwayat pembayaran</td>
                      </tr>
                    ) : (
                      riwayatLunas.map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-b-4 border-black last:border-b-0 hover:bg-secondary-container transition-colors font-black"
                        >
                          <td className="p-3 md:p-md border-r-4 border-black text-xs md:text-sm">{row.tanggal}</td>
                          <td className="p-3 md:p-md border-r-4 border-black text-xs md:text-sm uppercase">{row.deskripsi}</td>
                          <td className="p-3 md:p-md border-r-4 border-black text-xs md:text-sm uppercase">{row.metode}</td>
                          <td className="p-3 md:p-md border-r-4 border-black text-right font-display-bold text-xs md:text-sm">
                            {row.jumlah}
                          </td>
                          <td className="p-3 md:p-md">
                            <span className={`px-2 py-1 border-4 border-black text-[10px] font-black uppercase ${row.status === 'lunas' ? 'bg-secondary text-white' : 'bg-tertiary-fixed text-black'}`}>
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

          {/* Quick Action Cards */}
          <div 
            onClick={() => window.open('https://wa.me/6285183147625?text=KELUHAN%20ANDA%20%3A%20', '_blank')}
            className="md:col-span-6 bg-tertiary-fixed border-4 border-black p-4 md:p-md neubrutal-shadow-lg flex gap-4 items-center cursor-pointer hover:-translate-y-1 hover:-translate-x-1 transition-all"
          >
            <div className="bg-white border-2 border-black p-3 shrink-0">
              <span className="material-symbols-outlined text-3xl md:text-4xl">campaign</span>
            </div>
            <div>
              <h4 className="font-display-bold text-sm uppercase">Lapor Masalah</h4>
              <p className="text-xs uppercase font-bold">Jika website mengalami error</p>
            </div>
          </div>
          <div 
            onClick={() => window.open('https://wa.me/6282123576579?text=KELUHAN%20ANDA%20%3A%20', '_blank')}
            className="md:col-span-6 bg-primary text-white border-4 border-black p-4 md:p-md neubrutal-shadow-lg flex gap-4 items-center cursor-pointer hover:-translate-y-1 hover:-translate-x-1 transition-all mb-24 md:mb-0"
          >
            <div className="bg-white text-black border-2 border-black p-3 shrink-0">
              <span className="material-symbols-outlined text-3xl md:text-4xl">groups</span>
            </div>
            <div>
              <h4 className="font-headline-md text-sm uppercase">Hubungi Bendahara</h4>
              <p className="text-xs uppercase font-bold">Untuk konfirmasi & masalah iuran</p>
            </div>
          </div>
        </div>
      </div>

      {showGuideModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border-4 border-black w-full max-w-2xl neubrutal-shadow-lg flex flex-col overflow-hidden animate-in zoom-in duration-200">
            {/* Header */}
            <div className="p-4 md:p-6 border-b-4 border-black flex justify-between items-center bg-tertiary-fixed text-black">
              <h2 className="font-display-bold text-xl md:text-2xl uppercase flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl animate-bounce">explore</span>
                Panduan Pemakaian Warga Baru
              </h2>
              <button 
                onClick={() => setShowGuideModal(false)} 
                className="hover:rotate-90 transition-transform duration-200 flex items-center justify-center border-2 border-black bg-white p-1 hover:bg-error hover:text-white"
              >
                <span className="material-symbols-outlined text-xl md:text-2xl">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 md:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="bg-secondary-container border-4 border-black p-4 mb-4 neubrutal-shadow-sm">
                <p className="font-body-md text-sm md:text-base text-black">
                  👋 <span className="font-display-bold uppercase">Selamat datang di Aplikasi Iuran Makam & RT 03!</span> <br />
                  Akun Anda telah aman diaktifkan dengan password baru. Berikut adalah 4 langkah utama untuk mempermudah aktivitas Anda sebagai warga RT 03:
                </p>
              </div>

              {/* Bento Grid Features */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Step 1 */}
                <div className="border-4 border-black bg-white p-4 neubrutal-shadow-sm flex gap-4 items-start hover:-translate-y-1 transition-all">
                  <div className="bg-primary text-white border-2 border-black w-10 h-10 flex items-center justify-center shrink-0 font-display-bold text-lg">
                    1
                  </div>
                  <div>
                    <h3 className="font-headline-md uppercase text-sm mb-1 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
                      Cek & Bayar Tagihan
                    </h3>
                    <p className="text-xs text-zinc-600 font-bold uppercase leading-relaxed">
                      Lihat rincian tagihan iuran warga atau makam yang belum dibayar secara transparan di dashboard utama.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="border-4 border-black bg-white p-4 neubrutal-shadow-sm flex gap-4 items-start hover:-translate-y-1 transition-all">
                  <div className="bg-secondary text-white border-2 border-black w-10 h-10 flex items-center justify-center shrink-0 font-display-bold text-lg">
                    2
                  </div>
                  <div>
                    <h3 className="font-headline-md uppercase text-sm mb-1 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-lg">upload_file</span>
                      Upload Bukti
                    </h3>
                    <p className="text-xs text-zinc-600 font-bold uppercase leading-relaxed">
                      Setelah transfer bank, unggah struk/bukti transfer Anda agar Bendahara RT dapat segera memverifikasi.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="border-4 border-black bg-white p-4 neubrutal-shadow-sm flex gap-4 items-start hover:-translate-y-1 transition-all">
                  <div className="bg-[#ffae19] text-black border-2 border-black w-10 h-10 flex items-center justify-center shrink-0 font-display-bold text-lg">
                    3
                  </div>
                  <div>
                    <h3 className="font-headline-md uppercase text-sm mb-1 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-lg">download</span>
                      Kuitansi Lunas
                    </h3>
                    <p className="text-xs text-zinc-600 font-bold uppercase leading-relaxed">
                      Unduh kuitansi resmi berformat gambar/PDF kapan pun setelah pembayaran disetujui oleh Bendahara.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="border-4 border-black bg-white p-4 neubrutal-shadow-sm flex gap-4 items-start hover:-translate-y-1 transition-all">
                  <div className="bg-[#00f0ff] text-black border-2 border-black w-10 h-10 flex items-center justify-center shrink-0 font-display-bold text-lg">
                    4
                  </div>
                  <div>
                    <h3 className="font-headline-md uppercase text-sm mb-1 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-lg">groups</span>
                      Kelola Keluarga
                    </h3>
                    <p className="text-xs text-zinc-600 font-bold uppercase leading-relaxed">
                      Kelola dan perbarui data anggota keluarga yang terdaftar dalam Kartu Keluarga (KK) Anda dengan mudah.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t-4 border-black bg-zinc-50 flex justify-end">
              <button 
                onClick={() => setShowGuideModal(false)}
                className="w-full sm:w-auto px-6 py-3 border-4 border-black bg-primary text-white font-display-bold uppercase neubrutal-shadow active-press flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">rocket_launch</span>
                Mulai Jelajahi Aplikasi
              </button>
            </div>
          </div>
        </div>
      )}

    </WargaLayout>
  )
}
