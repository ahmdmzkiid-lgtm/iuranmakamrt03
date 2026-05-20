import { useState, useEffect } from 'react'
import WargaLayout from '../../components/warga/WargaLayout'
import api from '../../services/api'

export default function WargaMakam() {
  const [loading, setLoading] = useState(true)
  const [wargaData, setWargaData] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/warga/me')
        setWargaData(res.data)
      } catch (error) {
        console.error('Failed to fetch burial data', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return (
    <WargaLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-lg">
          <h1 className="font-display-bold text-headline-md md:text-display-bold uppercase mb-xs">
            Makam Keluarga
          </h1>
          <p className="font-body-lg text-zinc-600">
            Informasi makam keluarga Anda yang terdaftar dalam iuran.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Stats Card - Anggota */}
            <div className="bg-primary-container border-4 border-black p-4 md:p-6 neubrutal-shadow flex flex-col items-start gap-1">
              <span className="material-symbols-outlined text-3xl mb-2 text-white">group</span>
              <p className="font-display-bold text-2xl md:text-headline-lg text-white">{1 + (Array.isArray(wargaData?.anggotaKeluarga) ? wargaData.anggotaKeluarga.length : 0)} Orang</p>
              <p className="font-label-bold text-[10px] uppercase text-white opacity-70 mt-1">Total Anggota Keluarga</p>
            </div>

            {/* Stats Card - Progress Iuran Makam */}
            <div className={`border-4 border-black p-4 md:p-6 neubrutal-shadow flex flex-col items-start gap-1 ${wargaData?.sisaBulanMakam === 0 ? 'bg-green-500' : 'bg-tertiary-fixed'}`}>
              <span className="material-symbols-outlined text-3xl mb-2">payments</span>
              <p className="font-display-bold text-2xl md:text-headline-lg">{wargaData?.bulanMakamLunas || 0}/{wargaData?.totalBulanMakam || 36} Bulan</p>
              <p className="font-label-bold text-[10px] uppercase opacity-70 mt-1">
                {wargaData?.sisaBulanMakam === 0 ? 'IURAN MAKAM LUNAS' : `Sisa ${wargaData?.sisaBulanMakam || 36} bulan lagi`}
              </p>
            </div>

            {/* Daftar Anggota */}
            <div className="bg-white border-4 border-black p-4 md:p-6 neubrutal-shadow col-span-1 md:col-span-2">
              <h4 className="font-headline-md uppercase text-sm mb-4">Daftar Anggota Keluarga</h4>
              <div className="space-y-2">
                {/* Kepala Keluarga */}
                <div className="bg-primary/10 border-2 border-primary p-3 flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">shield_person</span>
                  <div className="flex-1">
                    <p className="font-body-lg font-bold">{wargaData?.user?.nama || '-'}</p>
                    <p className="text-xs text-zinc-500">NIK: {wargaData?.user?.nik || '-'}</p>
                  </div>
                  <span className="bg-primary text-white text-[10px] font-bold px-2 py-1 uppercase">Kepala Keluarga</span>
                </div>

                {/* Anggota Keluarga */}
                {Array.isArray(wargaData?.anggotaKeluarga) && wargaData.anggotaKeluarga.length > 0 ? (
                  wargaData.anggotaKeluarga.map((anggota, idx) => (
                    <div key={idx} className="bg-zinc-50 border-2 border-zinc-200 p-3 flex items-center gap-3">
                      <span className="material-symbols-outlined text-zinc-400">person</span>
                      <div className="flex-1">
                        <p className="font-body-lg">{typeof anggota === 'string' ? anggota : anggota.nama}</p>
                        <p className="text-xs text-zinc-500">NIK: {typeof anggota === 'object' && anggota.nik ? anggota.nik : '-'}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-zinc-500 text-sm italic py-2">Belum ada anggota keluarga lain terdaftar</p>
                )}
              </div>
            </div>

            {/* Info Card */}
            <div className="bg-tertiary-fixed border-4 border-black p-6 neubrutal-shadow col-span-1 md:col-span-2">
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined text-3xl">info</span>
                <div>
                  <h4 className="font-headline-md uppercase text-sm mb-1">Informasi</h4>
                  <p className="text-xs leading-relaxed">
                    Data di atas adalah daftar anggota keluarga yang terdaftar dalam KK Anda. 
                    Iuran makam dihitung berdasarkan jumlah orang (Rp 10.000 per orang termasuk kepala keluarga).
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </WargaLayout>
  )
}
