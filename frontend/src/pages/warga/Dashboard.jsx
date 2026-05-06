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
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [savingSetup, setSavingSetup] = useState(false)
  const [setupForm, setSetupForm] = useState({
    almarhum: [{ nama: '', hubungan: '', tahunWafat: '' }]
  })

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
        if (resProfil.data.isFirstLogin) {
          const count = resProfil.data.jumlahMakam || 1
          const initialAlmarhum = Array.from({ length: count }, () => ({ nama: '', hubungan: '', tahunWafat: '' }))
          setSetupForm({ almarhum: initialAlmarhum })
          setShowSetupModal(true)
        }
      } catch (error) {
        console.error('Failed to fetch data', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleSetupChange = (index, field, value) => {
    const updated = [...setupForm.almarhum]
    updated[index] = { ...updated[index], [field]: value }
    setSetupForm({ almarhum: updated })
  }

  const addSetupAlmarhum = () => {
    setSetupForm({ almarhum: [...setupForm.almarhum, { nama: '', hubungan: '', tahunWafat: '' }] })
  }

  const handleSaveSetup = async () => {
    if (setupForm.almarhum.some(a => !a.nama)) {
      alert('Mohon isi minimal nama almarhum/ah')
      return
    }
    setSavingSetup(true)
    try {
      await api.put('/warga/me', {
        alamat: profil.alamat,
        telepon: profil.telepon,
        jumlahMakam: profil.jumlahMakam || setupForm.almarhum.length,
        daftarAlmarhum: setupForm.almarhum
      })
      setShowSetupModal(false)
      // Refresh profil
      const res = await api.get('/warga/me')
      setProfil(res.data)
    } catch (error) {
      console.error('Failed to save setup', error)
      alert('Gagal menyimpan data. Silakan coba lagi.')
    } finally {
      setSavingSetup(false)
    }
  }

  const belumBayar = dataIuran.filter(i => i.status === 'belum_bayar')
  // Menghitung Sisa Tagihan Berdasarkan Jumlah Makam & Bulan Terbayar
  const jumlahMakam = profil?.jumlahMakam || 1
  const bulanTerbayar = profil?.bulanTerbayar || 0
  const sisaBulan = Math.max(0, 35 - bulanTerbayar)
  const totalTagihan = sisaBulan * jumlahMakam * 10000
  
  const riwayatLunas = dataIuran
    .filter(i => i.status === 'lunas' || i.status === 'pending')
    .slice(0, 3)
    .map(item => ({
      tanggal: item.tanggalBayar ? new Date(item.tanggalBayar).toLocaleDateString('id-ID') : '-',
      deskripsi: `Iuran Makam ${getBulanName(item.bulan)}`,
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
                {totalTagihan > 0 ? (
                  <div className="bg-error text-white border-2 border-black px-3 md:px-4 py-1 font-label-bold uppercase text-[10px] md:text-xs">
                    Belum Lunas ({sisaBulan} bulan x {jumlahMakam} makam)
                  </div>
                ) : (
                  <div className="bg-secondary text-white border-2 border-black px-3 md:px-4 py-1 font-label-bold uppercase text-[10px] md:text-xs">
                    Lunas
                  </div>
                )}
              </div>
              <div className="mb-lg">
                <h2 className="font-display-bold uppercase text-xs md:text-sm text-black">Total Sisa Tagihan</h2>
                <p className="font-display-bold text-4xl md:text-6xl mt-2 text-black">
                  {loading ? '...' : formatRp(totalTagihan)}
                </p>
                <p className="text-sm font-black mt-2 uppercase text-black/70">
                  (Berdasarkan sisa {sisaBulan} bulan untuk {jumlahMakam} makam)
                </p>
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
                <p className="font-label-bold text-xs uppercase text-zinc-500">Iuran Perbulan</p>
                <p className="font-body-lg">Rp 10.000 x {jumlahMakam} Makam</p>
              </div>
              <div>
                <p className="font-label-bold text-xs uppercase text-zinc-500">Progress Pelunasan</p>
                <p className="font-body-lg">Dibayar {bulanTerbayar} dari 35 Bulan</p>
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

      {/* Mandatory First-Time Setup Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 z-[100] bg-black bg-opacity-80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white border-4 border-black p-6 md:p-8 max-w-2xl w-full neubrutal-shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="mb-6">
              <h2 className="font-display-bold text-2xl md:text-3xl uppercase mb-2">Lengkapi Data Makam</h2>
              <p className="text-zinc-600 text-sm">
                Selamat datang! Sebagai penghuni baru, Anda diwajibkan mengisi daftar almarhum/almarhumah keluarga Anda untuk pendataan iuran makam.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              {setupForm.almarhum.map((a, idx) => (
                <div key={idx} className="border-2 border-black p-4 bg-zinc-50">
                  <p className="font-label-bold uppercase text-[10px] text-zinc-400 mb-3">Data Almarhum #{idx + 1}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-black uppercase mb-1 block">Nama Lengkap</label>
                      <input 
                        type="text" 
                        value={a.nama}
                        onChange={(e) => handleSetupChange(idx, 'nama', e.target.value)}
                        placeholder="Contoh: Budi bin Ahmad"
                        className="w-full border-2 border-black p-2 text-sm focus:bg-primary-fixed/10 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase mb-1 block">Hubungan</label>
                      <input 
                        type="text" 
                        value={a.hubungan}
                        onChange={(e) => handleSetupChange(idx, 'hubungan', e.target.value)}
                        placeholder="Ayah/Ibu/Saudara"
                        className="w-full border-2 border-black p-2 text-sm focus:bg-primary-fixed/10 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase mb-1 block">Tahun Wafat</label>
                      <input 
                        type="text" 
                        value={a.tahunWafat}
                        onChange={(e) => handleSetupChange(idx, 'tahunWafat', e.target.value)}
                        placeholder="2024"
                        className="w-full border-2 border-black p-2 text-sm focus:bg-primary-fixed/10 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
              
            </div>

            <button
              onClick={handleSaveSetup}
              disabled={savingSetup}
              className="w-full bg-primary text-white border-4 border-black p-4 font-display-bold uppercase text-lg neubrutal-shadow active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {savingSetup ? 'Menyimpan...' : 'Simpan & Masuk ke Dashboard'}
            </button>
            <p className="text-[10px] text-center mt-4 text-zinc-400 uppercase font-bold">
              Data ini diperlukan untuk validasi iuran tahunan makam RT.
            </p>
          </div>
        </div>
      )}
    </WargaLayout>
  )
}
